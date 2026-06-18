
# Suivi de stock avancé — Labo, Minute & Matières Premières

## 1. Distinction Produit Labo vs Produit Minute

Ajout d'un champ `type_production` sur `produits` :

- `labo` → produit fini stocké (Brioche, Donut, Cookie…). Entre en stock via Production Labo, sort via Bons de Transfert / Ventes / Pertes.
- `minute` → préparé à la commande (Burger, Panini, Crêpe, Formule…). Pas de stock de PF ; déduit ses MP via la fiche technique au moment de la vente.
- `revente` → produit acheté et revendu tel quel (boissons, snacks emballés). Stock = achats − ventes − pertes.

Le type est éditable dans **Catalogue** et auto-déduit par défaut depuis la catégorie (paramétrage initial).

## 2. Moteur de déduction automatique des MP

Création d'une table `mp_mouvements` dédiée aux matières premières (séparée de `mouvements_stock` qui reste pour les produits finis) :

```text
mp_mouvements
├── matiere_premiere_id
├── date_mouvement
├── type        (achat | conso_labo | conso_minute | perte | ajustement | inventaire)
├── quantite    (positive = entrée, négative = sortie)
├── source_table + source_id   (ventes, production_labo, pertes, achats_mp…)
├── stock_avant / stock_apres  (snapshot pour audit)
└── created_by, motif
```

Triggers Postgres :

- `achats_mp` → insère `+quantite` (achat).
- `production_labo` (INSERT/UPDATE) → pour chaque MP de la fiche technique du produit fini : `−(quantite_mp × qte_produite / qte_recette)` en `conso_labo`.
- `vente_lignes` (INSERT) si produit `minute` → déduit chaque MP de la fiche technique × quantité vendue en `conso_minute`. Les `vente_ligne_options` (suppléments) déclenchent aussi leur déduction si liées à une MP.
- `pertes` (matière brute) → `−quantite` en `perte`.
- `inventaire` validé → écart matérialisé en `ajustement` avec motif "régularisation inventaire".

La vue `v_stock_matieres_premieres` est étendue pour exposer : `stock_actuel`, `stock_min`, `valeur_stock`, `derniere_entree`, `derniere_sortie`, `rotation_30j`.

## 3. Gestion des ruptures et stock négatif

Les déductions **n'échouent jamais** — la vente passe toujours, mais :

- Si `stock_apres < 0` → flag `regularisation_requise = true` sur la ligne `mp_mouvements`, badge "À régulariser" affiché.
- Notification automatique (`type='rupture_mp'`) vers les rôles `ceo`, `economat`, `cuisine_salee`/`labo_*` selon contexte, avec message :
  > « Rupture *Pain Burger* lors de la vente *Burger Créa* (sur-consommation de 1 unité). Vérifier achat manquant, recette ou inventaire. »
- Toast bloquant côté POS (« Vente enregistrée mais stock MP insuffisant ») avec lien "Régulariser".

Un panneau **"Anomalies de stock"** centralise toutes les lignes à régulariser (filtre date, MP, type) avec actions : *Saisir entrée oubliée*, *Ajuster inventaire*, *Corriger recette*, *Marquer résolu*.

## 4. Nouvelle section **Suivi de Stock** (`/suivi-stock`)

Page unique avec onglets (au-delà des pages existantes Économat / Stock Tampon / MP qui restent pour la saisie) :

- **Vue d'ensemble** — KPIs : valeur totale stock MP, nb MP en alerte, nb anomalies du jour, top 5 ruptures.
- **MP en temps réel** — tableau filtrable (catégorie, fournisseur, alerte) : nom, stock actuel, seuil, valeur, rotation 30j, dernière conso, statut. Couleurs : vert/orange/rouge/négatif.
- **Produits Labo** — pour chaque produit `labo` : stock théorique (production − sorties salle − ventes − pertes), production J/J-1, taux d'écoulement.
- **Historique mouvements** — flux unifié (MP + PF), filtrable par article/type/date/auteur, export Excel/PDF.
- **Anomalies & régularisations** — file d'attente décrite §3.
- **Valorisation** — stock valorisé par catégorie MP + total ; courbe d'évolution sur 30j.
- **Rotation & suggestions** — MP qui dorment (> 60j sans conso), MP qui tournent vite, suggestions de commande automatiques (`conso_moy_7j × délai_réappro − stock_actuel`).
- **Conso par produit fini** — sur une période : « Pour produire X Brioches cette semaine → Y kg farine, Z œufs… » (basé sur fiches techniques × productions).
- **Écarts inventaire** — comparaison inventaire physique (table `inventaire`) vs stock théorique, % écart par MP, top pertes cachées.

