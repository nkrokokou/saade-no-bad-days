# Mise à jour automatique sur tous les appareils — fin des caches bloqués

## Le problème (confirmé dans le code)

L'application est configurée en PWA avec un **service worker** qui met en cache tous les fichiers de l'app (`vite.config.ts` → `vite-plugin-pwa` avec cache `StaleWhileRevalidate`). Concrètement :

- Le navigateur sert **d'abord l'ancienne version** depuis le cache, et ne récupère la nouvelle qu'en arrière-plan — parfois jamais si le service worker est coincé.
- C'est pour ça qu'en navigation privée (pas de cache) tout marche, mais sur les navigateurs habituels de votre cliente, l'ancienne version reste affichée.
- Le bouton « Forcer la mise à jour » et le `VersionGuard` sont des pansements : ils exigent une action manuelle sur chaque appareil — exactement ce qui vous fatigue.

## La solution durable (une seule fois, puis plus jamais)

### 1. Déployer un service worker « kill-switch »
Remplacer le service worker actuel par un petit worker spécial (au même chemin `/sw.js`) qui, dès qu'un appareil ouvre l'app :
- supprime automatiquement tous les anciens caches de l'app,
- se désinstalle tout seul,
- recharge la page sur la version fraîche.

**Aucune manipulation nécessaire sur les ordis/appareils de votre cliente** : il suffit qu'ils ouvrent l'app une fois avec internet, et le nettoyage se fait tout seul.

### 2. Supprimer la mise en cache agressive
- Retirer `vite-plugin-pwa` (le cache offline) de la configuration de build.
- Conserver le **manifest** (`manifest.json` + icônes) : l'app reste installable sur l'écran d'accueil, mais sans cache problématique.
- L'hébergement Lovable sert déjà le HTML avec des en-têtes de revalidation : chaque visite charge automatiquement la dernière version publiée.

### 3. Nettoyer les pansements devenus inutiles
- Supprimer le composant `VersionGuard` et son polling de `version.json`.
- Supprimer le bouton « Forcer la mise à jour » de la page de login (ou le garder quelque temps par sécurité, à vous de me dire).
- Simplifier `vite.config.ts` (retrait du plugin PWA et de la génération de `version.json`).

### 4. Publier
Une fois publié, chaque appareil qui ouvre l'app se nettoie tout seul au premier chargement, puis reçoit toujours la dernière version automatiquement.

## Compromis à connaître
- L'app ne fonctionnera plus **hors-ligne** (le cache offline est justement la source du problème). Si le mode hors-ligne est indispensable, dites-le-moi — sinon je le retire.
- Le worker kill-switch reste en place un cycle de publication pour nettoyer tous les appareils, puis pourra être retiré plus tard.

## Détails techniques
- `public/sw.js` : worker kill-switch (suppression des caches Workbox propres à l'app, `unregister()` en `finally`, rechargement des onglets ouverts).
- `vite.config.ts` : retrait de `VitePWA` et de `emitVersionJson`.
- `src/components/AppLayout.tsx` : retrait de `<VersionGuard />`.
- Suppression de `src/components/VersionGuard.tsx`.
- `src/pages/Login.tsx` : retrait (ou conservation) du bouton de mise à jour forcée.
