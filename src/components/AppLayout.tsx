import { useEffect, useRef } from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions, ModuleKey } from '@/hooks/usePermissions';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { CommandPalette } from '@/components/CommandPalette';
import { NotificationBell } from '@/components/NotificationBell';

import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

import { Skeleton } from '@/components/ui/skeleton';
import { Search, ScanLine } from 'lucide-react';

// Timeout d'inactivité (30 min) — déconnecte automatiquement
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const IDLE_WARN_MS = 28 * 60 * 1000;

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Tableau de bord',
  '/insights': 'Assistant IA',
  '/pos': 'Caisse / POS',
  '/ventes': 'Ventes & Rapports',
  '/clients': 'Clients & Crédits',
  '/catalogue': 'Catalogue produits',
  '/achats-mp': 'Achats matières premières',
  '/fiches-techniques': 'Fiches techniques',
  '/bons-transfert': 'Bons de transfert',
  '/stock-tampon': 'Stock tampon',
  '/pertes': 'Pertes',
  '/production': 'Production labo',
  '/inventaire': 'Inventaire',
  '/cloture': 'Clôture journalière',
  '/degustations': 'Dégustations',
  '/admin': 'Administration',
  '/audit': "Journal d'audit",
  '/rapports-ceo': 'Rapports CEO',
  '/caisses-live': 'Caisses (temps réel)',
};

export function AppLayout({ module }: { module?: ModuleKey }) {
  const { profile, loading: authLoading, session, signOut } = useAuth();
  const { canAccess, loading: permLoading, roles } = usePermissions();
  const location = useLocation();
  const navigate = useNavigate();
  const warnedRef = useRef(false);

  // Auto-déconnexion sur inactivité (30 min)
  useEffect(() => {
    if (!session) return;
    let lastActivity = Date.now();
    warnedRef.current = false;
    const markActive = () => { lastActivity = Date.now(); warnedRef.current = false; };
    const events = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'];
    events.forEach(e => window.addEventListener(e, markActive, { passive: true }));
    const interval = setInterval(() => {
      const idle = Date.now() - lastActivity;
      if (idle >= IDLE_TIMEOUT_MS) {
        toast.error('Session expirée pour inactivité — reconnexion requise');
        signOut();
      } else if (idle >= IDLE_WARN_MS && !warnedRef.current) {
        warnedRef.current = true;
        toast.warning('Vous serez déconnecté dans 2 minutes pour inactivité');
      }
    }, 30_000);
    return () => {
      clearInterval(interval);
      events.forEach(e => window.removeEventListener(e, markActive));
    };
  }, [session, signOut]);

  if (authLoading || permLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="space-y-4 w-64">
          <Skeleton className="h-8 w-48 mx-auto" />
          <Skeleton className="h-4 w-32 mx-auto" />
        </div>
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;
  if (!profile) return <Navigate to="/login" replace />;
  if (module && !canAccess(module)) return <Navigate to="/unauthorized" replace />;

  const openPalette = () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
  };

  const pageTitle = PAGE_TITLES[location.pathname] || 'SAADÉ';
  const primaryRole = roles[0] || profile.role;

  return (
    <SidebarProvider>
      
      <CommandPalette />
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center border-b bg-card/80 backdrop-blur supports-[backdrop-filter]:bg-card/60 px-3 sm:px-4 sticky top-0 z-20">
            <SidebarTrigger className="mr-2 sm:mr-3" />
            <div className="min-w-0 flex-1">
              <h2 className="text-base sm:text-lg font-heading font-semibold text-foreground truncate">{pageTitle}</h2>
              <p className="text-[10px] text-muted-foreground hidden sm:block leading-none">SAADÉ · {primaryRole.replace(/_/g, ' ')}</p>
            </div>
            <div className="ml-auto flex items-center gap-1">
              {canAccess('pos') && location.pathname !== '/pos' && (
                <Button variant="default" size="sm" className="hidden sm:inline-flex" onClick={() => navigate('/pos')}>
                  <ScanLine className="h-4 w-4 mr-1" />Caisse
                </Button>
              )}
              <Button variant="ghost" size="sm" className="text-muted-foreground hidden md:inline-flex items-center gap-2" onClick={openPalette}>
                <Search className="h-4 w-4" />
                <span className="text-xs">Rechercher</span>
                <kbd className="ml-2 text-[10px] bg-muted px-1.5 py-0.5 rounded">⌘K</kbd>
              </Button>
              <Button variant="ghost" size="icon" className="md:hidden" onClick={openPalette} aria-label="Rechercher">
                <Search className="h-4 w-4" />
              </Button>
              <NotificationBell />
              <LanguageSwitcher />
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 p-3 sm:p-4 md:p-6 animate-fade-in tap-highlight safe-bottom">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

