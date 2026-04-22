import {
  LayoutDashboard, FileText, Package, TrendingDown,
  ChefHat, ClipboardList, LogOut, Crown, Cake, Croissant, UtensilsCrossed, Bell,
  DollarSign, Wine, Settings, ShoppingCart, Bot, BookOpen, History,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NavLink } from '@/components/NavLink';
import { useAuth, UserRole } from '@/contexts/AuthContext';
import { usePermissions, ModuleKey } from '@/hooks/usePermissions';
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

interface NavItem { title: string; url: string; icon: React.ElementType; module: ModuleKey; }


export function AppSidebar() {
  const { profile, signOut } = useAuth();
  const { canAccess, roles, loading } = usePermissions();
  const { state } = useSidebar();
  const { t } = useTranslation();
  const collapsed = state === 'collapsed';

  const navItems: NavItem[] = [
    { title: t('nav.dashboard'), url: '/dashboard', icon: LayoutDashboard, module: 'dashboard' },
    { title: t('nav.insights'), url: '/insights', icon: Bot, module: 'insights' },
    { title: t('nav.achats'), url: '/achats-mp', icon: ShoppingCart, module: 'achats_mp' },
    { title: t('nav.fiches'), url: '/fiches-techniques', icon: BookOpen, module: 'fiches_techniques' },
    { title: t('nav.bons'), url: '/bons-transfert', icon: FileText, module: 'bons_transfert' },
    { title: t('nav.stock'), url: '/stock-tampon', icon: Package, module: 'stock_tampon' },
    { title: t('nav.pertes'), url: '/pertes', icon: TrendingDown, module: 'pertes' },
    { title: t('nav.production'), url: '/production', icon: ChefHat, module: 'production' },
    { title: t('nav.inventaire'), url: '/inventaire', icon: ClipboardList, module: 'inventaire' },
    { title: t('nav.cloture'), url: '/cloture', icon: DollarSign, module: 'cloture' },
    { title: t('nav.degustations'), url: '/degustations', icon: Wine, module: 'degustations' },
    { title: t('nav.admin'), url: '/admin', icon: Settings, module: 'admin' },
    { title: t('nav.audit'), url: '/audit', icon: History, module: 'admin' },
  ];

  if (!profile || loading) return null;

  const visibleItems = navItems.filter(i => canAccess(i.module));
  const primaryRole = roles[0] || profile.role;
  const RoleIcon = roleIcons[primaryRole as UserRole] || Bell;

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <div className="px-4 py-6 border-b border-sidebar-border">
          {!collapsed && <h1 className="text-2xl font-heading font-bold text-sidebar-primary tracking-wide">SAADÉ</h1>}
          {collapsed && <h1 className="text-lg font-heading font-bold text-sidebar-primary text-center">S</h1>}
          {!collapsed && (
            <div className="mt-3 flex items-center gap-2">
              <RoleIcon className="h-4 w-4 text-sidebar-primary" />
              <span className="text-xs text-sidebar-foreground/70">{roles.map(r => roleLabels[r]).join(' · ') || roleLabels[profile.role]}</span>
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
            <LogOut className="h-4 w-4" />{!collapsed && <span className="ml-2">{t('nav.logout')}</span>}
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
