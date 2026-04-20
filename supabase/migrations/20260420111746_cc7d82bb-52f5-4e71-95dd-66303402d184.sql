-- 1. Enum des rôles
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('ceo', 'labo_patisserie', 'labo_viennoiserie', 'cuisine_salee', 'salle');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2. Table user_roles (séparée de profiles)
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. Table matrice permissions
CREATE TABLE IF NOT EXISTS public.module_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role public.app_role NOT NULL,
  module text NOT NULL,
  can_read boolean NOT NULL DEFAULT false,
  can_create boolean NOT NULL DEFAULT false,
  can_update boolean NOT NULL DEFAULT false,
  can_delete boolean NOT NULL DEFAULT false,
  UNIQUE(role, module)
);

ALTER TABLE public.module_permissions ENABLE ROW LEVEL SECURITY;

-- 4. Security definer functions
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_ceo(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'ceo'::public.app_role)
$$;

CREATE OR REPLACE FUNCTION public.can_perform(_user_id uuid, _module text, _action text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  allowed boolean := false;
BEGIN
  IF public.is_ceo(_user_id) THEN RETURN true; END IF;
  SELECT CASE _action
    WHEN 'read'   THEN bool_or(can_read)
    WHEN 'create' THEN bool_or(can_create)
    WHEN 'update' THEN bool_or(can_update)
    WHEN 'delete' THEN bool_or(can_delete)
    ELSE false
  END INTO allowed
  FROM public.module_permissions mp
  JOIN public.user_roles ur ON ur.role = mp.role
  WHERE ur.user_id = _user_id AND mp.module = _module;
  RETURN COALESCE(allowed, false);
END $$;

-- 5. RLS sur user_roles & module_permissions
DROP POLICY IF EXISTS "Users read own roles" ON public.user_roles;
CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_ceo(auth.uid()));
DROP POLICY IF EXISTS "CEO manages roles" ON public.user_roles;
CREATE POLICY "CEO manages roles" ON public.user_roles FOR ALL TO authenticated USING (public.is_ceo(auth.uid())) WITH CHECK (public.is_ceo(auth.uid()));

DROP POLICY IF EXISTS "All read permissions" ON public.module_permissions;
CREATE POLICY "All read permissions" ON public.module_permissions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "CEO manages permissions" ON public.module_permissions;
CREATE POLICY "CEO manages permissions" ON public.module_permissions FOR ALL TO authenticated USING (public.is_ceo(auth.uid())) WITH CHECK (public.is_ceo(auth.uid()));

-- 6. Migration des rôles existants profiles → user_roles
INSERT INTO public.user_roles (user_id, role)
SELECT id, role::public.app_role FROM public.profiles
WHERE role IN ('ceo','labo_patisserie','labo_viennoiserie','cuisine_salee','salle')
ON CONFLICT (user_id, role) DO NOTHING;

-- 7. Trigger : créer rôle "salle" par défaut à l'inscription
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'salle'::public.app_role)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_created_role ON auth.users;
CREATE TRIGGER on_auth_user_created_role AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();

-- 8. Seed matrice permissions
INSERT INTO public.module_permissions (role, module, can_read, can_create, can_update, can_delete) VALUES
  -- CEO : tout (mais on garde le bypass via is_ceo)
  ('ceo','dashboard',true,true,true,true),
  ('ceo','insights',true,true,true,true),
  ('ceo','admin',true,true,true,true),
  ('ceo','achats_mp',true,true,true,true),
  ('ceo','fiches_techniques',true,true,true,true),
  ('ceo','bons_transfert',true,true,true,true),
  ('ceo','stock_tampon',true,true,true,true),
  ('ceo','pertes',true,true,true,true),
  ('ceo','production',true,true,true,true),
  ('ceo','inventaire',true,true,true,true),
  ('ceo','cloture',true,true,true,true),
  ('ceo','degustations',true,true,true,true),
  -- LABO PÂTISSERIE
  ('labo_patisserie','achats_mp',true,true,true,false),
  ('labo_patisserie','fiches_techniques',true,true,true,true),
  ('labo_patisserie','bons_transfert',true,true,true,false),
  ('labo_patisserie','stock_tampon',true,true,true,false),
  ('labo_patisserie','pertes',true,true,true,false),
  ('labo_patisserie','production',true,true,true,false),
  -- LABO VIENNOISERIE
  ('labo_viennoiserie','achats_mp',true,true,true,false),
  ('labo_viennoiserie','fiches_techniques',true,true,true,true),
  ('labo_viennoiserie','bons_transfert',true,true,true,false),
  ('labo_viennoiserie','stock_tampon',true,true,true,false),
  ('labo_viennoiserie','pertes',true,true,true,false),
  ('labo_viennoiserie','production',true,true,true,false),
  -- CUISINE SALÉE
  ('cuisine_salee','achats_mp',true,true,true,false),
  ('cuisine_salee','stock_tampon',true,true,true,false),
  ('cuisine_salee','pertes',true,true,true,false),
  ('cuisine_salee','inventaire',true,true,true,true),
  -- SALLE
  ('salle','bons_transfert',true,false,true,false),
  ('salle','fiches_techniques',true,false,false,false),
  ('salle','cloture',true,true,true,false),
  ('salle','degustations',true,true,true,false)
