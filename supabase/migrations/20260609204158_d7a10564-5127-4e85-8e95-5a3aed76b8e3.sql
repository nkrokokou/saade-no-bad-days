
CREATE OR REPLACE FUNCTION public.sync_achat_to_economat()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_article_id uuid;
BEGIN
  -- Tente de matcher par nom exact (case-insensitive)
  SELECT id INTO v_article_id
    FROM public.economat_articles
    WHERE lower(trim(nom)) = lower(trim(NEW.produit))
    LIMIT 1;

  IF v_article_id IS NOT NULL THEN
    INSERT INTO public.economat_mouvements (article_id, date_mouvement, type, quantite, motif, created_by)
    VALUES (v_article_id, NEW.date_achat, 'entree', NEW.quantite,
            'Achat MP auto — '||COALESCE(NEW.fournisseur,'fournisseur')||' ('||NEW.id||')',
            NEW.created_by);
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW; -- jamais bloquer l'achat MP
END $$;

REVOKE EXECUTE ON FUNCTION public.sync_achat_to_economat() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_sync_achat_to_economat ON public.achats_mp;
CREATE TRIGGER trg_sync_achat_to_economat
  AFTER INSERT ON public.achats_mp
  FOR EACH ROW EXECUTE FUNCTION public.sync_achat_to_economat();
