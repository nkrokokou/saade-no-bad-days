# 🚀 Déployer SAADÉ sans Lovable (guide opérationnel)

Ce guide documente comment publier la nouvelle version de l'application SAADÉ sur
`https://www.saadenobaddays.store` **sans passer par Lovable**, en hébergeant nous-mêmes.

## Architecture cible

```
sites statiques (React build)          données + auth + edge functions
┌──────────────────────────┐           ┌────────────────────────────────────┐
│ Vercel / Netlify / CF    │           │  Supabase Cloud (nouveau projet)   │
│ (front-end dist/)        │  ──────►  │  https://rgdvlqwuhyrtmzraaowt.     │
│ www.saadenobaddays.store │           │  supabase.co                      │
└──────────────────────────┘           └────────────────────────────────────┘
```

Le domaine `saadenobaddays.store` est enregistré chez **Namecheap**
(registrar) et pointe actuellement vers l'ancienne infra Lovable
(`185.158.133.1`). On va le re-pointer vers notre hébergeur de statiques.

---

## Étape 1 — Choisir l'hébergeur (recommandé : Vercel)

| Hébergeur | Gratuit | Auto-deploy depuis GitHub | Domaine custom | Rewrites SPA |
|---|---|---|---|---|
| **Vercel** | ✅ (hobby) | ✅ `git push` → prod | ✅ | ✅ (via `vercel.json`) |
| Netlify | ✅ | ✅ | ✅ | ✅ (via `netlify.toml`) |
| Cloudflare Pages | ✅ | ✅ | ✅ | ✅ |

**Recommandation : Vercel** (0 € pour ce volume, déploiement automatique à
chaque `git push origin main`, HTTPS géré, et le repo `vercel.json` est déjà prêt).

---

## Étape 2 — Créer un compte + importer le repo

1. Créez un compte sur **https://vercel.com** (bouton « Continue with GitHub »).
2. Autorisez l'accès au repo GitHub `nkrokokou/saade-no-bad-days`.
3. **Add New → Project** → sélectionnez le repo.
4. Vercel détecte automatiquement le framework **Vite** :
   - Build command : `npm run build` (déjà dans `vercel.json`)
   - Output directory : `dist` (déjà dans `vercel.json`)
5. **Ajoutez les variables d'environnement** (copiez les valeurs depuis votre
   fichier local `migration-guide/import/.env.local` et `.env` du projet) :
   - `VITE_SUPABASE_URL=https://rgdvlqwuhyrtmzraaowt.supabase.co`
   - `VITE_SUPABASE_PUBLISHABLE_KEY=<votre anon key>`
   - `VITE_SUPABASE_PROJECT_ID=rgdvlqwuhyrtmzraaowt`
   > ⚠️ Clipser la **clé anon/public**, jamais la `service_role`.
6. **Deploy**. Vérifiez l'URL `*.vercel.app` de prévisualisation → l'app doit
   charger sur `/login`.

---

## Étape 3 — Ajouter le domaine personnalisé

1. Dans Vercel **Project → Settings → Domains** → **Add** :
   - Ajoutez `saadenobaddays.store` (apex)
   - Ajoutez `www.saadenobaddays.store`
2. Vercel affiche les **valeurs DNS à créer** (CNAME `cname.vercel-dns.com`).

---

## Étape 4 — Re-pointer les DNS chez Namecheap

1. Connectez-vous sur **https://www.namecheap.com** (compte qui a acheté le
   domaine, vérifié le 09/06/2026).
2. **Domain List → saadenobaddays.store → Manage → Advanced DNS**.
3. Remplacez l'enregistrement A actuel (`185.158.133.1` = Lovable) :
   - Type `CNAME` : Host `www` → Target `cname.vercel-dns.com`
   - Type `A` : Host `@` → Target `76.76.21.0` (valeur affichée par Vercel
     pour l'apex)
4. Enregistrez. **Propagation DNS : 5 min à 24 h.**

> 💡 Laissez la durée courte (5 min) pour tester vite. Le site Lovable reste
> accessible jusqu'à la bascule (les deux coexistent pendant la propagation).

---

## Étape 5 — Vérifier

- `https://www.saadenobaddays.store` → charge l'app (page de login)
- `https://saadenobaddays.store` → redirige vers `www` (ou sert l'app)
- Une impression de ticket / un login fonctionnent (la base Supabase est
  déjà en ligne)

---

## Étape 6 — Garder le contrôle (rappel)

- **Token Management API** `sbp_f2fd…c047` : **à révoquer** sur
  https://supabase.com/dashboard/account/tokens (cet historique a été purgé,
  mais par hygiène le token de migration doit disparaître).
- L'ancien projet Lovable (`ybbrjwywpeurimiisjwm`) : une fois le domaine
  re-pointé, **supprimez-le** (Lovable → Settings) pour couper le lien
  résiduel avec `Drckangel0606@`/anciens téléphones.
- Chron jobs Supabase (rapport 23h00, clôture 22h59, alertes /30min) restent
  côté Supabase : **rien à refaire** côté front.
- Edge Functions (`rapport-journalier-ceo`, `ai-insights`, cron…) restent
  hébergées sur Supabase Cloud : rien à redéployer.

---

## Dépannage rapide

| Symptôme | Cause probable | Solution |
|---|---|---|
| Page blanche / 404 après RT | Pas de fallback SPA | `vercel.json` doit contenir `rewrites` |
| Login OK mais rapport PDF vide | Fonction Edge non déployée | `supabase functions deploy` |
| Ancienne version affichée | Cache navigateur / PWA | Vider le cache + relancer (le SW est en no-cache) |
| DNS semble ne pas changer | Propagation DNS | `nslookup www.saadenobaddays.store` attendre |