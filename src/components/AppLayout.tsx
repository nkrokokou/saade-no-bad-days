import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions, ModuleKey } from '@/hooks/usePermissions';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { ThemeToggle } from '@/components/ThemeToggle';
import { CommandPalette } from '@/components/CommandPalette';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Search } from 'lucide-react';

export function AppLayout({ module }: { module?: ModuleKey }) {
  const { profile, loading: authLoading, session } = useAuth();
  const { canAccess, loading: permLoading } = usePermissions();

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

  return (
    <SidebarProvider>
      <CommandPalette />
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center border-b bg-card px-4 sticky top-0 z-10">
            <SidebarTrigger className="mr-4" />
            <h2 className="text-lg font-heading font-semibold text-foreground">SAADÉ</h2>
            <span className="ml-2 text-xs text-muted-foreground hidden sm:inline">Laboratoire & Boutique</span>
            <div className="ml-auto flex items-center gap-1">
              <Button variant="ghost" size="sm" className="text-muted-foreground hidden md:flex items-center gap-2" onClick={openPalette}>
                <Search className="h-4 w-4" />
                <span className="text-xs">Rechercher</span>
                <kbd className="ml-2 text-[10px] bg-muted px-1.5 py-0.5 rounded">⌘K</kbd>
              </Button>
              <Button variant="ghost" size="icon" className="md:hidden" onClick={openPalette}>
                <Search className="h-4 w-4" />
              </Button>
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
