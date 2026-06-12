
-- 1) Finaliser dev role : is_user_hidden + is_ceo étendu + audit log
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
