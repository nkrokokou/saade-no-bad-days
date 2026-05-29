# Plan d'action

## 1. Comment ça marche actuellement (réponse à ta question)

L'app **n'envoie pas directement à 2 imprimantes différentes** — elle ouvre la boîte de dialogue native Chrome (`window.print()`).  
Le tri "Cuisine vs Caisse" se fait **dans l'app** : on prépare 2 contenus HTML distincts (bon cuisine sans prix/sans boissons, ticket caisse complet). Quand tu cliques sur **"Bon Cuisine"** → la boîte Chrome s'ouvre avec le contenu cuisine, tu choisis l'imprimante cuisine. Quand tu cliques sur **"Ticket Caisse"** → idem avec le contenu caisse, tu choisis l'imprimante caisse.

Sur la tablette installée comme PWA, Chrome mémorise la dernière imprimante par défaut, ce qui rend le flux rapide.

## 2. Refonte UI POS (mobile + tablette)

- Layout 2 colonnes sur tablette (≥ md) / 1 colonne sur mobile
- Catalogue à gauche avec tabs catégories sticky, recherche, vignettes plus tactiles
- Panier à droite (drawer plein écran sur mobile) avec totaux toujours visibles
- Boutons d'action proéminents : **Bon Cuisine** / **Ticket Caisse** / **Encaisser**
- Quick-quantities (+1 / +5) au tap, swipe-to-remove
- Indicateur visuel du destinataire (badge "Cuisine" / "Bar") par article selon catégorie

## 3. Nouvelle plateforme Admin → "Modèles de tickets"

Page dédiée dans Administration permettant à la CEO de gérer :
- En-tête (nom commerce, sous-titre, adresse, téléphone, logo)
- Pied de page (message remerciement, mentions légales, slogan)
- Affichage : afficher/masquer numéro de ticket, date/heure, serveur, table, caissier
- Spécifique cuisine : afficher prix oui/non, regrouper par catégorie, exclure boissons (toggle)
- Spécifique caisse : afficher TVA, mode de paiement, monnaie rendue
- Aperçu live du ticket à droite
- Stockage : nouvelle table `ticket_templates` (clé = `cuisine` / `caisse`) avec JSON config, RLS CEO uniquement

## 4. Fiche technique — diagnostic

Les boutons **Excel / PDF / Importer** sont déjà dans le code (`FichesTechniques.tsx` lignes ~190-210) mais visibles **uniquement après avoir cliqué sur un produit**. Sur ta capture, tu es resté sur la liste des produits. Je vais :
- Ajouter aussi les boutons Export/Import **au niveau de la liste** (export global toutes fiches, import multi-produits)
- Rendre la barre d'actions plus visible quand on ouvre un produit

## 5. Journal d'activité vide — diagnostic + correction

À vérifier :
- Le hook `useAuditLog` est-il appelé sur login / création utilisateur / CRUD ?
- La table `audit_log` reçoit-elle les insertions ? (requête SQL de contrôle)
- RLS lecture pour le CEO

Action : brancher les hooks manquants (login, logout, création user, CRUD produits/MP/ventes) + vérifier policy SELECT pour CEO.

## 6. Compte rendu final

À la fin je fournis un récap "état de l'app" : ce qui marche, ce qui manque, priorités suggérées (impression directe sans dialogue via QZ Tray ? notifications cuisine temps réel ? mode offline ? etc.).

---

## Ordre d'exécution proposé
1. Diagnostic SQL audit_log + correction
2. Boutons Excel sur liste fiches techniques (visibilité)
3. Table + page Admin "Modèles de tickets"
4. Refonte UI POS
5. Branchement templates dans l'impression POS
6. Compte rendu

Je commence dès que tu valides — ou dis-moi si tu veux qu'on retire/réordonne des points.