ON CONFLICT (role, module) DO UPDATE SET
  can_read = EXCLUDED.can_read,
  can_create = EXCLUDED.can_create,
  can_update = EXCLUDED.can_update,
  can_delete = EXCLUDED.can_delete;

-- 9. Mise à jour RLS sur tables métier (utilise can_perform)
-- ACHATS_MP
DROP POLICY IF EXISTS "Authenticated can read achats" ON public.achats_mp;
DROP POLICY IF EXISTS "Authenticated can insert achats" ON public.achats_mp;
DROP POLICY IF EXISTS "Authenticated can update achats" ON public.achats_mp;
DROP POLICY IF EXISTS "Authenticated can delete achats" ON public.achats_mp;
CREATE POLICY "perm read achats" ON public.achats_mp FOR SELECT TO authenticated USING (public.can_perform(auth.uid(),'achats_mp','read'));
CREATE POLICY "perm insert achats" ON public.achats_mp FOR INSERT TO authenticated WITH CHECK (public.can_perform(auth.uid(),'achats_mp','create'));
CREATE POLICY "perm update achats" ON public.achats_mp FOR UPDATE TO authenticated USING (public.can_perform(auth.uid(),'achats_mp','update'));
CREATE POLICY "perm delete achats" ON public.achats_mp FOR DELETE TO authenticated USING (public.can_perform(auth.uid(),'achats_mp','delete'));

-- FICHES_TECHNIQUES
DROP POLICY IF EXISTS "Authenticated can read fiches" ON public.fiches_techniques;
DROP POLICY IF EXISTS "Authenticated can insert fiches" ON public.fiches_techniques;
DROP POLICY IF EXISTS "Authenticated can update fiches" ON public.fiches_techniques;
DROP POLICY IF EXISTS "Authenticated can delete fiches" ON public.fiches_techniques;
CREATE POLICY "perm read fiches" ON public.fiches_techniques FOR SELECT TO authenticated USING (public.can_perform(auth.uid(),'fiches_techniques','read'));
CREATE POLICY "perm insert fiches" ON public.fiches_techniques FOR INSERT TO authenticated WITH CHECK (public.can_perform(auth.uid(),'fiches_techniques','create'));
CREATE POLICY "perm update fiches" ON public.fiches_techniques FOR UPDATE TO authenticated USING (public.can_perform(auth.uid(),'fiches_techniques','update'));
CREATE POLICY "perm delete fiches" ON public.fiches_techniques FOR DELETE TO authenticated USING (public.can_perform(auth.uid(),'fiches_techniques','delete'));

-- BONS_TRANSFERT
DROP POLICY IF EXISTS "Authenticated users can read bons" ON public.bons_transfert;
DROP POLICY IF EXISTS "Authenticated users can insert bons" ON public.bons_transfert;
DROP POLICY IF EXISTS "Authenticated users can update bons" ON public.bons_transfert;
CREATE POLICY "perm read bons" ON public.bons_transfert FOR SELECT TO authenticated USING (public.can_perform(auth.uid(),'bons_transfert','read'));
CREATE POLICY "perm insert bons" ON public.bons_transfert FOR INSERT TO authenticated WITH CHECK (public.can_perform(auth.uid(),'bons_transfert','create'));
CREATE POLICY "perm update bons" ON public.bons_transfert FOR UPDATE TO authenticated USING (public.can_perform(auth.uid(),'bons_transfert','update'));
CREATE POLICY "perm delete bons" ON public.bons_transfert FOR DELETE TO authenticated USING (public.can_perform(auth.uid(),'bons_transfert','delete'));

