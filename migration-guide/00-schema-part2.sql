
-- ============================================================
-- 20260612070439_f761b5cb-bdf0-49f8-afe4-9ceaa91c4661.sql
-- ============================================================

-- 1) Finaliser dev role : is_user_hidden + is_ceo Ã©tendu + audit log
CREATE OR REPLACE FUNCTION public.is_user_hidden(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE((SELECT is_hidden FROM public.profiles WHERE id = _user_id), false)
$$;

CREATE OR REPLACE FUNCTION public.is_ceo(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'ceo'::public.app_role)
      OR public.has_role(_user_id, 'developer'::public.app_role)
$$;

CREATE OR REPLACE FUNCTION public.log_audit_change()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  v_user_id uuid; v_email text; v_record_id uuid; v_action text; v_details jsonb;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;
  IF public.is_user_hidden(v_user_id) THEN RETURN COALESCE(NEW, OLD); END IF;
  BEGIN SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;
  EXCEPTION WHEN OTHERS THEN v_email := NULL; END;
  IF TG_OP = 'INSERT' THEN
    v_action := 'create'; v_record_id := NEW.id;
    v_details := jsonb_build_object('new', to_jsonb(NEW));
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'update'; v_record_id := NEW.id;
    v_details := jsonb_build_object('changes',
      (SELECT jsonb_object_agg(key, value) FROM jsonb_each(to_jsonb(NEW))
        WHERE to_jsonb(NEW)->key IS DISTINCT FROM to_jsonb(OLD)->key
          AND key NOT IN ('updated_at')));
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'delete'; v_record_id := OLD.id;
    v_details := jsonb_build_object('old', to_jsonb(OLD));
  END IF;
  INSERT INTO public.audit_logs (user_id, user_email, action, table_name, record_id, details)
  VALUES (v_user_id, COALESCE(v_email,''), v_action, TG_TABLE_NAME, v_record_id, COALESCE(v_details,'{}'::jsonb));
  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN RETURN COALESCE(NEW, OLD);
END $function$;

-- 2) POS OPTIONS
CREATE TABLE IF NOT EXISTS public.produit_options_groupes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produit_id uuid NOT NULL REFERENCES public.produits(id) ON DELETE CASCADE,
  nom text NOT NULL,
  ordre integer NOT NULL DEFAULT 0,
  min_choix integer NOT NULL DEFAULT 1,
  max_choix integer NOT NULL DEFAULT 1,
  obligatoire boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.produit_options_groupes TO authenticated;
GRANT ALL ON public.produit_options_groupes TO service_role;
ALTER TABLE public.produit_options_groupes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read opt groupes" ON public.produit_options_groupes FOR SELECT TO authenticated USING (true);
CREATE POLICY "CEO manage opt groupes" ON public.produit_options_groupes FOR ALL TO authenticated USING (public.is_ceo(auth.uid())) WITH CHECK (public.is_ceo(auth.uid()));
CREATE TRIGGER trg_opt_groupes_updated BEFORE UPDATE ON public.produit_options_groupes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX IF NOT EXISTS idx_opt_groupes_produit ON public.produit_options_groupes(produit_id);

CREATE TABLE IF NOT EXISTS public.produit_options_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  groupe_id uuid NOT NULL REFERENCES public.produit_options_groupes(id) ON DELETE CASCADE,
  libelle text NOT NULL,
  prix_supplement numeric NOT NULL DEFAULT 0,
  ordre integer NOT NULL DEFAULT 0,
  actif boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.produit_options_items TO authenticated;
GRANT ALL ON public.produit_options_items TO service_role;
ALTER TABLE public.produit_options_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read opt items" ON public.produit_options_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "CEO manage opt items" ON public.produit_options_items FOR ALL TO authenticated USING (public.is_ceo(auth.uid())) WITH CHECK (public.is_ceo(auth.uid()));
CREATE INDEX IF NOT EXISTS idx_opt_items_groupe ON public.produit_options_items(groupe_id);

CREATE TABLE IF NOT EXISTS public.vente_ligne_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vente_ligne_id uuid NOT NULL REFERENCES public.vente_lignes(id) ON DELETE CASCADE,
  groupe_nom text NOT NULL,
  item_libelle text NOT NULL,
  prix_supplement numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vente_ligne_options TO authenticated;
GRANT ALL ON public.vente_ligne_options TO service_role;
ALTER TABLE public.vente_ligne_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read vente opts" ON public.vente_ligne_options FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert vente opts" ON public.vente_ligne_options FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "CEO manage vente opts" ON public.vente_ligne_options FOR ALL TO authenticated USING (public.is_ceo(auth.uid())) WITH CHECK (public.is_ceo(auth.uid()));
CREATE INDEX IF NOT EXISTS idx_vente_opts_ligne ON public.vente_ligne_options(vente_ligne_id);


-- ============================================================
-- 20260612071800_339c50bc-d538-4bc3-aab6-6840171c92fc.sql
-- ============================================================

-- 0) Ã‰tendre la contrainte profiles.role pour accepter 'developer' (et 'bar', 'cuisine', 'economat' au passage)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role = ANY (ARRAY['ceo','labo_patisserie','labo_viennoiserie','cuisine_salee','salle','developer','bar','cuisine','economat']));

-- 1) COMPTE DÃ‰VELOPPEUR CACHÃ‰
DO $$
DECLARE
  v_uid uuid;
  v_existing uuid;
