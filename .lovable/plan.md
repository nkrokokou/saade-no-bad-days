Beaucoup de choses à toucher, je veux valider l'approche avant de coder.

## 1. Burgers — Soft au choix
Pour les 3 produits « Burger Créa + Frite + Soft », « Cheese Burger + Frite + Soft », « Chicken Burger + Frite + Soft » : créer un groupe d'options **« Soft » (1 choix obligatoire, +0 F)** avec :
Ice Tea · Tonic · Eau Gazeuse · Eau Plate · World Cola · Youki Orange

## 2. Formule Express
Sur le produit Formule Express, créer 3 groupes d'options (1 choix obligatoire chacun, +0 F) :
- **Boisson chaude** : toute la catégorie BOISSONS_CHAUDES
- **Viennoiserie** : toute la catégorie VIENNOISERIES (toutes celles existantes)
- **Eau** : Eau Plate · Eau Gazeuse

## 3. Formule Goûter
- **Dessert** : toute la catégorie DESSERTS (1 choix)
- **Boisson (chaude ou froide)** : toutes les boissons chaudes + toutes les boissons froides, **hors BOISSONS_SIGNATURES** (1 choix)

## 4. Formule Snack
- **Base** : toute la catégorie HOT_DOG + toute la catégorie PAIN_BRO (1 choix)
- **Complément** : Frite · Soft au choix (Ice Tea/Tonic/Eau Gaz/Eau Plate/World Cola/Youki) — 2 sous-groupes (Frite incluse + Soft au choix)

> Les groupes sont créés en base via INSERT (idempotent : suppression préalable de tout groupe portant le même nom sur le même produit). Si une nouvelle boisson est ajoutée plus tard, il faudra relancer ce seed depuis l'écran Catalogue → Options (déjà existant).

## 5. Fiche technique — marge par pièce
Dans la page Fiches Techniques, les 3 cartes du haut (Coût de revient / Prix de vente / Marge) utilisent actuellement le coût **total** de la recette. Je vais :
- diviser le coût total par `qte_recette` (champ « QTE POUR UNE RECETTE (PIECES) ») pour obtenir le **coût par pièce**
- afficher « Coût de revient / pièce » et calculer la marge = `prix_vente − coût/pièce`
- si `qte_recette` est vide ou 0 → afficher « — » sur la carte coût/pièce et désactiver le calcul de marge avec un petit message

## 6. Tickets en attente — permission pour la salle
Cause racine : la policy RLS DELETE sur `ventes`/`vente_lignes` exige `can_perform(..., 'ventes', 'delete')`. Le rôle salle ne l'a pas → suppression silencieuse côté Postgres mais aucun toast d'erreur (je vais aussi remonter l'erreur dans l'UI).

Migration :
- Nouveau module de permission `bon_attente` (read/create/update/delete)
- Nouvelle policy DELETE sur `ventes` et `vente_lignes` : autoriser si `statut = 'en_cours'` ET `can_perform(uid,'bon_attente','delete')` (en plus de la policy existante)
- Par défaut : grant `delete` à `salle` et `ceo` sur ce module

Côté UI :
- Ajout du module « Tickets en attente » dans Administration → Permissions
- Ajout dans `usePermissions.ts`
- `cancelTab` affiche désormais le message d'erreur RLS si refusé

## 7. Nommer un ticket en attente
Dans le bouton « En attente » du POS :
- petit champ texte « Nom du ticket (ex : Mr Dupont, anniv table 4…) » optionnel
- stocké dans `ventes.client_nom` (déjà existant, libre)
- dans la liste des tickets en attente : si `client_nom` existe → l'afficher en titre à la place de « Table Comptoir · #27 »; sinon comportement actuel
- pas de nouvelle colonne en base

## Fichiers touchés
- `supabase/migrations/...` : module `bon_attente` + policies + seeds permissions
- `psql INSERT` (data) : groupes d'options burgers + formules
- `src/pages/FichesTechniques.tsx` : cartes coût/pièce + marge
- `src/pages/POS.tsx` : champ nom de ticket + affichage + toast d'erreur sur cancel
- `src/pages/Admin.tsx` : ligne « Tickets en attente » dans la matrice
- `src/hooks/usePermissions.ts` : type union élargi

Je vous attends pour démarrer.