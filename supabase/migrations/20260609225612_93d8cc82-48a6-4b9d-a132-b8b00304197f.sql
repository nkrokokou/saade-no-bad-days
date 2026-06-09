
-- ========== HELPER: reassign FK refs from old IDs to a keeper ID ==========

-- 1) PRODUITS — dédoublonnage par lower(trim(nom))
DO $$
DECLARE
  rec RECORD;
  keeper UUID;
  dup_ids UUID[];
BEGIN
  FOR rec IN
    SELECT lower(trim(nom)) AS key, array_agg(id ORDER BY created_at NULLS LAST, id) AS ids
    FROM public.produits
    GROUP BY 1
    HAVING count(*) > 1
  LOOP
    keeper := rec.ids[1];
    dup_ids := rec.ids[2:array_length(rec.ids,1)];

    UPDATE public.bon_transfert_lignes   SET produit_id = keeper WHERE produit_id = ANY(dup_ids);
    UPDATE public.stock_tampon           SET produit_id = keeper WHERE produit_id = ANY(dup_ids);
    UPDATE public.pertes                 SET produit_id = keeper WHERE produit_id = ANY(dup_ids);
    UPDATE public.production_labo        SET produit_id = keeper WHERE produit_id = ANY(dup_ids);
    UPDATE public.cloture_journaliere    SET produit_id = keeper WHERE produit_id = ANY(dup_ids);
    UPDATE public.degustations           SET produit_id = keeper WHERE produit_id = ANY(dup_ids);
    UPDATE public.mouvements_stock       SET produit_id = keeper WHERE produit_id = ANY(dup_ids);
    UPDATE public.vente_lignes           SET produit_id = keeper WHERE produit_id = ANY(dup_ids);
    -- fiches : on déplace puis on dédoublonnera plus bas
    UPDATE public.fiches_techniques      SET produit_id = keeper WHERE produit_id = ANY(dup_ids);
    -- meta : peut conflicter (clé unique à venir), donc on supprime les doublons côté dups d'abord
    DELETE FROM public.fiches_techniques_meta WHERE produit_id = ANY(dup_ids);

    DELETE FROM public.produits WHERE id = ANY(dup_ids);
  END LOOP;
END $$;

-- 2) MATIERES_PREMIERES — dédoublonnage par lower(trim(nom))
DO $$
DECLARE
  rec RECORD;
  keeper UUID;
  dup_ids UUID[];
BEGIN
  FOR rec IN
    SELECT lower(trim(nom)) AS key, array_agg(id ORDER BY created_at NULLS LAST, id) AS ids
    FROM public.matieres_premieres
    GROUP BY 1
    HAVING count(*) > 1
  LOOP
    keeper := rec.ids[1];
    dup_ids := rec.ids[2:array_length(rec.ids,1)];
    UPDATE public.fiches_techniques SET matiere_premiere_id = keeper WHERE matiere_premiere_id = ANY(dup_ids);
    -- achats_mp ne référence pas par FK uuid (texte fournisseur/produit), rien à faire
    DELETE FROM public.matieres_premieres WHERE id = ANY(dup_ids);
  END LOOP;
END $$;

-- 3) CATEGORIES_PRODUITS — dédoublonnage par lower(trim(nom))
DO $$
DECLARE
  rec RECORD;
  dup_ids UUID[];
BEGIN
  FOR rec IN
    SELECT lower(trim(nom)) AS key, array_agg(id ORDER BY created_at NULLS LAST, id) AS ids
    FROM public.categories_produits
    GROUP BY 1
    HAVING count(*) > 1
  LOOP
    dup_ids := rec.ids[2:array_length(rec.ids,1)];
    DELETE FROM public.categories_produits WHERE id = ANY(dup_ids);
  END LOOP;
END $$;

-- 4) ECONOMAT_ARTICLES — dédoublonnage par lower(trim(nom))
DO $$
DECLARE
  rec RECORD;
  keeper UUID;
  dup_ids UUID[];
BEGIN
  FOR rec IN
    SELECT lower(trim(nom)) AS key, array_agg(id ORDER BY created_at NULLS LAST, id) AS ids
    FROM public.economat_articles
    GROUP BY 1
    HAVING count(*) > 1
  LOOP
    keeper := rec.ids[1];
    dup_ids := rec.ids[2:array_length(rec.ids,1)];
    UPDATE public.economat_mouvements SET article_id = keeper WHERE article_id = ANY(dup_ids);
    DELETE FROM public.economat_articles WHERE id = ANY(dup_ids);
  END LOOP;
END $$;

-- 5) CLIENTS — dédoublonnage par lower(trim(nom))
DO $$
DECLARE
  rec RECORD;
  keeper UUID;
  dup_ids UUID[];
BEGIN
  FOR rec IN
    SELECT lower(trim(nom)) AS key, array_agg(id ORDER BY created_at NULLS LAST, id) AS ids
    FROM public.clients
    GROUP BY 1
    HAVING count(*) > 1
  LOOP
    keeper := rec.ids[1];
    dup_ids := rec.ids[2:array_length(rec.ids,1)];
    UPDATE public.credits_clients SET client_id = keeper WHERE client_id = ANY(dup_ids);
    UPDATE public.ventes          SET client_id = keeper WHERE client_id = ANY(dup_ids);
    DELETE FROM public.clients WHERE id = ANY(dup_ids);
  END LOOP;
END $$;

-- 6) FICHES_TECHNIQUES — un seul ingrédient identique par produit
DELETE FROM public.fiches_techniques a
USING public.fiches_techniques b
WHERE a.produit_id = b.produit_id
  AND lower(trim(a.matiere_premiere)) = lower(trim(b.matiere_premiere))
  AND a.created_at > b.created_at;

-- doublons restants avec même created_at : on garde le plus petit id
DELETE FROM public.fiches_techniques a
USING public.fiches_techniques b
WHERE a.produit_id = b.produit_id
  AND lower(trim(a.matiere_premiere)) = lower(trim(b.matiere_premiere))
  AND a.id > b.id;

-- 7) FICHES_TECHNIQUES_META — un seul enregistrement par produit
DELETE FROM public.fiches_techniques_meta a
USING public.fiches_techniques_meta b
WHERE a.produit_id = b.produit_id
  AND a.id > b.id;

-- ========== CONTRAINTES D'UNICITÉ (anti-doublons futurs) ==========
CREATE UNIQUE INDEX IF NOT EXISTS produits_nom_unique_idx           ON public.produits (lower(trim(nom)));
CREATE UNIQUE INDEX IF NOT EXISTS matieres_premieres_nom_unique_idx ON public.matieres_premieres (lower(trim(nom)));
CREATE UNIQUE INDEX IF NOT EXISTS categories_produits_nom_unique_idx ON public.categories_produits (lower(trim(nom)));
CREATE UNIQUE INDEX IF NOT EXISTS economat_articles_nom_unique_idx  ON public.economat_articles (lower(trim(nom)));
CREATE UNIQUE INDEX IF NOT EXISTS fiches_techniques_meta_produit_unique_idx ON public.fiches_techniques_meta (produit_id);
CREATE UNIQUE INDEX IF NOT EXISTS fiches_techniques_produit_mp_unique_idx ON public.fiches_techniques (produit_id, lower(trim(matiere_premiere)));
