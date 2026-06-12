
-- 1) PERMISSIONS
ALTER TABLE public.module_permissions
  DROP CONSTRAINT IF EXISTS module_permissions_role_module_key;
CREATE UNIQUE INDEX IF NOT EXISTS module_permissions_role_module_submodule_key
  ON public.module_permissions (role, module, COALESCE(submodule, ''));

-- 2) FICHES TECHNIQUES
UPDATE public.fiches_techniques f
   SET cout_unitaire_mp = m.prix_unitaire
  FROM public.matieres_premieres m
 WHERE f.matiere_premiere_id = m.id
   AND f.cout_unitaire_mp IS DISTINCT FROM m.prix_unitaire;

UPDATE public.fiches_techniques f
   SET cout_unitaire_mp = m.prix_unitaire,
       matiere_premiere_id = m.id
  FROM public.matieres_premieres m
 WHERE f.matiere_premiere_id IS NULL
   AND lower(trim(f.matiere_premiere)) = lower(trim(m.nom));

UPDATE public.produits p
   SET prix_cout = COALESCE((
     SELECT SUM(quantite_mp * cout_unitaire_mp)
       FROM public.fiches_techniques
      WHERE produit_id = p.id
   ), 0),
       updated_at = now();

-- 3) RÔLE DEV + flag is_hidden (sans utiliser developer dans une fonction)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'developer';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false;