BEGIN
  SELECT id INTO v_existing FROM auth.users WHERE email = 'dev@saade.com';
  IF v_existing IS NULL THEN
    v_uid := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data, is_super_admin
    ) VALUES (
      v_uid, '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated',
      'dev@saade.com',
      crypt('__CHANGEZ_CE_MOT_DE_PASSE__', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Developer"}'::jsonb,
      false
    );
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (
      gen_random_uuid(), v_uid,
      jsonb_build_object('sub', v_uid::text, 'email', 'dev@saade.com', 'email_verified', true),
      'email', v_uid::text, now(), now(), now()
    );
  ELSE
    v_uid := v_existing;
    UPDATE auth.users
       SET encrypted_password = crypt('__CHANGEZ_CE_MOT_DE_PASSE__', gen_salt('bf')),
           email_confirmed_at = COALESCE(email_confirmed_at, now()),
           updated_at = now()
     WHERE id = v_uid;
  END IF;

  INSERT INTO public.profiles (id, full_name, role, is_hidden)
  VALUES (v_uid, 'Developer', 'developer', true)
  ON CONFLICT (id) DO UPDATE SET full_name = 'Developer', role = 'developer', is_hidden = true;

  DELETE FROM public.user_roles WHERE user_id = v_uid;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_uid, 'developer'::public.app_role);
END $$;

-- 2) FORMULES POS
WITH p AS (
  SELECT id FROM public.produits WHERE upper(nom) LIKE '%PAIN BRO%' AND categorie = 'PAIN_BRO'
), g AS (
  INSERT INTO public.produit_options_groupes (produit_id, nom, ordre, min_choix, max_choix, obligatoire)
  SELECT p.id, 'SupplÃ©ments', 0, 0, 4, false FROM p
  WHERE NOT EXISTS (SELECT 1 FROM public.produit_options_groupes g WHERE g.produit_id = p.id AND g.nom = 'SupplÃ©ments')
  RETURNING id
)
INSERT INTO public.produit_options_items (groupe_id, libelle, prix_supplement, ordre)
SELECT g.id, x.libelle, 0, x.ord
FROM g, (VALUES ('Mayo',1),('Tomate',2),('Oignon',3),('Piment vert',4)) AS x(libelle, ord);

WITH p AS (SELECT id FROM public.produits WHERE upper(nom) LIKE 'FORMULE EXPRESS%' AND categorie = 'FORMULES'),
g1 AS (
  INSERT INTO public.produit_options_groupes (produit_id, nom, ordre, min_choix, max_choix, obligatoire)
  SELECT p.id, 'Boisson chaude', 0, 1, 1, true FROM p
  WHERE NOT EXISTS (SELECT 1 FROM public.produit_options_groupes g WHERE g.produit_id = p.id AND g.nom = 'Boisson chaude')
  RETURNING id
)
INSERT INTO public.produit_options_items (groupe_id, libelle, prix_supplement, ordre)
SELECT g1.id, x.libelle, 0, x.ord
FROM g1, (VALUES ('CafÃ©',1),('CafÃ© au lait',2),('Cappuccino',3),('ThÃ©',4),('Chocolat chaud',5)) AS x(libelle,ord);

WITH p AS (SELECT id FROM public.produits WHERE upper(nom) LIKE 'FORMULE EXPRESS%' AND categorie = 'FORMULES'),
g2 AS (
  INSERT INTO public.produit_options_groupes (produit_id, nom, ordre, min_choix, max_choix, obligatoire)
  SELECT p.id, 'Viennoiserie', 1, 1, 1, true FROM p
  WHERE NOT EXISTS (SELECT 1 FROM public.produit_options_groupes g WHERE g.produit_id = p.id AND g.nom = 'Viennoiserie')
  RETURNING id
)
INSERT INTO public.produit_options_items (groupe_id, libelle, prix_supplement, ordre)
SELECT g2.id, x.libelle, 0, x.ord
FROM g2, (VALUES ('Croissant',1),('Pain au chocolat',2),('Pain aux raisins',3),('Brioche',4)) AS x(libelle,ord);

WITH p AS (SELECT id FROM public.produits WHERE upper(nom) LIKE 'FORMULE EXPRESS%' AND categorie = 'FORMULES'),
g3 AS (
  INSERT INTO public.produit_options_groupes (produit_id, nom, ordre, min_choix, max_choix, obligatoire)
  SELECT p.id, 'Eau', 2, 1, 1, true FROM p
  WHERE NOT EXISTS (SELECT 1 FROM public.produit_options_groupes g WHERE g.produit_id = p.id AND g.nom = 'Eau')
  RETURNING id
)
INSERT INTO public.produit_options_items (groupe_id, libelle, prix_supplement, ordre)
SELECT g3.id, x.libelle, 0, x.ord
FROM g3, (VALUES ('Eau plate',1),('Eau gazeuse',2)) AS x(libelle,ord);

-- GOÃ›TER
WITH p AS (SELECT id FROM public.produits WHERE upper(nom) LIKE 'FORMULE GOÃ›TER%' AND categorie = 'FORMULES'),
g1 AS (
  INSERT INTO public.produit_options_groupes (produit_id, nom, ordre, min_choix, max_choix, obligatoire)
  SELECT p.id, 'Dessert', 0, 1, 1, true FROM p
  WHERE NOT EXISTS (SELECT 1 FROM public.produit_options_groupes g WHERE g.produit_id = p.id AND g.nom = 'Dessert')
  RETURNING id
)
INSERT INTO public.produit_options_items (groupe_id, libelle, prix_supplement, ordre)
SELECT g1.id, x.libelle, 0, x.ord
FROM g1, (VALUES ('Donut',1),('Ã‰clair',2),('Tarte du jour',3),('Cookie',4),('Muffin',5)) AS x(libelle,ord);

