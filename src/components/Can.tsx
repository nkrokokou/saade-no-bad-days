import { ReactNode } from 'react';
import { usePermissions, ModuleKey, Action } from '@/hooks/usePermissions';

interface CanProps {
  module: ModuleKey;
  action?: Action;
  fallback?: ReactNode;
  children: ReactNode;
}

/** Conditionally render children based on user permission for a given module/action. */
export function Can({ module, action = 'read', fallback = null, children }: CanProps) {
  const { can, loading } = usePermissions();
  if (loading) return null;
  return can(module, action) ? <>{children}</> : <>{fallback}</>;
}
