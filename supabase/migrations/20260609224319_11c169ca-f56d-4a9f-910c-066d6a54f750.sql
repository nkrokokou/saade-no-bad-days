ALTER TABLE public.fiches_techniques ADD COLUMN IF NOT EXISTS section text;
ALTER TABLE public.fiches_techniques ADD COLUMN IF NOT EXISTS ordre integer;

ALTER TABLE public.fiches_techniques_meta ADD COLUMN IF NOT EXISTS moule text;
ALTER TABLE public.fiches_techniques_meta ADD COLUMN IF NOT EXISTS taille_longueur text;
ALTER TABLE public.fiches_techniques_meta ADD COLUMN IF NOT EXISTS taille_hauteur text;
ALTER TABLE public.fiches_techniques_meta ADD COLUMN IF NOT EXISTS diametre text;
ALTER TABLE public.fiches_techniques_meta ADD COLUMN IF NOT EXISTS diametre_secondaire text;
ALTER TABLE public.fiches_techniques_meta ADD COLUMN IF NOT EXISTS qte_recette numeric;