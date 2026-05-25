
CREATE TABLE public.rapports_journaliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date_rapport DATE NOT NULL UNIQUE,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  email_destinataire TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.rapports_journaliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "CEO read rapports"
  ON public.rapports_journaliers FOR SELECT
  TO authenticated
  USING (public.is_ceo(auth.uid()));

CREATE POLICY "CEO insert rapports"
  ON public.rapports_journaliers FOR INSERT
  TO authenticated
  WITH CHECK (public.is_ceo(auth.uid()));

CREATE POLICY "CEO update rapports"
  ON public.rapports_journaliers FOR UPDATE
  TO authenticated
  USING (public.is_ceo(auth.uid()));

CREATE TRIGGER trg_rapports_updated_at
  BEFORE UPDATE ON public.rapports_journaliers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_rapports_date ON public.rapports_journaliers (date_rapport DESC);
