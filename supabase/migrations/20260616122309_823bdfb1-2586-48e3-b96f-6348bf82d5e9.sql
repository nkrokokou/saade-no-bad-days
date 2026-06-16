
-- Fix audits_ceo policies to use is_ceo() (user_roles) instead of profiles.role
DROP POLICY IF EXISTS "CEO can view audits" ON public.audits_ceo;
DROP POLICY IF EXISTS "CEO can insert audits" ON public.audits_ceo;
DROP POLICY IF EXISTS "CEO can update audits" ON public.audits_ceo;
DROP POLICY IF EXISTS "CEO can delete audits" ON public.audits_ceo;

CREATE POLICY "CEO can view audits" ON public.audits_ceo FOR SELECT USING (public.is_ceo(auth.uid()));
CREATE POLICY "CEO can insert audits" ON public.audits_ceo FOR INSERT WITH CHECK (public.is_ceo(auth.uid()));
CREATE POLICY "CEO can update audits" ON public.audits_ceo FOR UPDATE USING (public.is_ceo(auth.uid())) WITH CHECK (public.is_ceo(auth.uid()));
CREATE POLICY "CEO can delete audits" ON public.audits_ceo FOR DELETE USING (public.is_ceo(auth.uid()));

-- Remove permissive SELECT policy that bypasses the permission-based one
DROP POLICY IF EXISTS "Auth read vente opts" ON public.vente_ligne_options;
