import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput,
  CommandItem, CommandList, CommandSeparator,
} from '@/components/ui/command';
import { usePermissions, ModuleKey } from '@/hooks/usePermissions';
import {
  LayoutDashboard, FileText, Package, TrendingDown, ChefHat, ClipboardList,
  DollarSign, Wine, Settings, ShoppingCart, Bot, BookOpen,
  ScanLine, BarChart3, Package2, Users, Plus, History, LogOut,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface NavCmd { label: string; url: string; icon: any; module: ModuleKey; group?: string; }

const cmds: NavCmd[] = [
  { label: 'Tableau de bord', url: '/dashboard', icon: LayoutDashboard, module: 'dashboard', group: 'Pilotage' },
  { label: 'Assistant IA', url: '/insights', icon: Bot, module: 'insights', group: 'Pilotage' },
  { label: 'Ventes & Rapports', url: '/ventes', icon: BarChart3, module: 'ventes', group: 'Pilotage' },

  { label: 'Caisse / POS', url: '/pos', icon: ScanLine, module: 'pos', group: 'Vente' },
  { label: 'Clients & Crédits', url: '/clients', icon: Users, module: 'clients', group: 'Vente' },
  { label: 'Catalogue produits', url: '/catalogue', icon: Package2, module: 'catalogue', group: 'Vente' },

  { label: 'Achats matières premières', url: '/achats-mp', icon: ShoppingCart, module: 'achats_mp', group: 'Approvisionnement' },
  { label: 'Fiches techniques', url: '/fiches-techniques', icon: BookOpen, module: 'fiches_techniques', group: 'Approvisionnement' },
  { label: 'Bons de transfert', url: '/bons-transfert', icon: FileText, module: 'bons_transfert', group: 'Approvisionnement' },
  { label: 'Stock tampon', url: '/stock-tampon', icon: Package, module: 'stock_tampon', group: 'Approvisionnement' },

  { label: 'Production labo', url: '/production', icon: ChefHat, module: 'production', group: 'Opérations' },
  { label: 'Pertes', url: '/pertes', icon: TrendingDown, module: 'pertes', group: 'Opérations' },
  { label: 'Inventaire', url: '/inventaire', icon: ClipboardList, module: 'inventaire', group: 'Opérations' },
  { label: 'Clôture journalière', url: '/cloture', icon: DollarSign, module: 'cloture', group: 'Opérations' },
  { label: 'Dégustations', url: '/degustations', icon: Wine, module: 'degustations', group: 'Opérations' },

  { label: 'Administration', url: '/admin', icon: Settings, module: 'admin', group: 'Système' },
  { label: "Journal d'audit", url: '/audit', icon: History, module: 'admin', group: 'Système' },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { canAccess } = usePermissions();
  const { signOut } = useAuth();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(o => !o);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const go = (url: string) => { navigate(url); setOpen(false); };
  const visible = cmds.filter(c => canAccess(c.module));
  const groups = Array.from(new Set(visible.map(c => c.group || 'Navigation')));

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Rechercher un module ou une action…" />
      <CommandList>
        <CommandEmpty>Aucun résultat.</CommandEmpty>

        {canAccess('pos') && (
          <CommandGroup heading="Actions rapides">
            <CommandItem onSelect={() => go('/pos')}>
              <ScanLine className="mr-2 h-4 w-4 text-primary" /> Ouvrir la caisse
            </CommandItem>
            {canAccess('catalogue') && (
              <CommandItem onSelect={() => go('/catalogue')}>
                <Plus className="mr-2 h-4 w-4 text-primary" /> Ajouter un produit
              </CommandItem>
            )}
            {canAccess('clients') && (
              <CommandItem onSelect={() => go('/clients')}>
                <Users className="mr-2 h-4 w-4 text-primary" /> Voir les ardoises clients
              </CommandItem>
            )}
          </CommandGroup>
        )}

        {groups.map(g => (
          <div key={g}>
            <CommandSeparator />
            <CommandGroup heading={g}>
              {visible.filter(c => (c.group || 'Navigation') === g).map(c => {
                const Icon = c.icon;
                return (
                  <CommandItem key={c.url} onSelect={() => go(c.url)}>
                    <Icon className="mr-2 h-4 w-4" />
                    <span>{c.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </div>
        ))}

        <CommandSeparator />
        <CommandGroup heading="Compte">
          <CommandItem onSelect={() => { signOut(); setOpen(false); }}>
            <LogOut className="mr-2 h-4 w-4" /> Se déconnecter
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
