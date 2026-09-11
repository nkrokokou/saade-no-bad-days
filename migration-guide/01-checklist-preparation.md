# Migration SAADÉ vers votre propre Supabase — Checklist

## Étape 0 — Créer le projet Supabase (vous)

1. Créez un compte sur **https://supabase.com** (gratuit).
2. **New project** → choisissez un nom (ex: `saade-boutique`) + mot de passe base.
   - Notez la **region** (idéalement proche de Lomé : `eu-central-1` ou `eu-west-1`).
3. Depuis le dashboard du projet, récupérez dans **Settings → API** :
   - [ ] **Project URL** (ex: `https://XXXXXXXX.supabase.co`)
   - [ ] **anon / publishable key**
   - [ ] **service_role key** (⚠️ secret, ne jamais la mettre dans le frontend)
4. Dans **Settings → Database**, notez :
   - [ ] **Connection string** (pour le CLI Supabase)

> 💡 Gardez ces 4 valeurs sous la main — vous en aurez besoin aux étapes 3 à 7.

## Étape 1 — Inventaire (déjà fait ✅)

- Bundle SQL complet : `00-schema-complet.sql` (69 migrations)
- 4 Edge Functions : `rapport-journalier-ceo`, `send-audit-ceo`, `ai-insights`, `manage-users`
- 3 cron jobs, 1 bucket storage (`evidence-photos`), realtime sur ~11 tables

## Étape 2 — Exporter les données depuis Lovable Cloud

Option A (recommandée) : **Lovable → More → Cloud → Advanced Settings → Export your data**
- Si un export complet (dump) est disponible, téléchargez-le et gardez-le précieusement.

Option B : export CSV table par table dans **Lovable → More → Cloud → Database**
- Bouton **Export CSV** dans chaque table (~40 tables, long mais fiable).

> ⚠️ Les comptes utilisateurs (auth) ne s'exportent pas. Ils seront recréés à l'étape 4.

## Étape 3 — Recréer le schéma sur le nouveau projet

⚠️ **IMPORTANT** : le SQL Editor de Supabase exécute le script en **une seule transaction**.
Or PostgreSQL interdit d'utiliser une valeur d'enum (`app_role`) dans la même transaction
que son `ALTER TYPE ADD VALUE`. Le script est donc découpé en **2 parties** à exécuter
**séquentiellement** (l'ajout de l'enum `developer` se termine la partie 1).

### Procédure (méthode A — SQL editor)
1. Supabase dashboard → **SQL Editor** → New query
2. **Partie 1** : coller tout le contenu de `00-schema-part1.sql` (49 migrations, se termine
   par `ADD VALUE IF NOT EXISTS 'developer'`) → **Run**
3. **Partie 2** : nouvelle requête → coller tout le contenu de `00-schema-part2.sql`
   (20 migrations, commence par la définition d'`is_ceo` utilisant `developer`) → **Run**
4. Puis exécutez `02-post-migration-setup.sql` (après avoir remplacé l'URL du projet)

### Méthode B (CLI — plus propre, recommandé)
```bash
npm install -g supabase
supabase login
supabase link --project-ref VOTRE_PROJET_REF
supabase db push
supabase db push  # inclut aussi les migrations futures
```
> Le CLI exécute chaque migration dans sa **propre transaction**, donc le problème
> d'enum ne se pose pas avec cette méthode.

## Étape 4 — Importer les données + recréer les utilisateurs

- Importez le dump/CSV exportés (tables dans l'ordre des dépendances).
- Recréez les comptes : **Authentication → Users → Add user** (email + mot de passe).
- Attribuez les rôles : insérez dans `public.user_roles` (et `profiles`) via le SQL editor.

## Étape 5 — Déployer les Edge Functions

```bash
supabase functions deploy rapport-journalier-ceo
supabase functions deploy send-audit-ceo
supabase functions deploy ai-insights
supabase functions deploy manage-users
```
Puis définissez les secrets : voir `03-secrets-checklist.md`.

## Étape 6 — Secrets + cron + domaine email

- Secrets : `resend_api_key`, `lovable_api_key` (ou clé Gemini) — voir checklist.
- Cron : déjà recréé par `02-post-migration-setup.sql` avec la bonne URL.
- Email : dans `public.parametres_email` (via SQL editor), mettez `expediteur_email` + `domaine_verifie`.

## Étape 7 — Brancher l'app

1. Mettez à jour le `.env` local :
   ```
   VITE_SUPABASE_URL="https://VOTRE-PROJET.supabase.co"
   VITE_SUPABASE_PUBLISHABLE_KEY="anon-key"
   ```
2. Lovable → More → Cloud → Database → **Connect to Supabase** → choisissez votre projet.

## Étape 8 — Tests

- [ ] Connexion CEO + équipe
- [ ] Écrans live (realtime)
- [ ] RLS Économat (mp_mouvements)
- [ ] Photo evidence (bucket)
- [ ] Envoyer le rapport manuellement → Excel 8 feuilles + PDF OK
- [ ] Vérifier le fabricant de cron 23h00 (Jobs)