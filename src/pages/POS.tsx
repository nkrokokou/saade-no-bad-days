import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Minus, Trash2, Search, Printer, Lock, Unlock, ShoppingCart, PauseCircle, Utensils, Settings } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { toast } from 'sonner';
import { Produit, useProducts } from '@/hooks/useProducts';
import { useCategories } from '@/hooks/useCategories';
import { queueVente, isOffline } from '@/lib/offlineQueue';
import { printHtmlOrFallback, isQzAvailable, listPrinters } from '@/lib/qzPrint';
import { ProductOptionsDialog, fetchProductOptions } from '@/components/ProductOptionsDialog';
import { escapeHtml, sanitizeCss } from '@/lib/htmlSafe';


type PaymentMode = 'especes' | 'mobile_money' | 'carte' | 'credit' | 'ticket';

interface CartLine {
  produit: Produit;
  quantite: number;
  remise: number;
  options?: { groupe_nom: string; item_libelle: string; prix_supplement: number }[];
}

const PAYMENT_LABELS: Record<PaymentMode, string> = {
  especes: 'Espèces',
  mobile_money: 'Mobile Money',
  carte: 'Carte',
  credit: 'Crédit',
  ticket: 'Ticket / Bon',
};

const POSTE_LABELS: Record<string, string> = {
  cuisine: 'CUISINE',
  bar: 'BAR / BOISSONS',
  labo_patisserie: 'LABO PÂTISSERIE',
  labo_viennoiserie: 'LABO VIENNOISERIE',
  chaud: 'CUISINE CHAUDE',
  froid: 'CUISINE FROIDE',
  caisse: 'CAISSE',
};


interface TableResto { id: string; numero: string; zone: string | null; places: number; }

