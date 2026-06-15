
-- 1) Seed module 'bon_attente' for known roles (uses existing app_role enum values present in DB)
INSERT INTO public.module_permissions (role, module, can_read, can_create, can_update, can_delete)
SELECT r::app_role, 'bon_attente', true, true, true, true
FROM (VALUES ('ceo'), ('developer'), ('salle')) AS roles(r)
WHERE EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid=t.oid WHERE t.typname='app_role' AND e.enumlabel = roles.r)
ON CONFLICT DO NOTHING;

INSERT INTO public.module_permissions (role, module, can_read, can_create, can_update, can_delete)
SELECT r::app_role, 'bon_attente', true, false, false, false
FROM (VALUES ('labo_patisserie'),('labo_viennoiserie'),('cuisine_salee'),('economat'),('caissier'),('manager')) AS roles(r)
WHERE EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid=t.oid WHERE t.typname='app_role' AND e.enumlabel = roles.r)
ON CONFLICT DO NOTHING;

-- 2) New DELETE policies: allow deletion of EN_COURS tickets to users with 'bon_attente'.'delete'
DROP POLICY IF EXISTS "perm delete ventes en attente" ON public.ventes;
CREATE POLICY "perm delete ventes en attente" ON public.ventes
  FOR DELETE TO authenticated
  USING (statut = 'en_cours' AND public.can_perform(auth.uid(), 'bon_attente', 'delete'));

DROP POLICY IF EXISTS "perm delete vlignes en attente" ON public.vente_lignes;
CREATE POLICY "perm delete vlignes en attente" ON public.vente_lignes
  FOR DELETE TO authenticated
  USING (
    public.can_perform(auth.uid(), 'bon_attente', 'delete')
    AND EXISTS (SELECT 1 FROM public.ventes v WHERE v.id = vente_id AND v.statut = 'en_cours')
  );

DROP POLICY IF EXISTS "perm delete vopts en attente" ON public.vente_ligne_options;
CREATE POLICY "perm delete vopts en attente" ON public.vente_ligne_options
  FOR DELETE TO authenticated
  USING (
    public.can_perform(auth.uid(), 'bon_attente', 'delete')
    AND EXISTS (
      SELECT 1 FROM public.vente_lignes vl
      JOIN public.ventes v ON v.id = vl.vente_id
      WHERE vl.id = vente_ligne_id AND v.statut = 'en_cours'
    )
  );