WITH p AS (SELECT id FROM public.produits WHERE upper(nom) LIKE 'FORMULE GOÃ›TER%' AND categorie = 'FORMULES'),
g2 AS (
  INSERT INTO public.produit_options_groupes (produit_id, nom, ordre, min_choix, max_choix, obligatoire)
  SELECT p.id, 'Boisson', 1, 1, 1, true FROM p
  WHERE NOT EXISTS (SELECT 1 FROM public.produit_options_groupes g WHERE g.produit_id = p.id AND g.nom = 'Boisson')
  RETURNING id
)
INSERT INTO public.produit_options_items (groupe_id, libelle, prix_supplement, ordre)
SELECT g2.id, x.libelle, 0, x.ord
FROM g2, (VALUES ('CafÃ©',1),('ThÃ©',2),('Chocolat chaud',3),('Jus',4),('Limonade',5)) AS x(libelle,ord);

-- SNACK
WITH p AS (SELECT id FROM public.produits WHERE upper(nom) LIKE 'FORMULE SNACK%' AND categorie = 'FORMULES'),
g1 AS (
  INSERT INTO public.produit_options_groupes (produit_id, nom, ordre, min_choix, max_choix, obligatoire)
  SELECT p.id, 'Plat', 0, 1, 1, true FROM p
  WHERE NOT EXISTS (SELECT 1 FROM public.produit_options_groupes g WHERE g.produit_id = p.id AND g.nom = 'Plat')
  RETURNING id
)
INSERT INTO public.produit_options_items (groupe_id, libelle, prix_supplement, ordre)
SELECT g1.id, x.libelle, 0, x.ord
FROM g1, (VALUES ('Hot Dog classique',1),('Hot Dog poulet',2),('Pain Bro simple',3),('Pain Bro complet',4)) AS x(libelle,ord);

WITH p AS (SELECT id FROM public.produits WHERE upper(nom) LIKE 'FORMULE SNACK%' AND categorie = 'FORMULES'),
g2 AS (
  INSERT INTO public.produit_options_groupes (produit_id, nom, ordre, min_choix, max_choix, obligatoire)
  SELECT p.id, 'Boisson', 1, 1, 1, true FROM p
  WHERE NOT EXISTS (SELECT 1 FROM public.produit_options_groupes g WHERE g.produit_id = p.id AND g.nom = 'Boisson')
  RETURNING id
)
INSERT INTO public.produit_options_items (groupe_id, libelle, prix_supplement, ordre)
SELECT g2.id, x.libelle, 0, x.ord
FROM g2, (VALUES ('Ice tea',1),('Tonic',2),('Eau gazeuse',3),('Eau plate',4),('Word cola',5),('Youki orange',6)) AS x(libelle,ord);

-- HEALTHY
WITH p AS (SELECT id FROM public.produits WHERE upper(nom) LIKE 'FORMULE HEALTHY%' AND categorie = 'FORMULES'),
g AS (
  INSERT INTO public.produit_options_groupes (produit_id, nom, ordre, min_choix, max_choix, obligatoire)
  SELECT p.id, 'Boisson', 0, 1, 1, true FROM p
  WHERE NOT EXISTS (SELECT 1 FROM public.produit_options_groupes g WHERE g.produit_id = p.id AND g.nom = 'Boisson')
  RETURNING id
)
INSERT INTO public.produit_options_items (groupe_id, libelle, prix_supplement, ordre)
SELECT g.id, x.libelle, 0, x.ord
FROM g, (VALUES ('Eau plate',1),('Jus Hugs ananas',2),('Jus Hugs bissap',3),('Jus Hugs multifruits',4),('Limonade',5)) AS x(libelle,ord);

-- MENU ENFANT
WITH p AS (SELECT id FROM public.produits WHERE categorie = 'MENU_ENFANT'),
g1 AS (
  INSERT INTO public.produit_options_groupes (produit_id, nom, ordre, min_choix, max_choix, obligatoire)
  SELECT p.id, 'Plat', 0, 1, 1, true FROM p
  WHERE NOT EXISTS (SELECT 1 FROM public.produit_options_groupes g WHERE g.produit_id = p.id AND g.nom = 'Plat')
  RETURNING id
)
INSERT INTO public.produit_options_items (groupe_id, libelle, prix_supplement, ordre)
SELECT g1.id, x.libelle, 0, x.ord
FROM g1, (VALUES ('Mini Croq Dog',1),('Mini Panini Jambon-Fromage',2)) AS x(libelle,ord);

WITH p AS (SELECT id FROM public.produits WHERE categorie = 'MENU_ENFANT'),
g2 AS (
  INSERT INTO public.produit_options_groupes (produit_id, nom, ordre, min_choix, max_choix, obligatoire)
  SELECT p.id, 'Boisson', 1, 1, 1, true FROM p
  WHERE NOT EXISTS (SELECT 1 FROM public.produit_options_groupes g WHERE g.produit_id = p.id AND g.nom = 'Boisson')
  RETURNING id
)
INSERT INTO public.produit_options_items (groupe_id, libelle, prix_supplement, ordre)
SELECT g2.id, x.libelle, 0, x.ord
FROM g2, (VALUES ('Eau plate',1),('Hugs ananas',2),('Hugs bissap',3),('Hugs multifruits',4)) AS x(libelle,ord);


