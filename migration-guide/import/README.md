# Procédure d'import des données (Excel/CSV exports) vers le nouveau Supabase

## Prérequis
- Nouveau projet Supabase : `https://rgdvlqwuhyrtmzraaowt.supabase.co`
- Node.js installé (v20+)
- La **clé service_role** du nouveau projet (Settings → API)

## Étape 1 — Préparer la clé (SANS jamais la coller ici)

Créez le fichier `migration-guide/import/.env.local` (il existe déjà avec un placeholder) et mettez-y :

```
SUPABASE_URL=https://rgdvlqwuhyrtmzraaowt.supabase.co
SUPABASE_SERVICE_KEY=votre-cle-service-role-ici
```

> 🔒 Ce fichier est local. Ne le commitez pas, ne le montrez à personne.

## Étape 2 — Renseigner les emails des comptes

Copiez `users.config.example.json` en `users.config.json` (fichier local, ignoré par git) et remplacez les `???@exemple.com` par les vrais emails de vos comptes. Les UUID doivent correspondre aux comptes existants à recréer à l'identique.

## Étape 3 — Générer le SQL des utilisateurs

```bash
cd migration-guide/import
$env:INITIAL_PASSWORD='UnMotDePasseFortEtTemporaire'   # PowerShell (jamais en dur dans le code)
node generate-users-sql.js
```
Cela crée `generated-users.sql` (comptes auth.users avec les MÊMES UUID, + profiles + user_roles). Ce fichier est local (ignoré par git) : il contient le hash du mot de passe initial.

## Étape 4 — Exécuter dans cet ordre (SQL Editor Supabase)

1. **Créer le schéma (partie 1)** : coller `migration-guide/00-schema-part1.sql`
   (49 migrations, se termine par l'ajout de l'enum `developer`) → Run
2. **Créer le schéma (partie 2)** : coller `migration-guide/00-schema-part2.sql`
   (20 migrations) → Run
   > ℹ️ Le découpage en 2 parties est nécessaire : PostgreSQL interdit d'utiliser
   > une nouvelle valeur d'enum dans la même transaction que son `ALTER TYPE ADD VALUE`.
3. **Créer les utilisateurs** : coller `migration-guide/import/generated-users.sql`
4. **Configurer realtime + cron** : coller `migration-guide/02-post-migration-setup.sql`

## Étape 5 — Importer les données

```bash
cd migration-guide/import
node import-data.mjs --dry-run        # vérifier le plan (facultatif)
node import-data.mjs                  # import réel
```

Le script :
- Lit tous les `databasecsv/*.csv`
- Impose le bon **ordre** (FK respectées)
- Convertit types (dates, booléens, nombres)
- **Upsert** par lots de 300 (échec → re-exécutable sans doublon)

## Vérifications après import
```bash
# Tables vides attendues ?
node import-data.mjs --dry-run   # doit afficher total=0 restant
```

## À savoir
- Les 3 vues (`v_mp_stock`, `v_economat_stock`, `v_stock_matieres_premieres`) sont créées par le schéma → **ne pas importer** (script les ignore).
- Les comptes utilisent un mot de passe initial temporaire (fourni via `INITIAL_PASSWORD` au lancement du générateur) → **à changer obligatoirement après connexion** (Administration → Profil). Le CEO peut réinitialiser chaque compte (Administration → Utilisateurs → 🔑).