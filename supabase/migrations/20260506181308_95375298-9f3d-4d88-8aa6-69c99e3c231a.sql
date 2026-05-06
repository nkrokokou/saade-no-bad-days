-- 1. Lien direct achats → MP référentiel
ALTER TABLE public.achats_mp
  ADD COLUMN IF NOT EXISTS matiere_premiere_id UUID REFERENCES public.matieres_premieres(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_achats_mp_mp_id ON public.achats_mp(matiere_premiere_id);

-- 2. Seuil d'alerte stock
ALTER TABLE public.matieres_premieres
  ADD COLUMN IF NOT EXISTS stock_min NUMERIC NOT NULL DEFAULT 0;

-- 3. Vue stock MP en temps réel
CREATE OR REPLACE VIEW public.v_stock_matieres_premieres AS
WITH achats AS (
  SELECT
    COALESCE(a.matiere_premiere_id, mp.id) AS mp_id,
    SUM(a.quantite) AS total_achete
  FROM public.achats_mp a
  LEFT JOIN public.matieres_premieres mp
    ON mp.id = a.matiere_premiere_id
    OR (a.matiere_premiere_id IS NULL AND lower(trim(mp.nom)) = lower(trim(a.produit)))
  WHERE COALESCE(a.matiere_premiere_id, mp.id) IS NOT NULL
  GROUP BY COALESCE(a.matiere_premiere_id, mp.id)
),
conso AS (
  SELECT
    ft.matiere_premiere_id AS mp_id,
    SUM(COALESCE(pl.qte_produite, 0) * ft.quantite_mp) AS total_consomme
  FROM public.fiches_techniques ft
  JOIN public.production_labo pl ON pl.produit_id = ft.produit_id
  WHERE ft.matiere_premiere_id IS NOT NULL
  GROUP BY ft.matiere_premiere_id
)
SELECT
  mp.id,
  mp.nom,
  mp.unite,
  mp.fournisseur,
  mp.prix_unitaire,
  mp.stock_min,
  COALESCE(a.total_achete, 0)   AS total_achete,
  COALESCE(c.total_consomme, 0) AS total_consomme,
  COALESCE(a.total_achete, 0) - COALESCE(c.total_consomme, 0) AS stock_actuel,
  CASE
    WHEN COALESCE(a.total_achete, 0) - COALESCE(c.total_consomme, 0) <= mp.stock_min
    THEN true ELSE false
  END AS alerte_stock
FROM public.matieres_premieres mp
LEFT JOIN achats a ON a.mp_id = mp.id
LEFT JOIN conso  c ON c.mp_id = mp.id
WHERE mp.actif = true;

GRANT SELECT ON public.v_stock_matieres_premieres TO authenticated;