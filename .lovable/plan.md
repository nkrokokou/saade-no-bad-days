## Réponse courte

Non, ce n'est pas garanti. Une vieille version cache du HTML/JS via le Service Worker mais continue d'appeler la même base Supabase. Donc :

- Le **mot de passe** n'est pas refusé par "ancienne version" — Supabase accepte toujours.
- En revanche, un utilisateur peut **paraître bloqué au login** si :
  1. Son onglet sert un ancien `index.html` mis en cache par un Service Worker mort → page blanche / bouton qui ne réagit pas.
  2. Son refresh token a été révoqué (rotation des clés Supabase faite récemment).
  3. Une migration a renommé une table que l'ancien code lit après login → crash juste après auth.

J'ai trouvé la cause #1 dans le code : `src/lib/registerSW.ts` enregistre `/sw.js` mais **`public/sw.js` n'existe pas**. Les navigateurs qui avaient un ancien `sw.js` continuent de servir l'ancienne app depuis leur cache, et la requête `/sw.js` renvoie 404 (donc pas de mise à jour). C'est exactement le scénario "resté à la mise à jour Économat".

## Plan (2 parties)

### 1. Diagnostic — qui est concerné

- Lister les comptes `profiles` et leur dernière connexion (`auth.users.last_sign_in_at` via une edge function en service_role, ou via le panneau Cloud Users).
- Marquer comme "suspects" tous ceux qui n'ont **pas** de session récente depuis la date de la mise à jour Économat.
- Pour chaque suspect, je te donnerai un tableau : nom, rôle, dernière connexion, action recommandée (rien à faire / forcer reset mot de passe).
- Si tu confirmes, je peux pousser un bouton "Réinitialiser le mot de passe" dans `Admin.tsx` (déjà connecté à `manage-users`) pour les débloquer en un clic.

### 2. Mécanisme anti-vieille-version (kill-switch + force update)

a) **Créer `public/sw.js`** = service worker "kill-switch" conforme à la doc PWA :
   - À l'activation, supprime les anciens caches Workbox du scope, force `clients.claim()`, recharge tous les onglets ouverts, puis `unregister()` lui-même.
   - Résultat : les navigateurs qui avaient un vieux SW reçoivent ce nouveau SW au prochain chargement réussi, il vide le cache et recharge la page sur le build actuel. Plus jamais bloqués.

b) **Bannière "Nouvelle version disponible"** dans `AppLayout.tsx` :
   - Au démarrage, fetch `/version.json` (généré au build avec le hash Vite) toutes les 10 min.
   - Si le hash diffère du hash chargé en mémoire → toast persistant "Mise à jour disponible — Recharger" avec un bouton qui fait `forceRefreshApp()` (déjà présent dans `Login.tsx`, je le déplace dans `src/lib/forceRefresh.ts`).

c) **Garde-fou login** : dans `Login.tsx`, si la dernière mise à jour app détectée date de > 30 jours par rapport au build courant, lancer automatiquement `forceRefreshApp()` avant d'afficher le formulaire. Sécurise les postes qui n'ouvrent l'app qu'une fois par jour.

### Détails techniques

- `public/sw.js` : copie exacte du kill-switch de la skill PWA (filtre `precache-v*`, `runtime-*`, `googleAnalytics-*` scoppés à `self.registration.scope`, `unregister()` dans `finally`).
- `vite.config.ts` : ajouter un petit plugin qui écrit `public/version.json` (ou `dist/version.json`) à chaque build avec `{ version: Date.now() }`.
- Aucune migration DB. Aucune modification du flow d'auth Supabase. Aucun changement de mot de passe imposé.
- Pas de `vite-plugin-pwa` réinstallé : on garde l'app non-PWA pour éviter les régressions.

### Ce que ça change pour la présentation de demain

- Les comptes "bloqués" seront identifiés ce soir et débloqués si besoin via le panneau Admin.
- À partir du prochain déploiement, plus aucun utilisateur ne pourra rester coincé sur une version périmée : la bannière + le kill-switch les force à reprendre la version courante au prochain ouverture de l'app.
