
-- ============================================================
-- 1. AUDIT LOGS AUTOMATIQUES via TRIGGERS
-- ============================================================

-- Fonction générique pour logger automatiquement (SECURITY DEFINER pour bypass RLS)
CREATE OR REPLACE FUNCTION public.log_audit_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_email text;
  v_record_id uuid;
  v_action text;
  v_details jsonb;
BEGIN
  -- Ne logge que si on a un user authentifié (évite les triggers techniques)
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Récupère l'email depuis auth.users
  BEGIN
    SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;
  EXCEPTION WHEN OTHERS THEN
    v_email := NULL;
  END;

  IF TG_OP = 'INSERT' THEN
    v_action := 'create';
    v_record_id := NEW.id;
    v_details := jsonb_build_object('new', to_jsonb(NEW));
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'update';
    v_record_id := NEW.id;
    v_details := jsonb_build_object('changes',
      (SELECT jsonb_object_agg(key, value)
       FROM jsonb_each(to_jsonb(NEW))
       WHERE to_jsonb(NEW)->key IS DISTINCT FROM to_jsonb(OLD)->key
         AND key NOT IN ('updated_at')));
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'delete';
    v_record_id := OLD.id;
    v_details := jsonb_build_object('old', to_jsonb(OLD));
  END IF;

  INSERT INTO public.audit_logs (user_id, user_email, action, table_name, record_id, details)
  VALUES (v_user_id, COALESCE(v_email, ''), v_action, TG_TABLE_NAME, v_record_id, COALESCE(v_details, '{}'::jsonb));

  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  -- Ne jamais bloquer l'action métier si le log échoue
  RETURN COALESCE(NEW, OLD);
END $$;

-- Attache le trigger sur les tables clés
DO $$
DECLARE
  t text;
  target_tables text[] := ARRAY[
    'produits','matieres_premieres','fiches_techniques','achats_mp',
    'bons_transfert','bon_transfert_lignes','production_labo','inventaire',
    'pertes','degustations','cloture_journaliere','ventes','vente_lignes',
    'sessions_caisse','clients','credits_clients','paiements_credits',
    'categories_produits','tables_restaurant','stock_tampon','mouvements_stock',
    'audits_ceo'
  ];
BEGIN
  FOREACH t IN ARRAY target_tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%I ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER trg_audit_%I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.log_audit_change()', t, t);
  END LOOP;
END $$;

-- Ouvre les policies INSERT car les triggers (security definer) bypass mais on conserve l'integrité
-- La policy existante exige auth.uid() = user_id ce qui est OK car la fonction met user_id := auth.uid()
-- On élargit pour permettre INSERT depuis trigger SECURITY DEFINER
DROP POLICY IF EXISTS "Authenticated can insert audit" ON public.audit_logs;
CREATE POLICY "Authenticated can insert audit"
  ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (true);

-- ============================================================
-- 2. TICKET TEMPLATES (configuration CEO)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ticket_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL UNIQUE CHECK (type IN ('cuisine','caisse')),
  header_title text NOT NULL DEFAULT 'SAADÉ',
  header_subtitle text DEFAULT 'PÂTISSERIE · SNACK · CONCEPT STORE',
  header_address text DEFAULT 'Lomé · Togo',
  header_phone text DEFAULT '',
  footer_message text DEFAULT 'Merci de votre visite',
  footer_legal text DEFAULT '',
  show_ticket_number boolean NOT NULL DEFAULT true,
  show_datetime boolean NOT NULL DEFAULT true,
  show_serveur boolean NOT NULL DEFAULT true,
  show_table boolean NOT NULL DEFAULT true,
  show_caissier boolean NOT NULL DEFAULT true,
  show_prices boolean NOT NULL DEFAULT true,
  show_payment_mode boolean NOT NULL DEFAULT true,
  show_change boolean NOT NULL DEFAULT true,
  exclude_boissons boolean NOT NULL DEFAULT true,
  group_by_category boolean NOT NULL DEFAULT false,
  font_size_px int NOT NULL DEFAULT 12,
  paper_width_mm int NOT NULL DEFAULT 80,
  extra_css text DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT SELECT ON public.ticket_templates TO authenticated;
GRANT INSERT, UPDATE ON public.ticket_templates TO authenticated;
GRANT ALL ON public.ticket_templates TO service_role;

ALTER TABLE public.ticket_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "all auth read ticket templates"
  ON public.ticket_templates FOR SELECT TO authenticated USING (true);

CREATE POLICY "ceo insert ticket templates"
  ON public.ticket_templates FOR INSERT TO authenticated
  WITH CHECK (is_ceo(auth.uid()));

CREATE POLICY "ceo update ticket templates"
  ON public.ticket_templates FOR UPDATE TO authenticated
  USING (is_ceo(auth.uid()))
  WITH CHECK (is_ceo(auth.uid()));

CREATE TRIGGER set_ticket_templates_updated_at
  BEFORE UPDATE ON public.ticket_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed defaults
INSERT INTO public.ticket_templates (type, show_prices, show_payment_mode, show_change, exclude_boissons)
VALUES
  ('cuisine', false, false, false, true),
  ('caisse',  true,  true,  true,  false)
ON CONFLICT (type) DO NOTHING;