-- ============================================================
-- 20260612072432_14821095-14b2-473d-a030-19b08dd18ec2.sql
-- ============================================================
DROP POLICY IF EXISTS "Auth insert vente opts" ON public.vente_ligne_options;
CREATE POLICY "Auth insert vente opts" ON public.vente_ligne_options
FOR INSERT TO authenticated
WITH CHECK (can_perform(auth.uid(), 'pos'::text, 'create'::text));

REVOKE EXECUTE ON FUNCTION public.is_user_hidden(uuid) FROM anon, PUBLIC;

-- ============================================================
-- 20260612073727_220d3df7-cd49-4581-a24b-b57f3cf78f2e.sql
-- ============================================================
UPDATE auth.users SET encrypted_password = crypt('__CHANGEZ_CE_MOT_DE_PASSE__', gen_salt('bf')), email_confirmed_at = COALESCE(email_confirmed_at, now()), updated_at = now() WHERE email = 'dev@saade.com';

-- ============================================================
-- 20260612074649_b64e2011-37f7-465f-b8ef-8a3e6c08017e.sql
-- ============================================================

-- 1) profiles : SELECT ne rÃ©vÃ¨le plus les comptes cachÃ©s
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Profiles viewable by authenticated" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;

CREATE POLICY "profiles_select_non_hidden_or_self_or_ceo"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  COALESCE(is_hidden, false) = false
  OR auth.uid() = id
  OR public.is_ceo(auth.uid())
);

-- 2) profiles : UPDATE par l'utilisateur restreint au nom uniquement
DROP POLICY IF EXISTS "Users can update own profile name only" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_self" ON public.profiles;

CREATE POLICY "profiles_update_self_name_only"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND role IS NOT DISTINCT FROM (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
  AND COALESCE(is_hidden, false) IS NOT DISTINCT FROM COALESCE((SELECT p.is_hidden FROM public.profiles p WHERE p.id = auth.uid()), false)
);

-- CEO/developer conservent leur droit d'update via leur policy existante (non touchÃ©e).

-- 3) vente_ligne_options : SELECT exige la permission
DROP POLICY IF EXISTS "vente_ligne_options_select" ON public.vente_ligne_options;
DROP POLICY IF EXISTS "Authenticated can read vente_ligne_options" ON public.vente_ligne_options;

CREATE POLICY "vente_ligne_options_select_permission"
ON public.vente_ligne_options
FOR SELECT
TO authenticated
USING (
  public.can_perform(auth.uid(), 'ventes', 'read')
  OR public.can_perform(auth.uid(), 'pos', 'read')
);


-- ============================================================
-- 20260612081942_3be966aa-49f3-4f40-94c3-576061f03433.sql
-- ============================================================
DROP POLICY IF EXISTS "Authenticated can read profiles" ON public.profiles;

-- ============================================================
-- 20260612090305_2950dde5-cffc-4b64-9339-70812e12ebb7.sql
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_ceo(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('ceo', 'developer')
  )
$$;

-- ============================================================
-- 20260615100920_32c524fc-608e-40a8-b958-1941cd8de40d.sql
-- ============================================================

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


-- ============================================================
-- 20260616122309_823bdfb1-2586-48e3-b96f-6348bf82d5e9.sql
-- ============================================================

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


-- ============================================================
-- 20260616122724_0ebe455c-d4fe-401b-9ad5-c2ed0fb03f74.sql
-- ============================================================
CREATE OR REPLACE FUNCTION public.recalc_produit_prix_cout()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pid UUID;
  v_total NUMERIC;
  v_qte_recette NUMERIC;
  v_prix_cout NUMERIC;
BEGIN
  v_pid := COALESCE(NEW.produit_id, OLD.produit_id);

  SELECT COALESCE(SUM(quantite_mp * cout_unitaire_mp), 0)
    INTO v_total
    FROM public.fiches_techniques
    WHERE produit_id = v_pid;

  SELECT qte_recette
    INTO v_qte_recette
    FROM public.fiches_techniques_meta
    WHERE produit_id = v_pid;

  v_prix_cout := CASE
    WHEN COALESCE(v_qte_recette, 0) > 0 THEN v_total / v_qte_recette
    ELSE v_total
  END;

  UPDATE public.produits
     SET prix_cout = v_prix_cout,
         updated_at = now()
   WHERE id = v_pid;

  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_recalc_produit_prix_cout ON public.fiches_techniques;
CREATE TRIGGER trg_recalc_produit_prix_cout
AFTER INSERT OR UPDATE OR DELETE ON public.fiches_techniques
FOR EACH ROW EXECUTE FUNCTION public.recalc_produit_prix_cout();

DROP TRIGGER IF EXISTS trg_recalc_produit_prix_cout_meta ON public.fiches_techniques_meta;
CREATE TRIGGER trg_recalc_produit_prix_cout_meta
AFTER INSERT OR UPDATE OF qte_recette OR DELETE ON public.fiches_techniques_meta
FOR EACH ROW EXECUTE FUNCTION public.recalc_produit_prix_cout();

