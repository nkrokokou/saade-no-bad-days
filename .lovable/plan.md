## 1. Synchronisation entre navigateurs (Chrome reste sur l'ancienne UI)

**Cause :** le PWA + le cache du navigateur servent l'ancien `index.html` / les anciens bundles JS tant que le service-worker n'a pas relâché sa version. Sur Edge ça marche parce qu'il n'y a pas de SW enregistré ou qu'il a été purgé.

**À faire :**
- Ajouter dans `index.html` des `<meta http-equiv="Cache-Control" content="no-cache">` + version build dans `<title>` pour aider l'utilisateur à voir la version.
- Créer un petit composant `<VersionGuard />` monté dans `AppLayout` qui :
  - lit un fichier statique `/version.json` (généré au build avec `VITE_BUILD_ID`)
  - le compare toutes les 60 s à la version chargée
  - si différent → toast « Nouvelle version disponible » + bouton **Recharger** qui fait `caches.keys().then(...delete)` puis `location.reload(true)` et `navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister()))`.
- Documenter dans le guide v5 la procédure « forcer la mise à jour » (Ctrl+Shift+R sur Chrome).

## 2. POS — options / modificateurs (Formules, Pain bro, Menu enfant)

Aujourd'hui un produit POS est une simple tuile → ajout direct au ticket. Il faut un **système de modificateurs** par produit.

**Schéma DB (migration) :**
- `produit_options_groupes` (id, produit_id, nom, ordre, min_choix, max_choix, obligatoire)
- `produit_options_items` (id, groupe_id, libelle, prix_supplement DEFAULT 0, ordre)
- `vente_ligne_options` (id, vente_ligne_id, groupe_nom, item_libelle, prix_supplement)

**UI POS :**
- Quand on clique sur un produit qui a au moins un groupe → ouvrir un dialog modale : pour chaque groupe, radio (max=1) ou checkboxes (max>1) listant les items. Validation : impossible de valider si un groupe obligatoire n'a pas le bon nombre d'éléments. À la validation → ajout au ticket avec sous-lignes affichées en italique.
- Ticket imprimé : afficher les options sous la ligne produit.

**UI Catalogue (admin) :**
- Sur la fiche produit, nouvel onglet « Options » pour créer/éditer les groupes et items.

**Pré-remplissage automatique** via migration (data INSERT) pour les produits demandés :
- Formule Burger : groupe « Soft » (radio obligatoire) → Ice tea, Tonic, Eau gazeuse, Eau plate, Word cola, Youki orange
- Formule express : groupe « Boisson chaude » + groupe « Viennoiserie » + groupe « Eau »
- Formule goûter : groupe « Dessert » (tous les produits catégorie Desserts) + groupe « Boisson » (chaude OU froide)
- Formule healthy : groupe « Boisson » → Eau / Jus Hugs / Limonade
- Formule snack : groupe « Plat » (hot dogs + pain bro) + frite incluse + groupe « Boisson »
- Menu enfant : groupe « Boisson » (Eau, Hugs ananas/bissap/multifruits), groupe « Plat » (Mini croq dog / Mini panini j-f), Frite + Fruits inclus
- Pain bro : groupe « Suppléments » (multi, prix_supplement=0) → Mayo, Tomate, Oignon, Piment vert

## 3. Fiche technique — calcul faux

**Cause confirmée en base** : la colonne `fiches_techniques.cout_unitaire_mp` contient **déjà** la valeur ligne (qté × prix unitaire) au lieu du prix unitaire seul. L'app refait ensuite `qté × cout_unitaire_mp` → résultat × qté.

Exemple : Pâte à tartiner speculoos, prix MP = 7,5/g, ligne 5 g.
Stocké : `cout_unitaire_mp = 37,5` au lieu de `7,5` → affiche 5 × 37,5 = **187,5** au lieu de 5 × 7,5 = **37,5**.

**À faire :**
1. **Migration data** : pour chaque ligne `fiches_techniques` où `matiere_premiere_id IS NOT NULL`, réécrire `cout_unitaire_mp = matieres_premieres.prix_unitaire`. Pour les lignes sans MP liée (ex « Poudre de Spéculoos » qui n'existe pas), diviser le cout stocké par la quantité **uniquement si quantite > 0 et cout/qte cohérent** — sinon laisser et logger.
2. **Création / Achats MP → recalcul produits** : déjà OK via `recalc_produit_prix_cout`, qui devient juste après la migration.
3. **FicheExcelView.tsx** :
   - Au `pickMP`, recalculer toujours `cout_unitaire_mp = mp.prix_unitaire` (déjà le cas — bug seulement sur la donnée existante).
   - Ajouter à côté de la colonne « QTE » une mini-étiquette grise montrant `prix MP : 7,5 F/G` pour transparence.
4. **MP manquantes** : créer `POUDRE DE SPECULOOS` en MP (prix calculé depuis SPECULOOS 1biscuit/donut) pour que le lien MP fonctionne.

## 4. Permissions — `duplicate key value violates unique constraint "module_permissions_role_module_key"`

**Cause :** quand on a ajouté la colonne `submodule`, l'ancienne contrainte unique `(role, module)` n'a pas été mise à jour. Toute tentative d'insérer une ligne `(role, module, submodule)` alors qu'il existe déjà `(role, module, NULL)` casse.

**Migration :**
```sql
ALTER TABLE module_permissions DROP CONSTRAINT module_permissions_role_module_key;
CREATE UNIQUE INDEX module_permissions_role_module_submodule_key
  ON module_permissions (role, module, COALESCE(submodule, ''));
```
+ code Admin.tsx : adapter la requête `findExisting` pour matcher sur `(role, module, submodule)` (déjà fait mais cassait sur l'INSERT à cause de la contrainte).

## 5. Compte développeur totalement invisible

**Approche :**
- Nouveau rôle `developer` dans l'enum `app_role`.
- Flag `is_hidden boolean DEFAULT false` sur `profiles`.
- Edge function `manage-users` : tout user avec `is_hidden=true` est filtré de la réponse list → invisible dans Admin > Utilisateurs.
- Trigger `log_audit_change` : `RETURN` immédiat si `auth.uid()` appartient à un user `is_hidden` → aucune trace dans `audit_logs`.
- Politiques RLS : le rôle `developer` voit tout (équivalent CEO via `is_dev()`), mais aucune table ne filtre par lui dans l'UI.
- `NotificationBell` / `CaissesLive` / `RapportsCeo` : ignorer les sessions/ventes créées par un user hidden ? **Non** — le dev observe sans polluer. Donc ses propres actions sont taggées mais non loggées.
- Création initiale via SQL direct (pas d'UI) : un compte `dev@saade.local` créé hors UI, mot de passe transmis hors-bande.

## Ordre d'exécution
1. Migration permissions (rapide, débloque l'admin)
2. Migration data fiches techniques (corrige les calculs)
3. Migration + UI options POS
4. VersionGuard / cache busting
5. Compte dev (dernière étape, sensible)

Confirme-moi que je peux lancer dans cet ordre, ou dis-moi par lequel commencer en priorité.