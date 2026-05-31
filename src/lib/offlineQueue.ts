// File d'attente IndexedDB pour les ventes encaissées hors ligne.
// Format minimal sans dépendance externe.

import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const DB_NAME = 'saade-offline';
const STORE = 'pending_ventes';
const VERSION = 1;

export interface PendingVente {
  id: string; // uuid client temporaire
  createdAt: number;
  vente: Record<string, any>;
  lignes: Array<Record<string, any>>;
  credit?: Record<string, any> | null;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T = void>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | Promise<T>): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const s = t.objectStore(STORE);
    const r = fn(s);
    if (r instanceof IDBRequest) {
      r.onsuccess = () => resolve(r.result as T);
      r.onerror = () => reject(r.error);
    }
    t.oncomplete = () => { if (!(r instanceof IDBRequest)) resolve(undefined as unknown as T); };
    t.onerror = () => reject(t.error);
  });
}

export async function queueVente(item: Omit<PendingVente, 'id' | 'createdAt'>): Promise<PendingVente> {
  const id = crypto.randomUUID();
  const record: PendingVente = { id, createdAt: Date.now(), ...item };
  await tx('readwrite', s => s.put(record));
  return record;
}

export async function getPending(): Promise<PendingVente[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, 'readonly');
    const r = t.objectStore(STORE).getAll();
    r.onsuccess = () => resolve((r.result as PendingVente[]).sort((a, b) => a.createdAt - b.createdAt));
    r.onerror = () => reject(r.error);
  });
}

async function remove(id: string) { await tx('readwrite', s => s.delete(id)); }

let flushing = false;

export async function flushQueue(opts: { silent?: boolean } = {}): Promise<{ ok: number; ko: number }> {
  if (flushing) return { ok: 0, ko: 0 };
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return { ok: 0, ko: 0 };
  flushing = true;
  let ok = 0, ko = 0;
  try {
    const pending = await getPending();
    for (const p of pending) {
      try {
        const { data: vente, error } = await supabase.from('ventes').insert(p.vente as any).select('*').single();
        if (error) throw error;
        if (p.lignes.length) {
          const lignes = p.lignes.map(l => ({ ...l, vente_id: (vente as any).id }));
          const { error: e2 } = await supabase.from('vente_lignes').insert(lignes as any);
          if (e2) throw e2;
        }
        if (p.credit) {
          await supabase.from('credits_clients').insert({ ...p.credit, vente_id: (vente as any).id } as any);
        }
        await remove(p.id);
        ok++;
      } catch (e) {
        console.error('flush vente failed', p.id, e);
        ko++;
      }
    }
  } finally {
    flushing = false;
  }
  if (!opts.silent && (ok || ko)) {
    if (ok) toast.success(`${ok} vente${ok > 1 ? 's' : ''} synchronisée${ok > 1 ? 's' : ''}`);
    if (ko) toast.error(`${ko} vente${ko > 1 ? 's' : ''} en échec — réessai à la prochaine connexion`);
  }
  return { ok, ko };
}

let started = false;
export function startOfflineSync() {
  if (started || typeof window === 'undefined') return;
  started = true;
  window.addEventListener('online', () => { flushQueue(); });
  // tentative initiale + périodique
  flushQueue({ silent: true });
  setInterval(() => { if (navigator.onLine) flushQueue({ silent: true }); }, 60_000);
}

export function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}
