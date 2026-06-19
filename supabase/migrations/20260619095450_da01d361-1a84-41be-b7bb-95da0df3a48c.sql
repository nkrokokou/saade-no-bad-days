ALTER VIEW public.v_mp_stock SET (security_invoker = true);

DROP POLICY IF EXISTS mp_mvt_insert_auth ON public.mp_mouvements;
CREATE POLICY mp_mvt_insert_ceo ON public.mp_mouvements
  FOR INSERT TO authenticated
  WITH CHECK (public.is_ceo(auth.uid()));

CREATE POLICY notifications_insert_ceo ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (public.is_ceo(auth.uid()));