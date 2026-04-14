import { useLocation } from 'react-router-dom';
import {
  LayoutDashboard, FileText, Package, TrendingDown,
  ChefHat, ClipboardList, LogOut, Crown, Cake, Croissant, UtensilsCrossed, Bell,
  DollarSign, Wine, Settings, ShoppingCart, Bot, BookOpen,
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useAuth, UserRole } from '@/contexts/AuthContext';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarFooter, useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';

const roleIcons: Record<UserRole, React.ElementType> = {
  ceo: Crown, labo_patisserie: Cake, labo_viennoiserie: Croissant,
  cuisine_salee: UtensilsCrossed, salle: Bell,
};

const roleLabels: Record<UserRole, string> = {
  ceo: 'CEO', labo_patisserie: 'Labo Pâtisserie', labo_viennoiserie: 'Labo Viennoiserie',
  cuisine_salee: 'Cuisine Salée', salle: 'Salle',
};

interface NavItem { title: string; url: string; icon: React.ElementType; roles: UserRole[]; }

const navItems: NavItem[] = [
  { title: 'Tableau de bord', url: '/dashboard', icon: LayoutDashboard, roles: ['ceo'] },
  { title: 'Assistant IA', url: '/insights', icon: Bot, roles: ['ceo'] },
  { title: 'Achats MP', url: '/achats-mp', icon: ShoppingCart, roles: ['ceo', 'labo_patisserie', 'labo_viennoiserie', 'cuisine_salee'] },
  { title: 'Fiches Techniques', url: '/fiches-techniques', icon: BookOpen, roles: ['ceo', 'labo_patisserie', 'labo_viennoiserie'] },
  { title: 'Bons de Transfert', url: '/bons-transfert', icon: FileText, roles: ['ceo', 'labo_patisserie', 'labo_viennoiserie', 'salle'] },
  { title: 'Stock Tampon', url: '/stock-tampon', icon: Package, roles: ['ceo', 'labo_patisserie', 'labo_viennoiserie', 'cuisine_salee'] },
  { title: 'Pertes', url: '/pertes', icon: TrendingDown, roles: ['ceo', 'labo_patisserie', 'labo_viennoiserie', 'cuisine_salee'] },
  { title: 'Production Labo', url: '/production', icon: ChefHat, roles: ['ceo', 'labo_patisserie', 'labo_viennoiserie'] },
  { title: 'Inventaire', url: '/inventaire', icon: ClipboardList, roles: ['ceo', 'cuisine_salee'] },
  { title: 'Clôture & Salle', url: '/cloture', icon: DollarSign, roles: ['ceo', 'salle'] },
  { title: 'Dégustations', url: '/degustations', icon: Wine, roles: ['ceo', 'salle'] },
  { title: 'Administration', url: '/admin', icon: Settings, roles: ['ceo'] },
];

export function AppSidebar() {
  const { profile, signOut } = useAuth();
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';

  if (!profile) return null;

  const visibleItems = navItems.filter(i => i.roles.includes(profile.role));
  const RoleIcon = roleIcons[profile.role];

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <div className="px-4 py-6 border-b border-sidebar-border">
          {!collapsed && <h1 className="text-2xl font-heading font-bold text-sidebar-primary tracking-wide">SAADÉ</h1>}
          {collapsed && <h1 className="text-lg font-heading font-bold text-sidebar-primary text-center">S</h1>}
          {!collapsed && (
            <div className="mt-3 flex items-center gap-2">
              <RoleIcon className="h-4 w-4 text-sidebar-primary" />
              <span className="text-xs text-sidebar-foreground/70">{roleLabels[profile.role]}</span>
            </div>
          )}
        </div>

        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleItems.map(item => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} end={item.url === '/dashboard'} className="hover:bg-sidebar-accent" activeClassName="bg-sidebar-accent text-sidebar-primary font-medium">
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        {!collapsed && <div className="px-4 pb-2"><p className="text-xs text-sidebar-foreground/50 truncate">{profile.full_name}</p></div>}
        <div className="px-2 pb-4">
          <Button variant="ghost" size={collapsed ? 'icon' : 'sm'} className="w-full text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent" onClick={signOut}>
            <LogOut className="h-4 w-4" />{!collapsed && <span className="ml-2">Déconnexion</span>}
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