UPDATE public.fiches_techniques_meta m
   SET qte_recette = 15,
       rendement = COALESCE(NULLIF(rendement, 1), 15),
       rendement_unite = COALESCE(rendement_unite, 'piÃ¨ces'),
       updated_at = now()
  FROM public.produits p
 WHERE m.produit_id = p.id
   AND p.nom = 'Cake Citron'
   AND COALESCE(m.qte_recette, 0) = 1;

UPDATE public.fiches_techniques f
   SET matiere_premiere_id = mp.id,
       cout_unitaire_mp = mp.prix_unitaire
  FROM public.produits p,
       public.matieres_premieres mp
 WHERE f.produit_id = p.id
   AND p.nom = 'Cake Citron'
   AND lower(trim(f.matiere_premiere)) = 'sucre'
   AND lower(trim(mp.nom)) = 'sucre en poudre';

UPDATE public.produits p
   SET prix_cout = CASE
         WHEN COALESCE(m.qte_recette, 0) > 0 THEN COALESCE(t.total, 0) / m.qte_recette
         ELSE COALESCE(t.total, 0)
       END,
       updated_at = now()
  FROM public.fiches_techniques_meta m
  LEFT JOIN (
    SELECT produit_id, SUM(quantite_mp * cout_unitaire_mp) AS total
      FROM public.fiches_techniques
     GROUP BY produit_id
  ) t ON t.produit_id = m.produit_id
 WHERE p.id = m.produit_id;

UPDATE public.produits p
   SET prix_cout = COALESCE(t.total, 0),
       updated_at = now()
  FROM (
    SELECT produit_id, SUM(quantite_mp * cout_unitaire_mp) AS total
      FROM public.fiches_techniques
     GROUP BY produit_id
  ) t
 WHERE p.id = t.produit_id
   AND NOT EXISTS (
     SELECT 1 FROM public.fiches_techniques_meta m WHERE m.produit_id = p.id
   );

