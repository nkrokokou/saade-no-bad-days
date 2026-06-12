// Kill-switch service worker — nettoie l'ancien cache PWA puis se désinstalle.
// Cache Storage est scopé à l'origine : on ne supprime QUE les caches Workbox propres à cette registration
// pour ne pas casser d'éventuels workers tiers (Firebase Messaging, OneSignal, etc.).
function isWorkboxCacheForThisRegistration(name) {
  const hasWorkboxBucket = /(^|-)precache-v\d+-|(^|-)runtime-|(^|-)googleAnalytics-|saade-/.test(name);
  return hasWorkboxBucket;
}

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) =>
  event.waitUntil(
    (async () => {
      try {
        const cacheNames = await caches.keys();
        const toDelete = cacheNames.filter(isWorkboxCacheForThisRegistration);
        await Promise.allSettled(toDelete.map((name) => caches.delete(name)));
        await self.clients.claim();
        const windowClients = await self.clients.matchAll({ type: 'window' });
        await Promise.allSettled(windowClients.map((client) => client.navigate(client.url)));
      } finally {
        await self.registration.unregister();
      }
    })(),
  ),
);
