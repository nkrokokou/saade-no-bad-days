import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth, UserRole } from '@/contexts/AuthContext';

export type ModuleKey =
  | 'dashboard' | 'insights' | 'admin' | 'catalogue'
  | 'pos' | 'ventes'
  | 'achats_mp' | 'fiches_techniques' | 'bons_transfert'
  | 'stock_tampon' | 'pertes' | 'production'
  | 'inventaire' | 'cloture' | 'degustations';

export type Action = 'read' | 'create' | 'update' | 'delete';

export interface ModulePermission {
  role: UserRole;
  module: ModuleKey;
  can_read: boolean;
  can_create: boolean;
  can_update: boolean;
  can_delete: boolean;
}

interface State {
  roles: UserRole[];
  permissions: ModulePermission[];
  loading: boolean;
}

export function usePermissions() {
  const { user } = useAuth();
  const [state, setState] = useState<State>({ roles: [], permissions: [], loading: true });

  const load = useCallback(async () => {
    if (!user) {
      setState({ roles: [], permissions: [], loading: false });
      return;
    }
    const [rolesRes, permsRes] = await Promise.all([
      supabase.from('user_roles').select('role').eq('user_id', user.id),
      supabase.from('module_permissions').select('*'),
    ]);
    const roles = (rolesRes.data || []).map((r: any) => r.role as UserRole);
    const permissions = (permsRes.data || []) as ModulePermission[];
    setState({ roles, permissions, loading: false });
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const isCeo = state.roles.includes('ceo');

  const can = useCallback((module: ModuleKey, action: Action = 'read'): boolean => {
    if (isCeo) return true;
    return state.permissions.some(p =>
      state.roles.includes(p.role) && p.module === module && p[`can_${action}` as keyof ModulePermission] === true
    );
  }, [state.permissions, state.roles, isCeo]);

  const canAccess = useCallback((module: ModuleKey) => can(module, 'read'), [can]);

  return { ...state, isCeo, can, canAccess, refresh: load };
}