DROP POLICY IF EXISTS "Authenticated can read lignes" ON public.bon_transfert_lignes;
DROP POLICY IF EXISTS "Authenticated can insert lignes" ON public.bon_transfert_lignes;
DROP POLICY IF EXISTS "Authenticated can update lignes" ON public.bon_transfert_lignes;
CREATE POLICY "perm read lignes" ON public.bon_transfert_lignes FOR SELECT TO authenticated USING (public.can_perform(auth.uid(),'bons_transfert','read'));
CREATE POLICY "perm insert lignes" ON public.bon_transfert_lignes FOR INSERT TO authenticated WITH CHECK (public.can_perform(auth.uid(),'bons_transfert','create'));
CREATE POLICY "perm update lignes" ON public.bon_transfert_lignes FOR UPDATE TO authenticated USING (public.can_perform(auth.uid(),'bons_transfert','update'));
CREATE POLICY "perm delete lignes" ON public.bon_transfert_lignes FOR DELETE TO authenticated USING (public.can_perform(auth.uid(),'bons_transfert','delete'));

-- STOCK_TAMPON
DROP POLICY IF EXISTS "Authenticated can read stock" ON public.stock_tampon;
DROP POLICY IF EXISTS "Authenticated can insert stock" ON public.stock_tampon;
DROP POLICY IF EXISTS "Authenticated can update stock" ON public.stock_tampon;
CREATE POLICY "perm read stock" ON public.stock_tampon FOR SELECT TO authenticated USING (public.can_perform(auth.uid(),'stock_tampon','read'));
CREATE POLICY "perm insert stock" ON public.stock_tampon FOR INSERT TO authenticated WITH CHECK (public.can_perform(auth.uid(),'stock_tampon','create'));
CREATE POLICY "perm update stock" ON public.stock_tampon FOR UPDATE TO authenticated USING (public.can_perform(auth.uid(),'stock_tampon','update'));
CREATE POLICY "perm delete stock" ON public.stock_tampon FOR DELETE TO authenticated USING (public.can_perform(auth.uid(),'stock_tampon','delete'));

-- MOUVEMENTS_STOCK (lié à stock_tampon)
DROP POLICY IF EXISTS "Authenticated can read mouvements" ON public.mouvements_stock;
DROP POLICY IF EXISTS "Authenticated can insert mouvements" ON public.mouvements_stock;
DROP POLICY IF EXISTS "Authenticated can update mouvements" ON public.mouvements_stock;
DROP POLICY IF EXISTS "Authenticated can delete mouvements" ON public.mouvements_stock;
CREATE POLICY "perm read mouvements" ON public.mouvements_stock FOR SELECT TO authenticated USING (public.can_perform(auth.uid(),'stock_tampon','read'));
CREATE POLICY "perm insert mouvements" ON public.mouvements_stock FOR INSERT TO authenticated WITH CHECK (public.can_perform(auth.uid(),'stock_tampon','create'));
CREATE POLICY "perm update mouvements" ON public.mouvements_stock FOR UPDATE TO authenticated USING (public.can_perform(auth.uid(),'stock_tampon','update'));
CREATE POLICY "perm delete mouvements" ON public.mouvements_stock FOR DELETE TO authenticated USING (public.can_perform(auth.uid(),'stock_tampon','delete'));

-- PERTES
DROP POLICY IF EXISTS "Authenticated can read pertes" ON public.pertes;
DROP POLICY IF EXISTS "Authenticated can insert pertes" ON public.pertes;
DROP POLICY IF EXISTS "Authenticated can update pertes" ON public.pertes;
CREATE POLICY "perm read pertes" ON public.pertes FOR SELECT TO authenticated USING (public.can_perform(auth.uid(),'pertes','read'));
CREATE POLICY "perm insert pertes" ON public.pertes FOR INSERT TO authenticated WITH CHECK (public.can_perform(auth.uid(),'pertes','create'));
CREATE POLICY "perm update pertes" ON public.pertes FOR UPDATE TO authenticated USING (public.can_perform(auth.uid(),'pertes','update'));
CREATE POLICY "perm delete pertes" ON public.pertes FOR DELETE TO authenticated USING (public.can_perform(auth.uid(),'pertes','delete'));

