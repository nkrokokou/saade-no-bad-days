# Secrets nécessaires pour le nouveau Supabase

> Les clés `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` sont **injectées automatiquement** par Supabase dans les Edge Functions — rien à faire pour elles.

## À récupérer AVANT l'étape 5

| Secret | Utilisé par | Où le trouver |
|---|---|---|
| `RESEND_API_KEY` | `rapport-journalier-ceo`, `send-audit-ceo` (emails) | Dans Lovable : More → Cloud → Secrets (si visible), sinon sur **resend.com** → API Keys (créez-en une nouvelle) |
| `LOVABLE_API_KEY` | `ai-insights` (Lovable AI gateway) | ⚠️ Clé Lovable. Si vous ne pouvez pas la récupérer, voir l'alternative ci-dessous |

## ⚠️ Cas particulier : le bot IA (`ai-insights`)

Le code actuel appelle `https://ai.gateway.lovable.dev/v1/chat/completions` avec `LOVABLE_API_KEY`.

**3 options :**
1. **Garder la gateway Lovable** : récupérez la clé dans Lovable (Secrets) et définissez-la comme secret Supabase. Consomme des crédits Lovable.
2. **Passer à Google Gemini directement** (recommandé) : créez une clé API sur **ai.google.dev** (gratuite), puis je modifie `ai-insights/index.ts` pour appeler l'API Gemini directement avec `GEMINI_API_KEY`. Pas de dépendance Lovable.
3. **Mode local uniquement** : l'app a déjà un "Mode Local" (réponses depuis la base, sans IA). Désactivez l'IA en attendant.

## Commandes pour définir les secrets

```bash
supabase secrets set RESEND_API_KEY="re_xxxxx"
supabase secrets set LOVABLE_API_KEY="..."   # ou GEMINI_API_KEY
```

## Rappel sécurité

- La `service_role` key ne doit JAMAIS apparaître dans le frontend ni dans un repo.
- `VITE_SUPABASE_PUBLISHABLE_KEY` (anon) est publique par design (RLS protège les données).