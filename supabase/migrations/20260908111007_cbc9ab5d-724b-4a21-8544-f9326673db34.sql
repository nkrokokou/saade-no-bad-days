CREATE TABLE IF NOT EXISTS public.parametres_email (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  destinataire text NOT NULL DEFAULT 'al.fanar@hotmail.fr',
  copies text[] NOT NULL DEFAULT ARRAY['nkro006@gmail.com'],
  expediteur_nom text NOT NULL DEFAULT 'SAADÉ Rapports',
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