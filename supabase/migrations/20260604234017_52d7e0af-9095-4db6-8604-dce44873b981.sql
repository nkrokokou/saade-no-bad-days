
-- 1. Tighten audit_logs INSERT: only allow inserting own user_id (triggers use SECURITY DEFINER so bypass RLS)
DROP POLICY IF EXISTS "Audit insert own or trigger" ON public.audit_logs;
CREATE POLICY "Audit insert own"
  ON public.audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 2. Restrict module_permissions SELECT: users only see permissions for their own roles; CEO sees all
DROP POLICY IF EXISTS "All read permissions" ON public.module_permissions;
CREATE POLICY "Users read own role permissions"
  ON public.module_permissions
  FOR SELECT
  TO authenticated
  USING (
    public.is_ceo(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = module_permissions.role
    )
  );