## 5. Traçabilité supplémentaire proposée

- **Numéro de lot** optionnel sur `achats_mp` (lot fournisseur, DLC) propagé dans `mp_mouvements` → FIFO et alerte DLC.
- **Photo evidence** sur les pertes importantes (> seuil €).
- **Signature de production** : le labo « valide » sa production de la journée (verrou) → après ça, modification = audit log + motif.
- **Mode "Production minute en attente"** : si une MP est insuffisante, le serveur peut quand même prendre la commande mais l'item est marqué "À confirmer cuisine" jusqu'à acquittement.

## 6. Permissions — nouveau module `suivi_stock`

Ajout dans `ModuleKey` et `module_permissions`. Defaults proposés :

| Rôle | read | create | update | delete |
|---|---|---|---|---|
| ceo / developer | ✓ | ✓ | ✓ | ✓ |
| economat | ✓ | ✓ | ✓ | — |
| labo_patisserie | ✓ (vue MP + ses produits) | — | — | — |
| labo_viennoiserie | ✓ (idem) | — | — | — |
| cuisine_salee | ✓ (MP cuisine salée + minute) | — | — | — |
| salle | — | — | — | — |

`create/update/delete` = capacité à régulariser une anomalie / forcer un ajustement. Le filtrage par périmètre MP (pâtisserie vs viennoiserie vs cuisine) se fait via la **catégorie** de la MP croisée avec le rôle.

## 7. Synchronisation avec le système existant

- **Économat** : ses mouvements (`economat_mouvements`) restent — le trigger `sync_achat_to_economat` est conservé. La page **Suivi de Stock** agrège MP + Économat dans une vue unifiée optionnelle.
- **SAADÉ en live** : on branche les évènements `mp_mouvements` (entrée, sortie, anomalie) dans le flux temps réel — nouvelle catégorie « Stock MP ».
- **Dashboard CEO** : carte « Anomalies stock du jour » + « Valeur stock MP » ajoutées.
- **Bons de transfert** : restent inchangés pour les PF labo → salle ; alimentent le calcul de stock tampon.
- **Notifications** : nouveaux types `rupture_mp`, `mp_dormante`, `suggestion_commande`.
- **Audit log** : tous les triggers passent par `log_audit_change` existant.

## 8. Détails techniques

- Migrations : ajout colonne `type_production` sur `produits`, table `mp_mouvements`, vue étendue, triggers, ligne `suivi_stock` dans `module_permissions`, types notifications.
- Front : nouvelle page `src/pages/SuiviStock.tsx` + composants (`MpRealtimeTable`, `AnomaliesPanel`, `ValorisationCard`, `ConsoParProduit`, `SuggestionsCommande`). Route protégée `/suivi-stock` (module `suivi_stock`). Entrée sidebar (icône `Warehouse`).
- Catalogue : sélecteur `type_production` + script d'initialisation (catégories pâtisserie/viennoiserie/cookies = labo ; burgers/paninis/crêpes/formules = minute ; boissons/snacks = revente).
- POS : `addToCart` consulte la dispo MP pour les produits `minute` et déclenche le toast d'alerte sans bloquer.

## 9. Étapes d'implémentation

1. Migration schéma (`type_production`, `mp_mouvements`, vues, triggers, permissions).
2. Backfill : déterminer `type_production` pour les produits existants à partir des catégories.
3. Activer triggers sur `achats_mp`, `production_labo`, `vente_lignes`, `pertes`, `inventaire`.
4. Page Suivi de Stock + sous-composants.
5. Permissions Admin (ligne `suivi_stock`) + sidebar + route.
6. Branchements : notifications, SAADÉ en live, Dashboard, audit log.
7. Catalogue : édition `type_production`.
8. POS : alertes MP non-bloquantes.
9. Tests : vente minute avec stock OK / stock 0 / stock négatif, production labo, achat MP, inventaire, perte MP.

## Questions ouvertes

- Veux-tu que la **vente d'un produit minute soit bloquée** si la MP est à 0 (mode strict) ou simplement **alertée** (mode tolérant, recommandé d'après ta description) ?
- Doit-on gérer les **lots / DLC** dès maintenant, ou en v2 ?
- Le périmètre par rôle (labo_patisserie ne voit que ses MP) : tu veux ce filtre dès la v1 ou tout le monde voit tout (en lecture) ?
