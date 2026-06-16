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
       rendement_unite = COALESCE(rendement_unite, 'pièces'),
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