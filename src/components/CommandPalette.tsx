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
} from 'lucide-react';

interface NavCmd { label: string; url: string; icon: any; module: ModuleKey; }

const cmds: NavCmd[] = [
  { label: 'Tableau de bord', url: '/dashboard', icon: LayoutDashboard, module: 'dashboard' },
  { label: 'Assistant IA', url: '/insights', icon: Bot, module: 'insights' },
  { label: 'Achats matières premières', url: '/achats-mp', icon: ShoppingCart, module: 'achats_mp' },
  { label: 'Fiches techniques', url: '/fiches-techniques', icon: BookOpen, module: 'fiches_techniques' },
  { label: 'Bons de transfert', url: '/bons-transfert', icon: FileText, module: 'bons_transfert' },
  { label: 'Stock tampon', url: '/stock-tampon', icon: Package, module: 'stock_tampon' },
  { label: 'Pertes', url: '/pertes', icon: TrendingDown, module: 'pertes' },
  { label: 'Production labo', url: '/production', icon: ChefHat, module: 'production' },
  { label: 'Inventaire', url: '/inventaire', icon: ClipboardList, module: 'inventaire' },
  { label: 'Clôture journalière', url: '/cloture', icon: DollarSign, module: 'cloture' },
  { label: 'Dégustations', url: '/degustations', icon: Wine, module: 'degustations' },
  { label: 'Administration', url: '/admin', icon: Settings, module: 'admin' },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { canAccess } = usePermissions();

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

  const visible = cmds.filter(c => canAccess(c.module));

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Tapez pour rechercher un module..." />
      <CommandList>
        <CommandEmpty>Aucun résultat.</CommandEmpty>
        <CommandGroup heading="Navigation">
          {visible.map(c => {
            const Icon = c.icon;
            return (
              <CommandItem key={c.url} onSelect={() => { navigate(c.url); setOpen(false); }}>
                <Icon className="mr-2 h-4 w-4" />
                <span>{c.label}</span>
              </CommandItem>
            );
          })}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Astuce">
          <div className="px-3 py-2 text-xs text-muted-foreground">⌘ + K pour rouvrir cette palette à tout moment</div>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