-- PRODUCTION_LABO
DROP POLICY IF EXISTS "Authenticated can read production" ON public.production_labo;
DROP POLICY IF EXISTS "Authenticated can insert production" ON public.production_labo;
DROP POLICY IF EXISTS "Authenticated can update production" ON public.production_labo;
CREATE POLICY "perm read production" ON public.production_labo FOR SELECT TO authenticated USING (public.can_perform(auth.uid(),'production','read'));
CREATE POLICY "perm insert production" ON public.production_labo FOR INSERT TO authenticated WITH CHECK (public.can_perform(auth.uid(),'production','create'));
CREATE POLICY "perm update production" ON public.production_labo FOR UPDATE TO authenticated USING (public.can_perform(auth.uid(),'production','update'));
CREATE POLICY "perm delete production" ON public.production_labo FOR DELETE TO authenticated USING (public.can_perform(auth.uid(),'production','delete'));

-- INVENTAIRE
DROP POLICY IF EXISTS "Authenticated can read inventaire" ON public.inventaire;
DROP POLICY IF EXISTS "Authenticated can insert inventaire" ON public.inventaire;
DROP POLICY IF EXISTS "Authenticated can delete inventaire" ON public.inventaire;
CREATE POLICY "perm read inventaire" ON public.inventaire FOR SELECT TO authenticated USING (public.can_perform(auth.uid(),'inventaire','read'));
CREATE POLICY "perm insert inventaire" ON public.inventaire FOR INSERT TO authenticated WITH CHECK (public.can_perform(auth.uid(),'inventaire','create'));
CREATE POLICY "perm update inventaire" ON public.inventaire FOR UPDATE TO authenticated USING (public.can_perform(auth.uid(),'inventaire','update'));
CREATE POLICY "perm delete inventaire" ON public.inventaire FOR DELETE TO authenticated USING (public.can_perform(auth.uid(),'inventaire','delete'));

-- CLOTURE
DROP POLICY IF EXISTS "Authenticated can read cloture" ON public.cloture_journaliere;
DROP POLICY IF EXISTS "Authenticated can insert cloture" ON public.cloture_journaliere;
DROP POLICY IF EXISTS "Authenticated can update cloture" ON public.cloture_journaliere;
CREATE POLICY "perm read cloture" ON public.cloture_journaliere FOR SELECT TO authenticated USING (public.can_perform(auth.uid(),'cloture','read'));
CREATE POLICY "perm insert cloture" ON public.cloture_journaliere FOR INSERT TO authenticated WITH CHECK (public.can_perform(auth.uid(),'cloture','create'));
CREATE POLICY "perm update cloture" ON public.cloture_journaliere FOR UPDATE TO authenticated USING (public.can_perform(auth.uid(),'cloture','update'));
CREATE POLICY "perm delete cloture" ON public.cloture_journaliere FOR DELETE TO authenticated USING (public.can_perform(auth.uid(),'cloture','delete'));

-- DEGUSTATIONS
DROP POLICY IF EXISTS "Authenticated can read degustations" ON public.degustations;
DROP POLICY IF EXISTS "Authenticated can insert degustations" ON public.degustations;
DROP POLICY IF EXISTS "Authenticated can update degustations" ON public.degustations;
CREATE POLICY "perm read degustations" ON public.degustations FOR SELECT TO authenticated USING (public.can_perform(auth.uid(),'degustations','read'));
CREATE POLICY "perm insert degustations" ON public.degustations FOR INSERT TO authenticated WITH CHECK (public.can_perform(auth.uid(),'degustations','create'));
CREATE POLICY "perm update degustations" ON public.degustations FOR UPDATE TO authenticated USING (public.can_perform(auth.uid(),'degustations','update'));
CREATE POLICY "perm delete degustations" ON public.degustations FOR DELETE TO authenticated USING (public.can_perform(auth.uid(),'degustations','delete'));