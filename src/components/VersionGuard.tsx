import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

/**
 * Détecte qu'une nouvelle version a été déployée et propose à l'utilisateur
 * de purger les caches + service workers et recharger la page.
 * Compare le hash de version exposé par Vite à un fichier statique /version.json
 * mis à jour à chaque build.
 */
export function VersionGuard() {
  // Hash courant injecté au build par Vite (defined dans vite.config.ts)
  const currentVersion = (import.meta.env.VITE_BUILD_ID as string) || 'dev';
  const [newVersion, setNewVersion] = useState<string | null>(null);
  const dismissedRef = useRef(false);

  useEffect(() => {
    if (currentVersion === 'dev') return;
    let cancelled = false;

    const check = async () => {
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        const remote = json?.buildId as string | undefined;
        if (cancelled || !remote || remote === currentVersion) return;
        if (!dismissedRef.current) setNewVersion(remote);
      } catch { /* ignore */ }
    };

    check();
    const id = setInterval(check, 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [currentVersion]);

  const reload = async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    } catch { /* ignore */ }
    try {
      const regs = await navigator.serviceWorker?.getRegistrations?.();
      if (regs) await Promise.all(regs.map(r => r.unregister()));
    } catch { /* ignore */ }
    // Cache-bust ultime : reload avec timestamp
    window.location.href = window.location.pathname + '?_v=' + Date.now();
  };

  if (!newVersion) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm bg-primary text-primary-foreground rounded-lg shadow-lg p-4 flex items-center gap-3 animate-fade-in">
      <div className="flex-1">
        <div className="font-semibold text-sm">Nouvelle version disponible</div>
        <div className="text-xs opacity-90">Rechargez pour récupérer les dernières mises à jour.</div>
      </div>
      <Button size="sm" variant="secondary" onClick={reload}>
        <RefreshCw className="h-3.5 w-3.5 mr-1" /> Recharger
      </Button>
      <button
        className="text-xs opacity-70 hover:opacity-100 ml-1"
        onClick={() => { dismissedRef.current = true; setNewVersion(null); }}
        aria-label="Ignorer"
      >✕</button>
    </div>
  );
}