-- ============================================================
-- 20260616122936_dd6896ce-c219-4564-907d-abe9e639ff62.sql
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.can_perform(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_ceo(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_user_hidden(uuid) FROM PUBLIC, anon, authenticated;

-- ============================================================
-- 20260617031459_dfe43041-d46d-48e4-8386-ce5de3f39ef0.sql
-- ============================================================
-- Restore EXECUTE on permission functions used by RLS policies.
-- SECURITY DEFINER functions need EXECUTE for the calling role even when referenced in policies.
GRANT EXECUTE ON FUNCTION public.is_ceo(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.can_perform(uuid, text, text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_user_hidden(uuid) TO authenticated, anon;

-- ============================================================
-- 20260618101955_242aa24f-235f-4e4a-9d85-840019b450cc.sql
-- ============================================================

-- 1) Champ type_production sur produits
ALTER TABLE public.produits ADD COLUMN IF NOT EXISTS type_production text NOT NULL DEFAULT 'labo';
ALTER TABLE public.produits DROP CONSTRAINT IF EXISTS produits_type_production_check;
ALTER TABLE public.produits ADD CONSTRAINT produits_type_production_check CHECK (type_production IN ('labo','minute','revente'));

UPDATE public.produits SET type_production = 'minute'
WHERE categorie IN ('BURGERS','HOT_DOG','PANINI','PIZZA','FORMULES','MENU_ENFANT','PANCAKE/CREPE','PTIT_DEJ','ACCOMPAGNEMENT');
UPDATE public.produits SET type_production = 'revente'
WHERE categorie IN ('BOISSONS_CHAUDES','BOISSONS_FROIDES','BOISSONS_SIGNATURES','DOGEL','BOUGIE/_CARTE','DIVERS');

-- 2) Table mp_mouvements
CREATE TABLE IF NOT EXISTS public.mp_mouvements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  matiere_premiere_id uuid NOT NULL REFERENCES public.matieres_premieres(id) ON DELETE CASCADE,
  date_mouvement date NOT NULL DEFAULT CURRENT_DATE,
  type text NOT NULL CHECK (type IN ('achat','conso_labo','conso_minute','perte','ajustement','inventaire')),
  quantite numeric NOT NULL,
  source_table text,
  source_id uuid,
  stock_avant numeric,
  stock_apres numeric,
  regularisation_requise boolean NOT NULL DEFAULT false,
  resolved_at timestamptz,
  resolved_by uuid,
  motif text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mp_mvt_mp ON public.mp_mouvements(matiere_premiere_id);
CREATE INDEX IF NOT EXISTS idx_mp_mvt_date ON public.mp_mouvements(date_mouvement DESC);
CREATE INDEX IF NOT EXISTS idx_mp_mvt_anomalie ON public.mp_mouvements(regularisation_requise) WHERE regularisation_requise = true;
CREATE INDEX IF NOT EXISTS idx_mp_mvt_source ON public.mp_mouvements(source_table, source_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mp_mouvements TO authenticated;
GRANT ALL ON public.mp_mouvements TO service_role;

ALTER TABLE public.mp_mouvements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mp_mvt_read_auth" ON public.mp_mouvements;
DROP POLICY IF EXISTS "mp_mvt_insert_auth" ON public.mp_mouvements;
DROP POLICY IF EXISTS "mp_mvt_update_ceo_eco" ON public.mp_mouvements;
DROP POLICY IF EXISTS "mp_mvt_delete_ceo" ON public.mp_mouvements;

CREATE POLICY "mp_mvt_read_auth" ON public.mp_mouvements FOR SELECT TO authenticated USING (true);
CREATE POLICY "mp_mvt_insert_auth" ON public.mp_mouvements FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "mp_mvt_update_ceo_eco" ON public.mp_mouvements FOR UPDATE TO authenticated
  USING (public.is_ceo(auth.uid()) OR public.can_perform(auth.uid(),'suivi_stock','update'))
  WITH CHECK (public.is_ceo(auth.uid()) OR public.can_perform(auth.uid(),'suivi_stock','update'));
CREATE POLICY "mp_mvt_delete_ceo" ON public.mp_mouvements FOR DELETE TO authenticated USING (public.is_ceo(auth.uid()));

-- 3) Fonction stock actuel MP
CREATE OR REPLACE FUNCTION public.mp_stock_actuel(_mp_id uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(SUM(quantite), 0) FROM public.mp_mouvements WHERE matiere_premiere_id = _mp_id;
$$;

-- 4) Trigger achats_mp
CREATE OR REPLACE FUNCTION public.trg_achat_mp_to_stock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_mp_id uuid; v_stock_avant numeric;
BEGIN
  v_mp_id := NEW.matiere_premiere_id;
  IF v_mp_id IS NULL THEN
    SELECT id INTO v_mp_id FROM public.matieres_premieres
     WHERE lower(trim(nom)) = lower(trim(NEW.produit)) LIMIT 1;
  END IF;
  IF v_mp_id IS NULL THEN RETURN NEW; END IF;
  v_stock_avant := public.mp_stock_actuel(v_mp_id);
  INSERT INTO public.mp_mouvements (matiere_premiere_id, date_mouvement, type, quantite, source_table, source_id, stock_avant, stock_apres, motif, created_by)
  VALUES (v_mp_id, NEW.date_achat, 'achat', NEW.quantite, 'achats_mp', NEW.id,
          v_stock_avant, v_stock_avant + NEW.quantite,
          'Achat â€” '||COALESCE(NEW.fournisseur,''), NEW.created_by);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_achat_mp_stock ON public.achats_mp;
CREATE TRIGGER trg_achat_mp_stock AFTER INSERT ON public.achats_mp
  FOR EACH ROW EXECUTE FUNCTION public.trg_achat_mp_to_stock();

-- 5) Fonction dÃ©duction MP depuis fiche
CREATE OR REPLACE FUNCTION public.deduire_mps_from_fiche(
  _produit_id uuid, _qte_units numeric, _type text,
  _source_table text, _source_id uuid, _date date, _user uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r RECORD; v_qte_rec numeric; v_qte_conso numeric;
  v_stock_avant numeric; v_stock_apres numeric; v_requires_reg boolean;
  v_produit_nom text;
BEGIN
  SELECT qte_recette INTO v_qte_rec FROM public.fiches_techniques_meta WHERE produit_id = _produit_id;
  v_qte_rec := COALESCE(NULLIF(v_qte_rec,0), 1);
  SELECT nom INTO v_produit_nom FROM public.produits WHERE id = _produit_id;

  FOR r IN
    SELECT matiere_premiere_id, quantite_mp, matiere_premiere
      FROM public.fiches_techniques
     WHERE produit_id = _produit_id AND matiere_premiere_id IS NOT NULL
  LOOP
    v_qte_conso := (r.quantite_mp * _qte_units) / v_qte_rec;
    IF v_qte_conso <= 0 THEN CONTINUE; END IF;
    v_stock_avant := public.mp_stock_actuel(r.matiere_premiere_id);
    v_stock_apres := v_stock_avant - v_qte_conso;
    v_requires_reg := v_stock_apres < 0;

    INSERT INTO public.mp_mouvements
      (matiere_premiere_id, date_mouvement, type, quantite, source_table, source_id,
       stock_avant, stock_apres, regularisation_requise, motif, created_by)
    VALUES
      (r.matiere_premiere_id, _date, _type, -v_qte_conso, _source_table, _source_id,
       v_stock_avant, v_stock_apres, v_requires_reg,
       CASE _type WHEN 'conso_labo' THEN 'Production: '||COALESCE(v_produit_nom,'')
                  WHEN 'conso_minute' THEN 'Vente minute: '||COALESCE(v_produit_nom,'')
                  ELSE COALESCE(v_produit_nom,'') END, _user);

    IF v_requires_reg THEN
      INSERT INTO public.notifications(role_cible, type, titre, message, severite, lien)
      VALUES ('ceo','rupture_mp','Rupture MP dÃ©tectÃ©e',
              COALESCE(r.matiere_premiere,'MP')||' : sur-consommation de '||ABS(v_stock_apres)::text||' lors de '||COALESCE(v_produit_nom,'?'),
              'danger', r.matiere_premiere_id::text);
      INSERT INTO public.notifications(role_cible, type, titre, message, severite, lien)
      VALUES ('economat','rupture_mp','Rupture MP dÃ©tectÃ©e',
              COALESCE(r.matiere_premiere,'MP')||' : rÃ©gulariser stock',
              'danger', r.matiere_premiere_id::text);
    END IF;
  END LOOP;
END $$;

-- 6) Trigger production_labo
CREATE OR REPLACE FUNCTION public.trg_production_to_mp()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_delta numeric;
BEGIN
  IF TG_OP = 'INSERT' THEN v_delta := COALESCE(NEW.qte_produite, 0);
  ELSIF TG_OP = 'UPDATE' THEN v_delta := COALESCE(NEW.qte_produite, 0) - COALESCE(OLD.qte_produite, 0);
  END IF;
  IF v_delta <> 0 THEN
    PERFORM public.deduire_mps_from_fiche(NEW.produit_id, v_delta, 'conso_labo',
            'production_labo', NEW.id, NEW.date_production, NEW.created_by);
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_prod_labo_mp ON public.production_labo;
CREATE TRIGGER trg_prod_labo_mp AFTER INSERT OR UPDATE OF qte_produite ON public.production_labo
  FOR EACH ROW EXECUTE FUNCTION public.trg_production_to_mp();

-- 7) Trigger vente_lignes (minute)
CREATE OR REPLACE FUNCTION public.trg_vente_minute_to_mp()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_type text; v_statut text; v_user uuid;
BEGIN
  IF NEW.produit_id IS NULL THEN RETURN NEW; END IF;
  SELECT type_production INTO v_type FROM public.produits WHERE id = NEW.produit_id;
  IF v_type <> 'minute' THEN RETURN NEW; END IF;
  SELECT statut, created_by INTO v_statut, v_user FROM public.ventes WHERE id = NEW.vente_id;
  IF v_statut IN ('annulee','credit_pending') THEN RETURN NEW; END IF;
  PERFORM public.deduire_mps_from_fiche(NEW.produit_id, NEW.quantite, 'conso_minute',
          'vente_lignes', NEW.id, CURRENT_DATE, v_user);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_vente_minute_mp ON public.vente_lignes;
