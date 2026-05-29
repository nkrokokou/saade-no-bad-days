
REVOKE ALL ON FUNCTION public.log_audit_change() FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "Authenticated can insert audit" ON public.audit_logs;
CREATE POLICY "Audit insert own or trigger"
  ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR auth.uid() IS NULL);
