## Problème

Dans **Suivi de Stock → MP temps réel**, le bouton « 📈 Cycle » utilise `<a href="/mp/:id/cycle">` (ligne 359 de `SuiviStock.tsx`). Une balise `<a>` provoque un **rechargement complet** de la page au lieu d'une navigation SPA React Router. Résultat courant :

- rechargement lent qui a l'air « figé »
- perte du contexte (auth query cache, sidebar state)
- en cas de service worker/cache un peu ancien, le rechargement peut retomber sur une version qui ne connaît pas encore la route → page blanche ou « Chargement… » infini
- sur mobile/preview, le clic sur le `<Button>` imbriqué dans le `<a>` ne déclenche parfois pas la navigation (HTML invalide : `<a>` contient un `<button>`)

`MpCycleDeVie.tsx` et la route `/mp/:id/cycle` existent bien (`App.tsx` ligne 110), donc la cible fonctionne — c'est le lien qui est cassé.

## Correction

Dans `src/pages/SuiviStock.tsx` (lignes 358-361) :

- remplacer `<a href={...}>` par `<Link to={...}>` de `react-router-dom` (déjà importé dans le fichier au besoin)
- garder le bouton visuel mais utiliser `asChild` sur `<Button>` pour éviter l'imbrication `<a><button>` invalide :

```tsx
<Button asChild size="sm" variant="ghost" className="text-primary">
  <Link to={`/mp/${m.id}/cycle`} title="Cycle de vie complet">📈 Cycle</Link>
</Button>
```

Aucune autre modification (pas de logique, pas de DB, pas de style global). Vérification après build : cliquer sur « Cycle » depuis `/suivi-stock` doit naviguer instantanément vers la page cycle sans rechargement.
