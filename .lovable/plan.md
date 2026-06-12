# Offline qui marche, mises à jour qui passent toujours

## Objectif
Rétablir le mode hors-ligne tout en garantissant que **plus jamais** un appareil ne reste bloqué sur une ancienne version, même sur Chrome/Safari avec cache agressif.

## Stratégie : NetworkFirst + auto-update strict

### 1. Phase de nettoyage (kill-switch déjà en place)
Le `public/sw.js` actuel (kill-switch) reste en place **pour ce déploiement uniquement**. Il sera téléchargé par tous les appareils déjà infectés par l'ancien cache Workbox, nettoiera tout, puis se désinstallera. C'est une étape obligatoire avant de réintroduire un nouveau worker, sinon les anciens caches resteront.

### 2. Réintroduction propre de `vite-plugin-pwa`
Configuration durcie dans `vite.config.ts` :
- **`registerType: "autoUpdate"`** : le nouveau worker prend la main automatiquement, sans demander à l'utilisateur.
- **`skipWaiting: true` + `clientsClaim: true`** dans Workbox : la nouvelle version active immédiatement tous les onglets ouverts, pas besoin de fermer/rouvrir.
- **`navigateFallback` + `NetworkFirst` sur HTML** avec timeout court (3 s) : à chaque navigation, le navigateur tente d'abord le réseau ; il ne sert le cache que si offline ou réseau très lent. Conséquence : la dernière version est servie dès qu'internet répond.
- **`CacheFirst` uniquement sur les assets hashés** (JS/CSS avec hash dans le nom) — ils sont immutables par construction donc jamais obsolètes.
- **Exclure `/version.json`, `/~oauth`, `/api`** de tout cache.
- **Précache de l'app shell** pour démarrage hors-ligne.

### 3. Bandeau « Nouvelle version » non bloquant
Remettre un petit `VersionGuard` léger qui écoute l'événement `controllerchange` du service worker. Quand `autoUpdate` installe une nouvelle version :
- soit elle s'applique silencieusement au prochain rechargement de page (cas normal),
- soit un toast discret « Nouvelle version chargée » s'affiche 3 s. Aucune action requise.

### 4. Bouton « Forcer la mise à jour » sur Login conservé
En filet de sécurité ultime — désormais quasi jamais utile.

### 5. Garde-fous anti-régression
- Documenter dans `mem://` la règle : « PWA = NetworkFirst sur HTML, jamais StaleWhileRevalidate sur du HTML, jamais de cache sans timeout ».
- Le `public/sw.js` kill-switch sera remplacé par le SW généré par `vite-plugin-pwa` au build — donc tous les appareils recevront automatiquement le bon worker lors du prochain déploiement.

## Compromis assumés
- **Première visite hors-ligne** : impossible (normal — il faut au moins un chargement initial avec internet pour installer l'app shell).
- **Réseau très lent (>3 s)** : sert la version cachée puis met à jour en arrière-plan → l'utilisateur verra la nouvelle version au rechargement suivant. Pas de blocage.
- **Données dynamiques (Supabase)** : restent en NetworkFirst court — toujours fraîches quand internet est là.

## Fichiers touchés
- `vite.config.ts` : remettre `VitePWA` avec la config durcie ci-dessus.
- `public/sw.js` : supprimé (le plugin générera son propre `sw.js` au même chemin, qui remplacera le kill-switch sur les appareils).
- `src/components/VersionGuard.tsx` : recréé en version légère (écoute `controllerchange`).
- `src/components/AppLayout.tsx` : remonte `<VersionGuard />`.
- `src/main.tsx` : registration garde-foue (refus en dev/preview Lovable, support `?sw=off`).

## Ordre de déploiement (important)
1. Le déploiement actuel (kill-switch) doit d'abord atteindre chaque appareil **au moins une fois** — typiquement quelques heures après publication.
2. Ensuite je peux publier la version « PWA propre ». Les appareils nettoyés recevront le nouveau worker NetworkFirst directement.

Si vous publiez les deux changements trop rapprochés, certains appareils sauteront le nettoyage. Confirmez quand le kill-switch a tourné sur les principaux appareils de votre cliente (ou attendez 24 h) avant que je publie la phase 2.
