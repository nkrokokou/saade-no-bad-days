CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TABLE public.audits_ceo (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date_audit DATE NOT NULL DEFAULT CURRENT_DATE,
  rubriques JSONB NOT NULL DEFAULT '{}'::jsonb,
  defauts TEXT,
  ameliorations TEXT,
  commentaires TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.audits_ceo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "CEO can view audits" ON public.audits_ceo FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'ceo'));

CREATE POLICY "CEO can insert audits" ON public.audits_ceo FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'ceo'));

CREATE POLICY "CEO can update audits" ON public.audits_ceo FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'ceo'));

CREATE POLICY "CEO can delete audits" ON public.audits_ceo FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'ceo'));

CREATE TRIGGER update_audits_ceo_updated_at
BEFORE UPDATE ON public.audits_ceo
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_audits_ceo_date ON public.audits_ceo(date_audit DESC);