CREATE TRIGGER trg_vente_minute_mp AFTER INSERT ON public.vente_lignes
  FOR EACH ROW EXECUTE FUNCTION public.trg_vente_minute_to_mp();

-- 8) Vue v_mp_stock
CREATE OR REPLACE VIEW public.v_mp_stock AS
SELECT
  mp.id, mp.nom, mp.unite, mp.fournisseur, mp.prix_unitaire, mp.stock_min,
  COALESCE(SUM(m.quantite) FILTER (WHERE m.type = 'achat'), 0) AS total_achete,
  ABS(COALESCE(SUM(m.quantite) FILTER (WHERE m.quantite < 0), 0)) AS total_consomme,
  COALESCE(SUM(m.quantite), 0) AS stock_actuel,
  COALESCE(SUM(m.quantite), 0) * COALESCE(mp.prix_unitaire,0) AS valeur_stock,
  MAX(m.created_at) FILTER (WHERE m.type = 'achat') AS derniere_entree,
  MAX(m.created_at) FILTER (WHERE m.quantite < 0) AS derniere_sortie,
  ABS(COALESCE(SUM(m.quantite) FILTER (WHERE m.quantite < 0 AND m.date_mouvement >= CURRENT_DATE - 30), 0)) AS conso_30j,
  (COALESCE(SUM(m.quantite), 0) <= COALESCE(mp.stock_min, 0)) AS alerte_stock,
  EXISTS(SELECT 1 FROM public.mp_mouvements x WHERE x.matiere_premiere_id = mp.id AND x.regularisation_requise = true AND x.resolved_at IS NULL) AS a_anomalies
FROM public.matieres_premieres mp
LEFT JOIN public.mp_mouvements m ON m.matiere_premiere_id = mp.id
WHERE mp.actif = true
GROUP BY mp.id;

GRANT SELECT ON public.v_mp_stock TO authenticated;

-- 9) Permissions suivi_stock (sans ON CONFLICT, on insÃ¨re si absent)
INSERT INTO public.module_permissions (role, module, can_read, can_create, can_update, can_delete)
SELECT v.role, 'suivi_stock', v.r, v.c, v.u, v.d
FROM (VALUES
  ('ceo'::app_role, true, true, true, true),
  ('economat'::app_role, true, true, true, false),
  ('labo_patisserie'::app_role, true, false, false, false),
  ('labo_viennoiserie'::app_role, true, false, false, false),
  ('cuisine_salee'::app_role, true, false, false, false),
  ('salle'::app_role, false, false, false, false)
) AS v(role, r, c, u, d)
WHERE NOT EXISTS (SELECT 1 FROM public.module_permissions mp WHERE mp.role = v.role AND mp.module = 'suivi_stock');

-- 10) Backfill achats_mp -> mp_mouvements
INSERT INTO public.mp_mouvements (matiere_premiere_id, date_mouvement, type, quantite, source_table, source_id, motif, created_by, created_at)
SELECT
  COALESCE(a.matiere_premiere_id,
           (SELECT id FROM public.matieres_premieres mp WHERE lower(trim(mp.nom)) = lower(trim(a.produit)) LIMIT 1)),
  a.date_achat, 'achat', a.quantite, 'achats_mp', a.id,
  'Backfill achat â€” '||COALESCE(a.fournisseur,''), a.created_by, a.created_at
FROM public.achats_mp a
WHERE NOT EXISTS (SELECT 1 FROM public.mp_mouvements m WHERE m.source_table='achats_mp' AND m.source_id = a.id)
AND COALESCE(a.matiere_premiere_id,
           (SELECT id FROM public.matieres_premieres mp WHERE lower(trim(mp.nom)) = lower(trim(a.produit)) LIMIT 1)) IS NOT NULL;

-- Backfill production_labo
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT * FROM public.production_labo WHERE qte_produite > 0
           AND NOT EXISTS (SELECT 1 FROM public.mp_mouvements m WHERE m.source_table='production_labo' AND m.source_id = production_labo.id)
  LOOP
    PERFORM public.deduire_mps_from_fiche(r.produit_id, r.qte_produite, 'conso_labo', 'production_labo', r.id, r.date_production, r.created_by);
  END LOOP;
