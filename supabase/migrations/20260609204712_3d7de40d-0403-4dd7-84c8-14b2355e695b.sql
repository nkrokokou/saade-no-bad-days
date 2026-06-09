
CREATE OR REPLACE FUNCTION public.generer_alertes_systeme()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r RECORD; v_stock numeric;
BEGIN
  -- Stock économat critique
  FOR r IN
    SELECT a.id, a.nom, a.stock_min,
           a.stock_initial + COALESCE((
             SELECT SUM(CASE WHEN m.type='entree' THEN m.quantite ELSE -m.quantite END)
             FROM economat_mouvements m WHERE m.article_id = a.id
           ),0) AS stock
    FROM economat_articles a
    WHERE a.actif = true AND a.stock_min IS NOT NULL AND a.stock_min > 0
  LOOP
    IF r.stock <= r.stock_min THEN
      IF NOT EXISTS (SELECT 1 FROM notifications WHERE type='stock_critique' AND lien=r.id::text AND created_at::date = CURRENT_DATE) THEN
        INSERT INTO notifications(role_cible, type, titre, message, severite, lien)
        VALUES ('ceo','stock_critique','Stock critique',
                r.nom || ' : ' || r.stock || ' (seuil ' || r.stock_min || ')','warning',r.id::text);
        INSERT INTO notifications(role_cible, type, titre, message, severite, lien)
        VALUES ('economat','stock_critique','Stock critique',
                r.nom || ' : ' || r.stock || ' (seuil ' || r.stock_min || ')','warning',r.id::text);
      END IF;
    END IF;
  END LOOP;

  -- Écart caisse > 2000
  FOR r IN SELECT id, ecart FROM sessions_caisse
           WHERE statut LIKE 'fermee%' AND ABS(COALESCE(ecart,0)) > 2000
             AND ferme_at::date = CURRENT_DATE LOOP
    IF NOT EXISTS (SELECT 1 FROM notifications WHERE type='ecart_caisse' AND lien=r.id::text) THEN
      INSERT INTO notifications(role_cible, type, titre, message, severite, lien)
      VALUES ('ceo','ecart_caisse','Écart de caisse',
              'Écart de ' || r.ecart || ' F CFA détecté','warning',r.id::text);
    END IF;
  END LOOP;

  -- Crédits > 30j
  FOR r IN SELECT id, montant_restant FROM credits_clients
           WHERE statut='ouvert' AND created_at < now() - interval '30 days' LOOP
    IF NOT EXISTS (SELECT 1 FROM notifications WHERE type='credit_ancien' AND lien=r.id::text AND created_at > now() - interval '7 days') THEN
      INSERT INTO notifications(role_cible, type, titre, message, severite, lien)
      VALUES ('ceo','credit_ancien','Crédit non soldé > 30j',
              'Crédit de ' || r.montant_restant || ' F CFA en attente','danger',r.id::text);
    END IF;
  END LOOP;
END $$;

REVOKE EXECUTE ON FUNCTION public.generer_alertes_systeme() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generer_alertes_systeme() TO service_role, postgres;
