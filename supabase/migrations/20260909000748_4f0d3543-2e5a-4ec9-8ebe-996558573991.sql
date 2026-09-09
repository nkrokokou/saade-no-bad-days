ALTER TABLE public.parametres_email
  ADD COLUMN IF NOT EXISTS expediteur_email text NOT NULL DEFAULT 'onboarding@resend.dev',
  ADD COLUMN IF NOT EXISTS domaine_verifie boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS derniere_erreur text;