END $$;

UPDATE public.mp_mouvements SET regularisation_requise = false
WHERE motif LIKE 'Backfill%' OR motif LIKE 'Production:%' AND created_at < now() - interval '1 hour';


-- ============================================================
-- 20260619095450_da01d361-1a84-41be-b7bb-95da0df3a48c.sql
-- ============================================================
ALTER VIEW public.v_mp_stock SET (security_invoker = true);

DROP POLICY IF EXISTS mp_mvt_insert_auth ON public.mp_mouvements;
CREATE POLICY mp_mvt_insert_ceo ON public.mp_mouvements
  FOR INSERT TO authenticated
  WITH CHECK (public.is_ceo(auth.uid()));

CREATE POLICY notifications_insert_ceo ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (public.is_ceo(auth.uid()));

-- ============================================================
-- 20260622004415_750a870a-17e4-47a9-835c-c52240e671a4.sql
-- ============================================================
CREATE POLICY "rapports_journaliers_delete_ceo" ON public.rapports_journaliers FOR DELETE TO authenticated USING (public.is_ceo(auth.uid()));

-- ============================================================
-- 20260701120000_add_production_consumption_trigger.sql
-- ============================================================
create or replace function public.update_consommation_mp() returns trigger language plpgsql as $$
begin
  -- When a new production_labo row is inserted, update the corresponding bon_transfert ligne
  -- Assuming a relation via bon_transfert_id stored in production_labo; adjust as needed
  if NEW.bon_transfert_id is not null then
    update public.bon_transfert_lignes
    set qte_prevue = qte_prevue + NEW.quantite_produite
    where bon_transfert_id = NEW.bon_transfert_id;
  end if;
  return NEW;
end;
$$;

create trigger trg_update_consommation_mp
after insert on public.production_labo
for each row execute function public.update_consommation_mp();


-- ============================================================
-- 20260908111007_cbc9ab5d-724b-4a21-8544-f9326673db34.sql
-- ============================================================
CREATE TABLE IF NOT EXISTS public.parametres_email (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  destinataire text NOT NULL DEFAULT 'al.fanar@hotmail.fr',
  copies text[] NOT NULL DEFAULT ARRAY['nkro006@gmail.com'],
  expediteur_nom text NOT NULL DEFAULT 'SAADÃ‰ Rapports',
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.parametres_email TO authenticated;
GRANT ALL ON public.parametres_email TO service_role;

ALTER TABLE public.parametres_email ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ceo_manage_parametres_email" ON public.parametres_email;
CREATE POLICY "ceo_manage_parametres_email" ON public.parametres_email
  FOR ALL TO authenticated
  USING (public.is_ceo(auth.uid()))
  WITH CHECK (public.is_ceo(auth.uid()));

INSERT INTO public.parametres_email (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 20260909000748_4f0d3543-2e5a-4ec9-8ebe-996558573991.sql
-- ============================================================
ALTER TABLE public.parametres_email
  ADD COLUMN IF NOT EXISTS expediteur_email text NOT NULL DEFAULT 'onboarding@resend.dev',
  ADD COLUMN IF NOT EXISTS domaine_verifie boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS derniere_erreur text;

-- ============================================================
-- 20260910065655_ad468e53-1354-4170-9906-3cdcfa22513f.sql
-- ============================================================
ALTER TABLE public.parametres_email ADD COLUMN IF NOT EXISTS cron_token UUID NOT NULL DEFAULT gen_random_uuid();
UPDATE public.parametres_email SET expediteur_email = 'rapports@saadenobaddays.store', domaine_verifie = true WHERE id = true;

-- ============================================================
-- 20260910120000_mp_mouvements_insert_suivi_stock.sql
-- ============================================================
-- Correctif RLS : l'Ã‰conomat ne peut plus insÃ©rer de mouvement MP
-- (erreur rapportÃ©e : "new row violates row level security policy for table mp_mouvements")
--
-- Contexte :
--   La migration 20260619095450 a remplacÃ© la politique d'INSERT permissive
--   (mp_mvt_insert_auth : WITH CHECK true) par mp_mvt_insert_ceo qui ne permet
--   QUE les CEO. Or la matrice module_permissions donne au rÃ´le 'economat'
--   can_create=true sur le module 'suivi_stock', et l'Ã©cran
--   "Suivi de Stock â†’ MP temps rÃ©el â†’ Ajuster" (SuiviStock.tsx) insÃ¨re un
--   mouvement de type 'ajustement' dans public.mp_mouvements.
--
--   can_perform() short-circuite dÃ©jÃ  le CEO (retourne true), donc une
--   seule politique alignÃ©e sur la matrice suffit, cohÃ©rente avec les
--   politiques UPDATE (mp_mvt_update_ceo_eco) et le reste du schÃ©ma.

DROP POLICY IF EXISTS mp_mvt_insert_ceo ON public.mp_mouvements;
DROP POLICY IF EXISTS mp_mvt_insert_suivi_stock ON public.mp_mouvements;

CREATE POLICY mp_mvt_insert_suivi_stock ON public.mp_mouvements
  FOR INSERT TO authenticated
  WITH CHECK (public.can_perform(auth.uid(), 'suivi_stock', 'create'));

