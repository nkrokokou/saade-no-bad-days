
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
          'Achat — '||COALESCE(NEW.fournisseur,''), NEW.created_by);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_achat_mp_stock ON public.achats_mp;
CREATE TRIGGER trg_achat_mp_stock AFTER INSERT ON public.achats_mp
  FOR EACH ROW EXECUTE FUNCTION public.trg_achat_mp_to_stock();

-- 5) Fonction déduction MP depuis fiche
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
      VALUES ('ceo','rupture_mp','Rupture MP détectée',
              COALESCE(r.matiere_premiere,'MP')||' : sur-consommation de '||ABS(v_stock_apres)::text||' lors de '||COALESCE(v_produit_nom,'?'),
              'danger', r.matiere_premiere_id::text);
      INSERT INTO public.notifications(role_cible, type, titre, message, severite, lien)
      VALUES ('economat','rupture_mp','Rupture MP détectée',
              COALESCE(r.matiere_premiere,'MP')||' : régulariser stock',
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

-- 9) Permissions suivi_stock (sans ON CONFLICT, on insère si absent)
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
  'Backfill achat — '||COALESCE(a.fournisseur,''), a.created_by, a.created_at
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
