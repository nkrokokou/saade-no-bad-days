# Rapport journalier automatique CEO

## Objectif
Envoyer chaque soir à 23h00 (heure Lomé / UTC) un email récapitulatif de la journée à `al.fanar@hotmail.fr`.

## Architecture

```text
pg_cron (23h00)
   └─► appelle edge function: rapport-journalier-ceo
          ├─► agrège données du jour (ventes, caisse, clôture, pertes, top produits)
          ├─► génère HTML email (charté SAADÉ : crème/caramel/espresso)
          ├─► insère dans table rapports_journaliers (historique + visible dans l'app)
          └─► envoie via Resend → al.fanar@hotmail.fr
```

## Contenu du rapport

**En-tête** : Date, jour de semaine

**Bloc 1 — Chiffre d'affaires**
- CA total du jour
- Nombre de tickets
- Panier moyen
- Répartition par mode de paiement (espèces / mobile money / carte / crédit)

**Bloc 2 — Caisse**
- Sessions de caisse ouvertes/fermées
- Fond de caisse théorique vs compté
- Écart caisse (si > 0)

**Bloc 3 — Top 5 produits vendus**
- Nom + quantité + CA

**Bloc 4 — Clôture journalière**
- Nombre de produits avec perte
- Valeur totale invendus (-50%)
- Alertes : produits sans clôture saisie

**Bloc 5 — Crédits clients**
- Nouveaux crédits accordés
- Paiements reçus
- Total encours

**Pied** : Lien vers le dashboard

## Étapes d'implémentation

1. **Connecter Resend** via le connector (vous créez un compte gratuit avec `al.fanar@hotmail.fr`)
2. **Migration DB** : créer table `rapports_journaliers` (date, payload JSON, sent_at, status)
3. **Edge function `rapport-journalier-ceo`** :
   - Agrège toutes les données du jour
   - Render HTML brandé SAADÉ
   - Sauvegarde + envoie via Resend
   - Idempotent (ne renvoie pas 2× le même jour)
4. **CRON pg_cron** : déclenche la fonction tous les jours à 23h00
5. **Page `/rapports-ceo`** (accès CEO uniquement) : historique des rapports, bouton "Envoyer maintenant" pour tester
6. **Mise à jour guide utilisateur v4** : nouveau module rapport CEO

## Détails techniques

- **Sender Resend** : `SAADÉ <onboarding@resend.dev>` au début, basculera vers `notify@votredomaine` quand domaine ajouté
- **Idempotence** : contrainte UNIQUE sur `date` dans `rapports_journaliers`
- **Fuseau horaire** : Lomé = UTC, donc CRON `0 23 * * *` UTC
- **Gestion erreur** : si Resend échoue, on log l'erreur dans `status='failed'` + visible dans la page rapports
- **Permissions** : page `/rapports-ceo` réservée au rôle `ceo`

## Migration vers domaine plus tard
Quand vous achetez un domaine, il suffit de :
1. Vérifier le domaine dans Resend (ajout DNS)
2. Changer le sender dans 1 ligne de code
3. Plus aucune limite d'envoi