export default function POS() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [activeCat, setActiveCat] = useState<string>('all');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [remiseGlobale, setRemiseGlobale] = useState(0);
  const [payOpen, setPayOpen] = useState(false);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('especes');
  const [montantRecu, setMontantRecu] = useState<number>(0);
  const [clientNom, setClientNom] = useState('');
  const [notes, setNotes] = useState('');
  const [openSessionDialog, setOpenSessionDialog] = useState(false);
  const [closeSessionDialog, setCloseSessionDialog] = useState(false);
  const [quartDialog, setQuartDialog] = useState(false);
  const [quartMotif, setQuartMotif] = useState('');
  const [fondInitial, setFondInitial] = useState(0);
  const [fondCompte, setFondCompte] = useState(0);
  const [lastTicket, setLastTicket] = useState<any>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [tableId, setTableId] = useState<string>('comptoir');
  const [serveur, setServeur] = useState<string>('');
  const [tabNom, setTabNom] = useState<string>('');
  const [tabsOpen, setTabsOpen] = useState(false);
  const [currentTabId, setCurrentTabId] = useState<string | null>(null);
  const [qzDialog, setQzDialog] = useState(false);
  const [qzPrinters, setQzPrinters] = useState<string[]>([]);
  const [qzMap, setQzMap] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem('qz_printers') || '{}'); } catch { return {}; }
  });
  const [qzStatus, setQzStatus] = useState<'idle' | 'checking' | 'ok' | 'ko'>('idle');

  // Produits
  const { data: produits = [] } = useProducts();
  const { data: catList = [] } = useCategories(false);
  // Map nom catégorie → imprimante_cible
  const catImprimante = useMemo(() => {
    const m: Record<string, string> = {};
    catList.forEach(c => { m[c.nom] = c.imprimante_cible || 'chaud'; });
    return m;
  }, [catList]);


  // Templates de tickets (cuisine / caisse) gérés par la CEO
  const { data: ticketTemplates = [] } = useQuery({
    queryKey: ['ticket_templates'],
    queryFn: async () => {
      const { data } = await supabase.from('ticket_templates' as any).select('*');
      return (data || []) as any[];
    },
    staleTime: 60_000,
  });
  const tplCuisine = ticketTemplates.find(t => t.type === 'cuisine') || null;
  const tplCaisse = ticketTemplates.find(t => t.type === 'caisse') || null;

  const { data: tables = [] } = useQuery({
    queryKey: ['tables-resto'],
    queryFn: async () => {
      const { data, error } = await supabase.from('tables_restaurant' as any).select('*').eq('actif', true).order('numero');
      if (error) throw error;
      return (data || []) as unknown as TableResto[];
    },
  });

  // Session ouverte
  const { data: session, refetch: refetchSession } = useQuery({
    queryKey: ['session-caisse'],
    queryFn: async () => {
      const { data, error } = await supabase.from('sessions_caisse').select('*').eq('statut', 'ouverte').order('ouvert_at', { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Stock disponible du jour (production envoyée en salle - ventes - dégustations)
  const today = new Date().toISOString().slice(0, 10);
  const { data: stockMap = {} } = useQuery({
    queryKey: ['pos-stock-jour', today],
    refetchInterval: 30000,
    queryFn: async () => {
      const [prod, vl, deg] = await Promise.all([
        supabase.from('production_labo').select('produit_id, qte_sortie_en_salle').eq('date_production', today),
        supabase.from('vente_lignes').select('produit_id, quantite, ventes!inner(date_vente, statut)').gte('ventes.date_vente', today + 'T00:00:00').in('ventes.statut', ['validee', 'en_cours']),
        supabase.from('degustations').select('produit_id, quantite').eq('date_degustation', today),
      ]);
      const m: Record<string, number> = {};
      (prod.data || []).forEach((r: any) => { m[r.produit_id] = (m[r.produit_id] || 0) + Number(r.qte_sortie_en_salle || 0); });
      (vl.data || []).forEach((r: any) => { if (m[r.produit_id] !== undefined) m[r.produit_id] -= Number(r.quantite || 0); });
      (deg.data || []).forEach((r: any) => { if (m[r.produit_id] !== undefined) m[r.produit_id] -= Number(r.quantite || 0); });
      return m;
    },
  });

  const getStockDispo = (pid: string) => {
    const base = stockMap[pid];
    if (base === undefined) return null; // produit non suivi (boisson, etc.)
    const inCart = cart.find(l => l.produit.id === pid)?.quantite || 0;
    return base - inCart;
  };

  // Tickets en attente (tabs ouverts)
  const { data: openTabs = [], refetch: refetchTabs } = useQuery({
    queryKey: ['open-tabs', session?.id],
    enabled: !!session,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ventes')
        .select('id, numero_ticket, total, table_id, serveur_id, client_nom, notes, created_at, vente_lignes(*, vente_ligne_options(*))')
        .eq('session_id', session!.id)
        .eq('statut', 'en_cours')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const categories = useMemo(() => Array.from(new Set(produits.map(p => p.categorie))).sort(), [produits]);

  const filtered = useMemo(() => {
    const s = search.toLowerCase().trim();
    return produits.filter(p => {
      if (activeCat !== 'all' && p.categorie !== activeCat) return false;
      if (s && !p.nom.toLowerCase().includes(s)) return false;
      return true;
    });
  }, [produits, search, activeCat]);

  const totalLignes = useMemo(
    () => cart.reduce((s, l) => {
      const supp = (l.options || []).reduce((a, o) => a + (o.prix_supplement || 0), 0);
      return s + ((l.produit.prix_vente || 0) + supp) * l.quantite - l.remise;
    }, 0),
    [cart]
  );
  const totalTicket = Math.max(0, totalLignes - remiseGlobale);
  const rendu = paymentMode === 'especes' ? Math.max(0, montantRecu - totalTicket) : 0;

  useEffect(() => { if (payOpen) setMontantRecu(totalTicket); }, [payOpen, totalTicket]);

  const [optDialog, setOptDialog] = useState<{ produit: Produit; groupes: any[] } | null>(null);

  const addToCart = async (p: Produit) => {
    const dispo = getStockDispo(p.id);
    if (dispo !== null && dispo <= 0) {
      toast.error(`Stock épuisé : ${p.nom}`);
      return;
    }
    // Vérifier si le produit a des options
    const groupes = await fetchProductOptions(p.id);
    if (groupes.length > 0) {
      setOptDialog({ produit: p, groupes });
      return;
    }
    setCart(c => {
      const i = c.findIndex(l => l.produit.id === p.id && !l.options?.length);
      if (i >= 0) { const n = [...c]; n[i] = { ...n[i], quantite: n[i].quantite + 1 }; return n; }
      return [...c, { produit: p, quantite: 1, remise: 0 }];
    });
  };

  const addWithOptions = (p: Produit, options: { groupe_nom: string; item_libelle: string; prix_supplement: number }[]) => {
    setCart(c => [...c, { produit: p, quantite: 1, remise: 0, options }]);
    setOptDialog(null);
  };
  const clearCart = () => {
    setCart([]); setRemiseGlobale(0); setClientNom(''); setNotes('');
    setTableId('comptoir'); setServeur(''); setCurrentTabId(null); setTabNom('');
  };

  const openSessionMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('sessions_caisse').insert({ ouvert_par: user?.id, fond_initial: fondInitial, statut: 'ouverte' });
      if (error) throw error;
    },
    onSuccess: () => { toast.success('Caisse ouverte'); refetchSession(); setOpenSessionDialog(false); setFondInitial(0); },
    onError: (e: any) => toast.error(e.message),
  });

  const closeSessionMut = useMutation({
    mutationFn: async () => {
      if (!session) throw new Error('Aucune session');
      const { data: ventesData } = await supabase.from('ventes').select('total, mode_paiement').eq('session_id', session.id).eq('statut', 'validee');
      const totalEspeces = (ventesData || []).filter(v => v.mode_paiement === 'especes').reduce((s, v) => s + Number(v.total), 0);
      const fondAttendu = Number(session.fond_initial) + totalEspeces;
      const ecart = fondCompte - fondAttendu;
      const { error } = await supabase.from('sessions_caisse').update({
        statut: 'fermee', ferme_par: user?.id, ferme_at: new Date().toISOString(),
        fond_final_attendu: fondAttendu, fond_final_compte: fondCompte, ecart,
      }).eq('id', session.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success('Caisse fermée'); refetchSession(); setCloseSessionDialog(false); setFondCompte(0); },
    onError: (e: any) => toast.error(e.message),
  });

  // Passage de quart : ferme la session courante et en ouvre une nouvelle (même fond compté)
  const passageQuartMut = useMutation({
    mutationFn: async () => {
      if (!session) throw new Error('Aucune session');
      const { data: ventesData } = await supabase.from('ventes').select('total, mode_paiement').eq('session_id', session.id).eq('statut', 'validee');
      const totalEspeces = (ventesData || []).filter(v => v.mode_paiement === 'especes').reduce((s, v) => s + Number(v.total), 0);
      const fondAttendu = Number(session.fond_initial) + totalEspeces;
      const ecart = fondCompte - fondAttendu;
      const { error: e1 } = await supabase.from('sessions_caisse').update({
        statut: 'fermee', ferme_par: user?.id, ferme_at: new Date().toISOString(),
        fond_final_attendu: fondAttendu, fond_final_compte: fondCompte, ecart,
        motif_fermeture: quartMotif || 'Passage de quart',
      }).eq('id', session.id);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from('sessions_caisse').insert({
        ouvert_par: user?.id, fond_initial: fondCompte, statut: 'ouverte',
        session_parent_id: session.id,
        notes: `Reprise après ${session.id.slice(0, 8)} — ${quartMotif || 'passage de quart'}`,
      });
      if (e2) throw e2;
    },
    onSuccess: () => {
      toast.success('Passage de quart effectué — nouvelle session ouverte');
      refetchSession();
      setQuartDialog(false); setFondCompte(0); setQuartMotif('');
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Construit payload vente + lignes
  const buildVentePayload = (statut: 'validee' | 'en_cours') => {
    const tId = tableId === 'comptoir' ? null : tableId;
    // Crédit : la vente reste en credit_pending — pas de décrémentation stock tant que pas soldé
    const finalStatut: string = statut === 'validee' && paymentMode === 'credit' ? 'credit_pending' : statut;
    return {
      vente: {
        session_id: session!.id,
        total: totalTicket,
        remise_globale: remiseGlobale,
        mode_paiement: statut === 'validee' ? paymentMode : 'especes',
        montant_recu: statut === 'validee' && paymentMode === 'especes' ? montantRecu : totalTicket,
        rendu: statut === 'validee' ? rendu : 0,
        encaisse_par: statut === 'validee' ? user?.id : null,
        client_nom: clientNom || null,
        notes: notes || null,
        statut: finalStatut,
        table_id: tId,
        serveur_id: null as any,
      } as any,
      serveurNom: serveur,
    };
  };


  // Mettre en attente (tab)
  const holdTab = useMutation({
    mutationFn: async () => {
      if (!session) throw new Error('Ouvrez la caisse');
      if (cart.length === 0) throw new Error('Panier vide');
      const payload = buildVentePayload('en_cours');
      // Préfixes [Nom:] et [Serveur:] dans notes pour persistance simple sans changement de schéma
      const parts: string[] = [];
      if (tabNom.trim()) parts.push(`[Nom: ${tabNom.trim()}]`);
      if (serveur.trim()) parts.push(`[Serveur: ${serveur.trim()}]`);
      const noteWithServer = (parts.join(' ') + ' ' + (notes || '')).trim() || null;
      let venteId = currentTabId;
      if (currentTabId) {
        await supabase.from('vente_lignes').delete().eq('vente_id', currentTabId);
        const { error } = await supabase.from('ventes').update({
          total: totalTicket, remise_globale: remiseGlobale, table_id: payload.vente.table_id,
          client_nom: clientNom || null, notes: noteWithServer,
        }).eq('id', currentTabId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('ventes').insert({
          ...payload.vente, notes: noteWithServer,
        }).select('id').single();
        if (error) throw error;
        venteId = data.id;
      }
      const lignes = cart.map(l => {
        const supp = (l.options || []).reduce((a, o) => a + (o.prix_supplement || 0), 0);
        const unit = (l.produit.prix_vente || 0) + supp;
        return {
          vente_id: venteId,
          produit_id: l.produit.id,
          produit_nom: l.produit.nom,
          quantite: l.quantite,
          prix_unitaire: unit,
          remise: l.remise,
          total_ligne: unit * l.quantite - l.remise,
        };
      });
      const { data: insertedLignes, error: e2 } = await (supabase.from('vente_lignes') as any).insert(lignes).select('id');
      if (e2) throw e2;
      // Persister les options
      const optionsRows: any[] = [];
      cart.forEach((l, idx) => {
        const lid = insertedLignes?.[idx]?.id;
        if (!lid || !l.options?.length) return;
        l.options.forEach(o => optionsRows.push({
          vente_ligne_id: lid, groupe_nom: o.groupe_nom, item_libelle: o.item_libelle, prix_supplement: o.prix_supplement || 0,
        }));
      });
      if (optionsRows.length) await (supabase.from('vente_ligne_options') as any).insert(optionsRows);
      // Plus d'impression auto ici : la cuisine s'imprime via le bouton dédié
      return venteId;
    },
    onSuccess: () => {
      toast.success('Ticket mis en attente');
      refetchTabs();
      clearCart();
      setCartOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Reprendre un tab
  const resumeTab = (tab: any) => {
    const lignes = (tab.vente_lignes || []) as any[];
    const newCart: CartLine[] = lignes.map(l => {
      const p = produits.find(pr => pr.id === l.produit_id) || {
        id: l.produit_id, nom: l.produit_nom, categorie: 'DIVERS', prix_vente: l.prix_unitaire,
      } as Produit;
      const opts = (l.vente_ligne_options || []).map((o: any) => ({
        groupe_nom: o.groupe_nom, item_libelle: o.item_libelle, prix_supplement: Number(o.prix_supplement) || 0,
      }));
      const supp = opts.reduce((a: number, o: any) => a + o.prix_supplement, 0);
      const basePrice = Math.max(0, Number(l.prix_unitaire) - supp);
      return { produit: { ...p, prix_vente: basePrice }, quantite: Number(l.quantite), remise: Number(l.remise || 0), options: opts };
    });
    setCart(newCart);
    setCurrentTabId(tab.id);
    setTableId(tab.table_id || 'comptoir');
    setClientNom(tab.client_nom || '');
    const raw = tab.notes || '';
    const mNom = raw.match(/\[Nom:\s*([^\]]+)\]/);
    const mSrv = raw.match(/\[Serveur:\s*([^\]]+)\]/);
    setTabNom(mNom ? mNom[1].trim() : '');
    setServeur(mSrv ? mSrv[1].trim() : '');
    const cleaned = raw.replace(/\[Nom:\s*[^\]]+\]\s*/g, '').replace(/\[Serveur:\s*[^\]]+\]\s*/g, '').trim();
    setNotes(cleaned);
    setTabsOpen(false);
    setCartOpen(true);
  };

  const cancelTab = useMutation({
    mutationFn: async (id: string) => {
      const { error: e1 } = await supabase.from('vente_lignes').delete().eq('vente_id', id);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from('ventes').delete().eq('id', id);
      if (e2) throw e2;
      // Vérification : confirmer que le ticket a bien été supprimé (sinon RLS l'a bloqué silencieusement)
      const { data: stillThere } = await supabase.from('ventes').select('id').eq('id', id).maybeSingle();
      if (stillThere) throw new Error("Suppression refusée : votre rôle n'a pas le droit « Tickets en attente · Supprimer ». Demandez à un CEO de l'activer.");
    },
    onSuccess: () => { toast.success('Ticket annulé'); refetchTabs(); },
    onError: (e: any) => toast.error(e.message),
  });


  const validateSale = useMutation({
    mutationFn: async () => {
      if (!session) throw new Error('Ouvrez la caisse');
      if (cart.length === 0) throw new Error('Panier vide');
      const payload = buildVentePayload('validee');
      const noteWithServer = serveur ? `[Serveur: ${serveur}] ${notes || ''}`.trim() : (notes || null);

      const buildLignes = (venteId: string | null) => cart.map(l => {
        const supp = (l.options || []).reduce((a, o) => a + (o.prix_supplement || 0), 0);
        const unit = (l.produit.prix_vente || 0) + supp;
        return {
          vente_id: venteId,
          produit_id: l.produit.id,
          produit_nom: l.produit.nom,
          quantite: l.quantite,
          prix_unitaire: unit,
          remise: l.remise,
          total_ligne: unit * l.quantite - l.remise,
          options: l.options || [],
        };
      });

      // Mode hors ligne → mise en file d'attente IndexedDB
      if (isOffline() && !currentTabId) {
        const credit = paymentMode === 'credit' && clientNom
          ? { client_nom: clientNom, montant_initial: totalTicket, montant_restant: totalTicket, notes: notes || null, created_by: user?.id }
          : null;
        const pending = await queueVente({
          vente: { ...payload.vente, notes: noteWithServer },
          lignes: buildLignes(null).map(({ options, ...rest }) => rest),
          credit,
        });
        const fauxVente = { id: pending.id, numero_ticket: '⏳ HORS-LIGNE', total: totalTicket, mode_paiement: paymentMode, date_vente: new Date().toISOString() } as any;
        return { vente: fauxVente, lignes: buildLignes(pending.id), offline: true };
      }

      let vente: any;
      if (currentTabId) {
        await supabase.from('vente_lignes').delete().eq('vente_id', currentTabId);
        const { data, error } = await supabase.from('ventes').update({
          ...payload.vente, notes: noteWithServer,
        }).eq('id', currentTabId).select('*').single();
        if (error) throw error;
        vente = data;
      } else {
        const { data, error } = await supabase.from('ventes').insert({
          ...payload.vente, notes: noteWithServer,
        }).select('*').single();
        if (error) throw error;
        vente = data;
      }
      const lignes = buildLignes(vente.id);
      const lignesForDb = lignes.map(({ options, ...rest }) => rest);
      const { data: insertedLignes, error: e2 } = await (supabase.from('vente_lignes') as any).insert(lignesForDb).select('id');
      if (e2) throw e2;
      // Persister les options par ligne
      const optionsRows: any[] = [];
      lignes.forEach((l, idx) => {
        const lid = insertedLignes?.[idx]?.id;
        if (!lid || !l.options?.length) return;
        l.options.forEach((o: any) => optionsRows.push({
          vente_ligne_id: lid, groupe_nom: o.groupe_nom, item_libelle: o.item_libelle, prix_supplement: o.prix_supplement || 0,
        }));
      });
      if (optionsRows.length) await (supabase.from('vente_ligne_options') as any).insert(optionsRows);
      if (paymentMode === 'credit' && clientNom) {
        await supabase.from('credits_clients').insert({
          client_nom: clientNom, vente_id: vente.id,
          montant_initial: totalTicket, montant_restant: totalTicket,
          notes: notes || null, created_by: user?.id,
        });
      }
      return { vente, lignes, offline: false };
    },
    onSuccess: ({ vente, lignes, offline }) => {
      toast.success(offline ? 'Vente enregistrée hors ligne — sera synchronisée au retour du réseau' : 'Vente enregistrée');
      setLastTicket({ vente, lignes });
      setPayOpen(false);
      qc.invalidateQueries({ queryKey: ['ventes'] });
      qc.invalidateQueries({ queryKey: ['pos-stock-jour'] });
      refetchTabs();
      setTimeout(() => {
        printTicket({ vente, lignes });
      }, 100);
      clearCart();
      setCartOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Imprime un ticket par imprimante cible (chaud / froid / caisse) — applique le template cuisine
  const printPrepTickets = (lines: CartLine[], ctx: { tableNum: string; serveur: string; numero: string }) => {
    const groups: Record<string, CartLine[]> = {};
    lines.forEach(l => {
      // Priorité : produit.imprimante_cible (override) → catégorie.imprimante_cible → fallback 'chaud'
      const override = (l.produit as any).imprimante_cible as string | undefined;
      const fromCat = catImprimante[l.produit.categorie] || 'chaud';
      const cible = override || fromCat;
      if (cible === 'aucune') return; // pas d'impression cuisine
      if (cible === 'caisse') return; // imprimé sur le ticket caisse uniquement
      (groups[cible] = groups[cible] || []).push(l);
    });
    if (Object.keys(groups).length === 0) {
      toast.info('Aucun article à préparer en cuisine');
      return;
    }
    Object.entries(groups).forEach(([cible, grp]) => printPrepTicket(cible, grp, ctx));
  };

  // Imprime un bon cuisine à la demande (depuis le panier en cours)
  const printCuisineFromCart = () => {
    if (cart.length === 0) { toast.error('Panier vide'); return; }
    const tableNum = tables.find(t => t.id === tableId)?.numero || 'Comptoir';
    printPrepTickets(cart, { tableNum, serveur, numero: currentTabId ? 'EN ATTENTE' : 'BROUILLON' });
  };


  // Mapping cible → nom imprimante QZ (configuré via dialog)
  const getPrinterFor = (cible: string): string | null => {
    try {
      const map = JSON.parse(localStorage.getItem('qz_printers') || '{}');
      return map[cible] || null;
    } catch { return null; }
  };

  // Impression : QZ Tray (direct, sans dialogue) → fallback iframe + window.print()
  const printViaIframe = (html: string, label: string, cible: string = 'caisse') => {
    const fallback = () => {
      try {
        const iframe = document.createElement('iframe');
        iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
        document.body.appendChild(iframe);
        const doc = iframe.contentWindow?.document;
        if (!doc) throw new Error('iframe doc indisponible');
        doc.open(); doc.write(html); doc.close();
        const triggerPrint = () => {
          try {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
            toast.success(`🖨️ ${label} envoyé à l'imprimante`);
          } catch (err: any) {
            toast.error(`Impression ${label} : ${err?.message || 'erreur'}`);
          }
          setTimeout(() => { try { document.body.removeChild(iframe); } catch {} }, 2000);
        };
        if (iframe.contentWindow?.document.readyState === 'complete') setTimeout(triggerPrint, 200);
        else iframe.onload = () => setTimeout(triggerPrint, 200);
      } catch (err: any) {
        toast.error(`Impression échouée : ${err?.message || 'erreur'}`);
      }
    };
    const printer = getPrinterFor(cible);
    // Tentative QZ Tray d'abord (impression directe sans dialogue)
    printHtmlOrFallback(printer, html, fallback).then(() => {
      if (printer) toast.success(`🖨️ ${label} → ${printer}`);
    }).catch(fallback);
  };

  const printPrepTicket = (poste: string, lines: CartLine[], ctx: { tableNum: string; serveur: string; numero: string }) => {
    const t = tplCuisine;
    const headerTitle = escapeHtml(t?.header_title || 'SAADÉ');
    const subtitle = escapeHtml(t?.header_subtitle || POSTE_LABELS[poste] || poste.toUpperCase());
    const footer = escapeHtml(t?.footer_message || '');
    const fontPx = Number(t?.font_size_px) || 13;
    const paperMm = Number(t?.paper_width_mm) || 80;
    const date = new Date().toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
    const showPrices = !!t?.show_prices;
    const rows = lines.map(l => {
      const price = showPrices ? ` <span style="float:right;font-weight:normal;">${escapeHtml((l.produit.prix_vente || 0).toLocaleString('fr-FR'))} F</span>` : '';
      const opts = (l.options || []).map(o => `<div style="font-size:12px;font-weight:normal;padding-left:14px;">↳ ${escapeHtml(o.groupe_nom)}: <b>${escapeHtml(o.item_libelle)}</b></div>`).join('');
      return `<div class="big">${l.quantite}× ${escapeHtml(String(l.produit.nom).toUpperCase())}${price}</div>${opts}`;
    }).join('');
    const metaBits: string[] = [];
    if (t?.show_datetime !== false) metaBits.push(escapeHtml(date));
    if (t?.show_ticket_number !== false) metaBits.push(`N° ${escapeHtml(ctx.numero)}`);
    const html = `<html><head><title>BON ${escapeHtml(POSTE_LABELS[poste] || poste)}</title>
      <style>
        @page { size: ${paperMm}mm auto; margin: 2mm; }
        body { font-family: 'Courier New', monospace; padding: 0; margin: 0; width: ${paperMm - 4}mm; font-size: ${fontPx}px; color:#000; }
        .head { text-align:center; font-weight:bold; font-size:16px; border:2px solid #000; padding:4px; margin-bottom:6px; }
        .sub  { text-align:center; font-size:12px; font-weight:bold; letter-spacing:1px; margin-bottom:4px; }
        .info { display:flex; justify-content:space-between; font-size:11px; margin-bottom:4px; }
        .big { font-size: 16px; font-weight: bold; padding: 4px 0; border-bottom: 1px dashed #000; }
        hr { border:none; border-top:2px solid #000; margin:6px 0; }
        ${sanitizeCss(t?.extra_css)}
      </style></head><body>
      <div class="head">${headerTitle}</div>
      <div class="sub">--- ${subtitle} ---</div>
      ${metaBits.length ? `<div class="info">${metaBits.map(m => `<span>${m}</span>`).join('')}</div>` : ''}
      ${(t?.show_table !== false || t?.show_serveur !== false) ? `<div class="info">${t?.show_table !== false ? `<span>Table: <b>${escapeHtml(ctx.tableNum)}</b></span>` : ''}${t?.show_serveur !== false ? `<span>Serveur: ${escapeHtml(ctx.serveur || '-')}</span>` : ''}</div>` : ''}
      <hr/>
      ${rows}
      <hr/>
      <div style="text-align:center;font-size:11px;">${footer || 'À PRÉPARER'}</div>
      </body></html>`;
    printViaIframe(html, `Bon ${POSTE_LABELS[poste] || poste}`, poste);
  };

  const printTicket = (data: any) => {
    if (!data) return;
    const v = data.vente;
    const lignes = data.lignes || [];
    const fmt = (n: number) => Number(n || 0).toLocaleString('fr-FR').replace(/,/g, ' ');
    const date = new Date(v.date_vente).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'medium' });
    const caissier = (user?.email || 'CAISSIER').split('@')[0].toUpperCase();
    const modeLabel = (PAYMENT_LABELS[v.mode_paiement as PaymentMode] || '').toUpperCase();
    const tableNum = tables.find(t => t.id === v.table_id)?.numero || '';
    const serveurMatch = (v.notes || '').match(/^\[Serveur: ([^\]]+)\]/);
    const serveurNom = serveurMatch ? serveurMatch[1] : '';

    const W = 42;
    const padRow = (left: string, right: string) => {
      const l = left.slice(0, W - right.length - 1);
      return l + ' '.repeat(Math.max(1, W - l.length - right.length)) + right;
    };
    const articlesHeader = padRow('ARTICLES', 'P.U  Qté   MONT');
    const articlesRows = lignes.map((l: any) => {
      const nom = String(l.produit_nom).toUpperCase();
      const c1 = nom.slice(0, 22).padEnd(22, ' ');
      const c2 = fmt(l.prix_unitaire).padStart(7, ' ') + ' ';
      const c3 = String(l.quantite).padStart(3, ' ') + ' ';
      const c4 = (Number(l.total_ligne) === 0 ? 'offert' : fmt(l.total_ligne)).padStart(8, ' ');
      const opts = (l.options || l.vente_ligne_options || []).map((o: any) =>
        `<div class="mono" style="font-size:11px;color:#333;padding-left:4px;">  ↳ ${escapeHtml(o.groupe_nom)}: ${escapeHtml(o.item_libelle)}</div>`
      ).join('');
      return `<div class="mono">${escapeHtml(c1 + c2 + c3 + c4)}</div>${opts}`;
    }).join('');

    const t = tplCaisse;
    const headerTitle = escapeHtml(t?.header_title || 'SAADÉ');
    const subtitle = escapeHtml(t?.header_subtitle || 'PÂTISSERIE · SNACK · CONCEPT STORE');
    const address = escapeHtml(t?.header_address || 'Lomé · Togo');
    const phone = escapeHtml(t?.header_phone || '');
    const footer = escapeHtml(t?.footer_message || 'Merci de votre visite');
    const legal = escapeHtml(t?.footer_legal || '');
    const fontPx = Number(t?.font_size_px) || 12;
    const paperMm = Number(t?.paper_width_mm) || 80;

    const html = `<html><head><title>Ticket ${escapeHtml(v.numero_ticket)}</title>
      <style>
        @page { size: ${paperMm}mm auto; margin: 2mm; }
        body { font-family: 'Courier New', monospace; padding: 0; margin: 0; width: ${paperMm - 4}mm; font-size: ${fontPx}px; line-height: 1.35; color: #000; }
        h2 { text-align: center; margin: 2px 0 0; font-family: Georgia, serif; font-size: 18px; font-weight: bold; }
        .sub { text-align: center; font-size: 11px; font-weight: bold; letter-spacing: 1px; }
        .addr { text-align: center; font-size: 11px; }
        hr { border: none; border-top: 1px solid #000; margin: 4px 0; }
        .row { display: flex; justify-content: space-between; gap: 4px; }
        .mono { white-space: pre; font-size: ${fontPx}px; }
        .total { font-weight: bold; }
        .footer { text-align: center; margin-top: 8px; font-size: 11px; }
        ${sanitizeCss(t?.extra_css)}
      </style></head><body>
      <h2>${headerTitle}</h2>
      ${subtitle ? `<div class="sub">${subtitle}</div>` : ''}
      ${address ? `<div class="addr">${address}</div>` : ''}
      ${phone ? `<div class="addr">${phone}</div>` : ''}
      ${(t?.show_datetime !== false || t?.show_ticket_number !== false) ? `<div class="row" style="font-size:11px;margin-top:2px;">${t?.show_datetime !== false ? `<span>${escapeHtml(date)}</span>` : '<span></span>'}${t?.show_ticket_number !== false ? `<span>Ticket N° ${escapeHtml(v.numero_ticket)}</span>` : ''}</div>` : ''}
      <div style="font-size:11px;">CLIENT : ${escapeHtml((v.client_nom || 'CLIENT CASH').toUpperCase())}</div>
      <hr/>
      <div class="mono">${escapeHtml(articlesHeader)}</div>
      ${articlesRows}
      <hr/>
      ${t?.show_prices !== false ? `
        <div class="row"><span>Montant TTC</span><span>${fmt(Number(v.total) + Number(v.remise_globale || 0))} CFA</span></div>
        <div class="row"><span>Remise</span><span>${fmt(v.remise_globale)} CFA</span></div>
        <div class="row total"><span>Net à payer</span><span>${fmt(v.total)} CFA</span></div>
      ` : ''}
      ${t?.show_payment_mode !== false ? `<div class="row"><span>${escapeHtml(modeLabel)}</span><span>${fmt(v.montant_recu)} CFA</span></div>` : ''}
      ${(t?.show_change !== false && Number(v.rendu) > 0) ? `<div class="row"><span>Relicat</span><span>${fmt(v.rendu)} CFA</span></div>` : ''}
      <hr/>
      ${(t?.show_serveur !== false || t?.show_table !== false) ? `<div style="font-size:11px;">${t?.show_serveur !== false ? `serveur : ${escapeHtml(serveurNom || '....')}   ` : ''}${t?.show_table !== false ? `table : ${escapeHtml(tableNum || '....')}` : ''}</div>` : ''}
      ${t?.show_caissier !== false ? `<div style="font-size:11px;">caissier : ${escapeHtml(caissier)}</div>` : ''}
      <hr/>
      <div class="footer">${footer}</div>
      ${legal ? `<div class="footer" style="font-size:10px;color:#444;">${legal}</div>` : ''}
      </body></html>`;
    printViaIframe(html, `Ticket caisse #${v.numero_ticket}`, 'caisse');
  };

  return (
    <div className="space-y-3">
      {/* Header session */}
      <Card>
        <CardContent className="p-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-heading font-bold flex items-center gap-2">Caisse</h1>
            {session ? (
              <p className="text-xs text-muted-foreground">Session ouverte depuis {new Date(session.ouvert_at).toLocaleTimeString('fr-FR')} · Fond {Number(session.fond_initial).toLocaleString()} F</p>
            ) : <p className="text-xs text-destructive">Caisse fermée · ouvrez une session pour encaisser</p>}
          </div>
          <div className="flex gap-2 flex-wrap">
            {session && (
              <Button size="sm" variant="outline" onClick={() => setTabsOpen(true)}>
                <Utensils className="h-4 w-4 mr-1" />Tickets en attente
                {openTabs.length > 0 && <Badge variant="secondary" className="ml-2">{openTabs.length}</Badge>}
              </Button>
            )}
            {!session && <Button size="sm" onClick={() => setOpenSessionDialog(true)}><Unlock className="h-4 w-4 mr-1" />Ouvrir caisse</Button>}
            {session && <Button size="sm" variant="secondary" onClick={() => setQuartDialog(true)}><Unlock className="h-4 w-4 mr-1" />Passer le quart</Button>}
            {session && <Button size="sm" variant="outline" onClick={() => setCloseSessionDialog(true)}><Lock className="h-4 w-4 mr-1" />Fermer caisse</Button>}
            <Button size="sm" variant="ghost" onClick={async () => {
              setQzDialog(true); setQzStatus('checking');
              const ok = await isQzAvailable();
              setQzStatus(ok ? 'ok' : 'ko');
              if (ok) setQzPrinters(await listPrinters());
            }}><Settings className="h-4 w-4 mr-1" />Imprimantes</Button>
          </div>
        </CardContent>
      </Card>

      {/* Sélecteur Table + Serveur */}
      {session && (
        <Card>
          <CardContent className="p-3 flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 flex-1 min-w-[180px]">
              <Label className="text-xs whitespace-nowrap">Table</Label>
              <Select value={tableId} onValueChange={setTableId}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="comptoir">Comptoir / À emporter</SelectItem>
                  {tables.map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      Table {t.numero}{t.zone ? ` · ${t.zone}` : ''} ({t.places}p)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 flex-1 min-w-[180px]">
              <Label className="text-xs whitespace-nowrap">Serveur</Label>
              <Input value={serveur} onChange={e => setServeur(e.target.value)} placeholder="Nom du serveur" className="h-9" />
            </div>
            {currentTabId && <Badge variant="outline" className="text-xs">Reprise ticket</Badge>}
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        <div className="flex gap-2 items-center">
          <div className="relative flex-1"><Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" /><Input placeholder="Rechercher…" value={search} onChange={e => setSearch(e.target.value)} className="pl-8" /></div>
        </div>
        <Tabs value={activeCat} onValueChange={setActiveCat}>
          <ScrollArea className="w-full whitespace-nowrap">
            <TabsList className="inline-flex w-max">
              <TabsTrigger value="all">Tous</TabsTrigger>
              {categories.map(c => <TabsTrigger key={c} value={c}>{c.replace(/_/g, ' ')}</TabsTrigger>)}
            </TabsList>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </Tabs>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 pb-24">
          {filtered.map(p => {
            const dispo = getStockDispo(p.id);
            const rupture = dispo !== null && dispo <= 0;
            const bas = dispo !== null && dispo > 0 && dispo <= 5;
            return (
              <button key={p.id} onClick={() => addToCart(p)} disabled={rupture}
                className={`relative border rounded-lg p-2 text-left transition-colors flex flex-col gap-1 active:scale-95 ${rupture ? 'opacity-50 cursor-not-allowed bg-muted' : 'hover:bg-accent hover:border-primary'}`}>
                <span className={`absolute top-1 right-1 z-10 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  dispo === null ? 'bg-muted-foreground/70 text-background'
                    : rupture ? 'bg-destructive text-destructive-foreground'
                    : bas ? 'bg-orange-500 text-white'
                    : 'bg-green-600 text-white'
                }`}>
                  {dispo === null ? 'Dispo' : rupture ? 'Rupture' : `${dispo}`}
                </span>
                {p.photo_url ? (
                  <img src={p.photo_url} alt={p.nom} className="w-full h-16 object-cover rounded" />
                ) : <div className="w-full h-16 bg-muted rounded flex items-center justify-center text-2xl">🍰</div>}
                <div className="text-xs font-medium line-clamp-2">{p.nom}</div>
                <div className="text-xs font-bold text-primary">{(p.prix_vente || 0).toLocaleString()} F</div>
              </button>
            );
          })}
          {filtered.length === 0 && <div className="col-span-full text-center text-muted-foreground py-6 text-sm">Aucun produit</div>}
        </div>
      </div>

      {/* Bulle panier flottante — identique sur mobile, tablette et PC */}
      {cart.length > 0 && (
        <Button onClick={() => setCartOpen(true)}
          className="fixed bottom-6 right-6 z-40 h-16 px-6 rounded-full shadow-2xl gap-2 text-base animate-fade-in">
          <ShoppingCart className="h-5 w-5" />
          <span className="font-bold">{totalTicket.toLocaleString()} F</span>
          <span className="bg-primary-foreground/20 px-2 py-0.5 rounded-full text-xs">{cart.reduce((s, l) => s + l.quantite, 0)}</span>
        </Button>
      )}

      <Sheet open={cartOpen} onOpenChange={setCartOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-4">
          <SheetHeader>
            <SheetTitle className="flex items-center justify-between">
              <span>Ticket en cours</span>
              {cart.length > 0 && <Button size="sm" variant="ghost" onClick={clearCart}>Vider</Button>}
            </SheetTitle>
          </SheetHeader>
          <ScrollArea className="flex-1 -mx-4 px-4 my-2">
            {cart.length === 0 && <div className="text-center text-muted-foreground py-12 text-sm">Cliquez sur des produits</div>}
            {cart.map((l, idx) => {
              const supp = (l.options || []).reduce((a, o) => a + (o.prix_supplement || 0), 0);
              const unit = (l.produit.prix_vente || 0) + supp;
              return (
              <div key={`${l.produit.id}-${idx}`} className="flex items-start gap-2 py-3 border-b">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{l.produit.nom}</div>
                  <div className="text-xs text-muted-foreground">{unit.toLocaleString()} F × {l.quantite}</div>
                  {(l.options || []).map((o, i) => (
                    <div key={i} className="text-xs italic text-muted-foreground pl-2">
                      ↳ {o.groupe_nom}: {o.item_libelle}{o.prix_supplement ? ` (+${o.prix_supplement.toLocaleString()} F)` : ''}
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setCart(c => c.map((x, i) => i === idx ? { ...x, quantite: Math.max(0, x.quantite - 1) } : x).filter(x => x.quantite > 0))}><Minus className="h-4 w-4" /></Button>
                  <span className="w-7 text-center font-medium">{l.quantite}</span>
                  <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setCart(c => c.map((x, i) => i === idx ? { ...x, quantite: x.quantite + 1 } : x))}><Plus className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setCart(c => c.filter((_, i) => i !== idx))}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </div>
              );
            })}
          </ScrollArea>
          <div className="space-y-3 pt-2 border-t">
            <div className="flex items-center gap-2">
              <Label className="text-sm whitespace-nowrap">Nom ticket</Label>
              <Input value={tabNom} onChange={e => setTabNom(e.target.value)} placeholder="ex : Mr Dupont, anniv table 4…" className="h-9" />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm">Remise</Label>
              <Input type="number" inputMode="decimal" value={remiseGlobale || ''} placeholder="0" onChange={e => setRemiseGlobale(Number(e.target.value) || 0)} />
            </div>
            <div className="flex justify-between text-2xl font-bold">
              <span>Total</span><span className="text-primary">{totalTicket.toLocaleString()} F</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="lg" disabled={!session || cart.length === 0 || holdTab.isPending} onClick={() => holdTab.mutate()}>
                <PauseCircle className="h-4 w-4 mr-1" />En attente
              </Button>
              <Button size="lg" disabled={!session || cart.length === 0} onClick={() => setPayOpen(true)}>Encaisser</Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" disabled={cart.length === 0} onClick={printCuisineFromCart}>
                <Utensils className="h-4 w-4 mr-1" />Bon Cuisine
              </Button>
              {lastTicket
                ? <Button variant="outline" onClick={() => printTicket(lastTicket)}><Printer className="h-4 w-4 mr-1" />Ticket Caisse</Button>
                : <Button variant="outline" disabled><Printer className="h-4 w-4 mr-1" />Ticket Caisse</Button>}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Tickets en attente */}
      <Dialog open={tabsOpen} onOpenChange={setTabsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Tickets en attente ({openTabs.length})</DialogTitle></DialogHeader>
          <div className="space-y-2 max-h-[60vh] overflow-auto">
            {openTabs.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Aucun ticket en attente</p>}
            {openTabs.map((tab: any) => {
              const t = tables.find(tt => tt.id === tab.table_id);
              const lignesCount = (tab.vente_lignes || []).length;
              const mNom = (tab.notes || '').match(/\[Nom:\s*([^\]]+)\]/);
              const customName = mNom ? mNom[1].trim() : '';
              const baseLabel = `Table ${t?.numero || 'Comptoir'} · #${tab.numero_ticket}`;
              return (
                <div key={tab.id} className="border rounded-lg p-3 flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{customName || baseLabel}</div>
                    <div className="text-xs text-muted-foreground">
                      {customName && <span className="mr-1">{baseLabel} · </span>}
                      {lignesCount} article{lignesCount > 1 ? 's' : ''} · {Number(tab.total).toLocaleString()} F
                      {tab.client_nom && ` · ${tab.client_nom}`}
                    </div>
                  </div>
                  <Button size="sm" onClick={() => resumeTab(tab)}>Reprendre</Button>
                  <Button size="icon" variant="ghost" onClick={() => cancelTab.mutate(tab.id)} disabled={cancelTab.isPending}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog paiement */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Encaissement · {totalTicket.toLocaleString()} F</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(PAYMENT_LABELS) as PaymentMode[]).map(m => (
                <Button key={m} variant={paymentMode === m ? 'default' : 'outline'} onClick={() => setPaymentMode(m)} className="h-auto py-2 text-xs">{PAYMENT_LABELS[m]}</Button>
              ))}
            </div>
            {paymentMode === 'especes' && (
              <>
                <div><Label>Montant reçu (F)</Label><Input type="number" value={montantRecu} onChange={e => setMontantRecu(Number(e.target.value) || 0)} /></div>
                <div className="text-sm">Rendu : <span className="font-bold text-primary">{rendu.toLocaleString()} F</span></div>
              </>
            )}
            {paymentMode === 'credit' && <div><Label>Nom du client</Label><Input value={clientNom} onChange={e => setClientNom(e.target.value)} placeholder="Obligatoire" /></div>}
            <div><Label>Notes (optionnel)</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)}>Annuler</Button>
            <Button onClick={() => validateSale.mutate()} disabled={validateSale.isPending || (paymentMode === 'credit' && !clientNom)}>Valider et imprimer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog ouverture caisse */}
      <Dialog open={openSessionDialog} onOpenChange={setOpenSessionDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Ouverture de caisse</DialogTitle></DialogHeader>
          <div><Label>Fond de caisse initial (F)</Label><Input type="number" value={fondInitial} onChange={e => setFondInitial(Number(e.target.value) || 0)} /></div>
          <DialogFooter><Button onClick={() => openSessionMut.mutate()}>Ouvrir</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog fermeture caisse */}
      <Dialog open={closeSessionDialog} onOpenChange={setCloseSessionDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Clôture de caisse</DialogTitle></DialogHeader>
          <div><Label>Espèces comptées en caisse (F)</Label><Input type="number" value={fondCompte} onChange={e => setFondCompte(Number(e.target.value) || 0)} /></div>
          <p className="text-xs text-muted-foreground">L'écart (théorique vs compté) sera enregistré automatiquement.</p>
          <DialogFooter><Button onClick={() => closeSessionMut.mutate()} variant="destructive">Fermer la caisse</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog passage de quart */}
      <Dialog open={quartDialog} onOpenChange={setQuartDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Passage de quart</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground">
            La session courante sera clôturée et une nouvelle session sera ouverte automatiquement
            avec le montant compté comme fond initial. Le caissier suivant pourra encaisser immédiatement.
          </p>
          <div><Label>Espèces comptées (F)</Label><Input type="number" value={fondCompte} onChange={e => setFondCompte(Number(e.target.value) || 0)} /></div>
          <div><Label>Motif / note (optionnel)</Label><Input value={quartMotif} onChange={e => setQuartMotif(e.target.value)} placeholder="Ex : Relève 14h" /></div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setQuartDialog(false)}>Annuler</Button>
            <Button onClick={() => passageQuartMut.mutate()}>Confirmer le passage</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog configuration imprimantes QZ Tray */}
      <Dialog open={qzDialog} onOpenChange={setQzDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Imprimantes (QZ Tray)</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            <div className={`p-2 rounded text-xs ${qzStatus === 'ok' ? 'bg-green-100 text-green-900' : qzStatus === 'ko' ? 'bg-orange-100 text-orange-900' : 'bg-muted'}`}>
              {qzStatus === 'checking' && 'Détection en cours…'}
              {qzStatus === 'ok' && `✅ QZ Tray détecté — ${qzPrinters.length} imprimante(s) trouvée(s). Impression directe activée.`}
              {qzStatus === 'ko' && '⚠️ QZ Tray non détecté. Installez-le depuis https://qz.io/download (impression passera par le dialogue navigateur).'}
            </div>
            {qzStatus === 'ok' && (
              <>
                <p className="text-xs text-muted-foreground">Associe chaque poste à une imprimante détectée :</p>
                {['caisse', 'chaud', 'froid'].map(cible => (
                  <div key={cible} className="flex items-center gap-2">
                    <Label className="w-20 capitalize">{cible}</Label>
                    <Select value={qzMap[cible] || '__none__'} onValueChange={v => {
                      const next = { ...qzMap, [cible]: v === '__none__' ? '' : v };
                      setQzMap(next);
                      localStorage.setItem('qz_printers', JSON.stringify(next));
                    }}>
                      <SelectTrigger><SelectValue placeholder="Choisir…" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— Aucune (dialogue navigateur) —</SelectItem>
                        {qzPrinters.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setQzDialog(false)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {optDialog && (
        <ProductOptionsDialog
          open={!!optDialog}
          onOpenChange={(v) => { if (!v) setOptDialog(null); }}
          produitNom={optDialog.produit.nom}
          groupes={optDialog.groupes}
          onConfirm={(choices) => addWithOptions(optDialog.produit, choices)}
        />
      )}

    </div>
  );
}
