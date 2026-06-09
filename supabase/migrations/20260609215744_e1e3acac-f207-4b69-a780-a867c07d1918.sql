ALTER TABLE public.bons_transfert
  DROP CONSTRAINT IF EXISTS bons_transfert_statut_check;

ALTER TABLE public.bons_transfert
  ADD CONSTRAINT bons_transfert_statut_check
  CHECK (statut IN ('brouillon', 'envoye', 'recu', 'valide', 'livre', 'cloture'));

UPDATE public.bons_transfert
SET statut = CASE statut
  WHEN 'livre' THEN 'envoye'
  WHEN 'cloture' THEN 'valide'
  ELSE statut
END
WHERE statut IN ('livre', 'cloture');