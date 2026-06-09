# Guide Utilisateur — SAADÉ

Dernière mise à jour : **juin 2026** (v4 — Palettes de couleurs, sous-catégories, imprimantes ciblées, crédit sans décrémentation, clôture automatique 23h59).


Cette application gère le **laboratoire pâtisserie / viennoiserie**, la **cuisine salée**, la **salle / caisse**, l'**économat** et les **rapports CEO** de SAADÉ (Lomé, Togo). Elle s'utilise dans Chrome (PC, tablette tactile, smartphone) et peut être **installée comme application** via « Ajouter à l'écran d'accueil ».

---

## Sommaire

1. Connexion & rôles
2. Point de Vente (POS)
3. Catalogue produits & catégories
4. Fiches techniques
5. Matières premières & achats
6. Stock & inventaire
7. Production labo & cuisine
8. Pertes & dégustations
9. Ventes & clients (crédits)
10. Clôture journalière
11. Rapports CEO & audits
12. Économat *(nouveau)*
13. Journal d'activité
14. Modèles de tickets
15. Installation tablette / PWA
16. Assistante IA CEO *(nouveau)*
17. Sauvegarde, sécurité & tests
18. Dépannage rapide

---

## 1. Connexion & rôles

Chaque utilisateur a un compte et un (ou plusieurs) rôle(s) :

| Rôle | Accès principal |
|------|-----------------|
| **CEO** | Tout — administration, rapports, audits, paramètres, IA, économat |
| **Labo pâtisserie** | Production pâtisserie, pertes, fiches |
| **Labo viennoiserie** | Production viennoiserie, pertes, fiches |
| **Cuisine salée** | Production cuisine, pertes, fiches |
| **Salle / Caisse** | POS, tables, clients, clôture |
| **Économat** *(nouveau)* | Stock matières premières : articles, mouvements (entrées / sorties / pertes), alertes, import / export Excel |

La CEO crée les comptes depuis **Administration → Utilisateurs** et y assigne le ou les rôle(s) ainsi que les permissions module par module.

Compte de test E2E : `test@saade.com` / `Test1234` (utilisé par les tests Playwright — voir §17).

---

## 2. Point de Vente (POS)

### Ouvrir la caisse
1. Aller dans **POS**.
2. Saisir le fond initial → **Ouvrir la session**.
3. La session reste ouverte jusqu'à la clôture.

### Encaisser
1. Ajouter les produits au panier (clic sur la vignette).
2. Choisir table / serveur / client si besoin.
3. **Encaisser** → choisir le mode (Espèces, Mobile Money, Carte, Crédit, Ticket).
4. Vente enregistrée + ticket imprimé.

### Tickets séparés Cuisine / Caisse
- **Bon Cuisine** : bon **sans prix**, **regroupé par poste** (Cuisine, Bar, Labo). Boissons exclues par défaut.
- **Ticket Caisse** : reçu client complet.
- Chrome mémorise la dernière imprimante par bouton.

### Mode hors ligne
- Si Internet coupe, l'app reste utilisable : catalogue, panier, impression.
- Vente encaissée hors ligne → **file d'attente locale** (IndexedDB). Toast : « Vente enregistrée hors ligne ».
- Au retour du réseau, la file se vide automatiquement.
- **Ne pas vider le cache** tant que des ventes sont en attente.

### Tabs (tickets en pause)
- **Mettre de côté** → réouverture depuis l'onglet des tabs.

---

## 3. Catalogue produits & catégories

- **Catalogue** : liste, filtres catégorie / statut, recherche.
- **Ajouter** : nom, catégorie, prix vente, prix coût, photo, **poste de préparation** (salle / cuisine / bar / labo).
- **Désactiver plutôt que supprimer** : si le produit est référencé dans l'historique (ventes, transferts, production, pertes…), il est **désactivé automatiquement** avec un toast clair *(« Produit désactivé — X références préservées »)*. Aucune erreur SQL n'est affichée.
- **Import / Export Excel** disponibles en haut de la page.
- **Administration → Catégories** : créer, renommer, activer/désactiver, réordonner.

---

## 4. Fiches techniques

- Liste des fiches par produit, coût total auto-calculé depuis les MP.
- **Exporter Excel** : toutes les fiches dans un classeur multi-onglets.
- **Importer Excel** : multi-produits. Headers tolérés : `INGREDIENT(S)` / `MATIERE` / `NOM` / `DESIGNATION`, `QTE`, `UNITE`, `COUT UNITAIRE`. L'onglet doit correspondre au nom du produit.
- Boutons par produit : Excel + PDF + Import.

---

## 5. Matières premières & achats

- **Matières premières** : créer, prix unitaire, fournisseur, marque, colisage, stock min.
- **Achats MP** : enregistrer chaque achat (date, produit, quantité, prix). Met à jour le coût moyen utilisé par les fiches. Validation stricte : nom, quantité > 0, prix ≥ 0 ; en cas d'erreur, le **vrai message Supabase** s'affiche.

---

## 6. Stock & inventaire

- **Stock tampon** : mouvements quotidiens.
- **Inventaire** : saisie périodique par section (Excel compatible FICHES TECHNIQUES).
- **Bons de transfert** : labo → salle, validation/réception tracées.

---

## 7. Production labo & cuisine

- Saisir qte produite, qte sortie en salle, pertes par produit/jour.
- Tableau de bord par labo.

---

## 8. Pertes & dégustations

- **Pertes** : par semaine, jour, labo, produit. Photo justificative possible.
- **Dégustations** : produit goûté + motif + photo.

---

## 9. Ventes & clients (crédits)

- **Ventes** : historique filtrable + détail par ticket.
- **Clients** : fiche, plafond crédit, encours, paiements.
- Mode « Crédit » au POS → crédit créé automatiquement, recalcul auto du restant dû à chaque paiement.

---

## 10. Clôture journalière

- Stock d'ouverture **calculé automatiquement** : initial + achats − ventes − pertes.
- Saisir : qte invendue, perte, dégustation, comptage final.
- Sessions de caisse verrouillées en fin de journée (alimente le rapport CEO).

---

## 11. Rapports CEO & audits

- **Rapports CEO** : rapport journalier envoyé par email **automatiquement à 23h00** (`nkro006@gmail.com` par défaut — domaine à vérifier sur Resend pour changer le destinataire).
- Bouton **Envoyer le rapport d'aujourd'hui** pour un envoi manuel.
- **Audits CEO** : grille multi-rubriques (défauts / améliorations) + export PDF + envoi email.

---

## 12. Économat *(nouveau)*

Page **Économat** — réservée aux rôles **CEO** et **Économat**.

### Référentiel articles
- 210+ articles importés depuis la fiche de stock client (Arômes, Fruits & légumes, Viandes, Laitiers, Épicerie, etc.).
- Champs : catégorie, nom, unité (G / KG / L / pièce), prix unitaire, stock initial, stock minimum.
- Boutons **+ Nouvel article**, **Éditer**, **Supprimer**.

### Mouvements de stock
- Bouton **Mouvement** → 3 types :
  - **Entrée** (réception fournisseur, achat)
  - **Sortie** (consommation, transfert labo / cuisine)
  - **Perte / Avarie** (casse, péremption)
- Stock courant = `initial + entrées − sorties − pertes` (vue SQL `v_economat_stock`).
- Onglet **Mouvements** : 200 derniers mouvements.

### Indicateurs (KPI)
- Nombre d'articles · Valeur totale du stock (FCFA) · Pertes cumulées · Alertes (stock ≤ minimum).

### Import / Export Excel
- **Exporter Excel / PDF** : état complet du stock.
- **Importer Excel** : compatible « FICHE DE STOCK VILLA NO BAD DAY ». Colonnes : `MATIERES/DESIGNATION`, `SOTCKS INITIAL`, `UNITE/G`, `PRIX UNITAIRE`.
- Les lignes d'**en-tête en MAJUSCULES** (ex : « AROME / COLORANTS ») sont détectées comme **catégories** automatiquement.
- Logique : mise à jour si nom déjà connu, sinon création.

---

## 13. Journal d'activité

- **Administration → Journal d'activité** : trace auto de création / modification / suppression sur 22 tables clés.
- **Réservé à la CEO**. Le journal se remplit tout seul via triggers SQL — aucune action requise.

---

## 14. Modèles de tickets

**Administration → Modèles de tickets** :
- 2 templates : `caisse` et `cuisine`.
- En-tête, pied de page, options d'affichage (prix, serveur, table, mode paiement, monnaie).
- Spécifique cuisine : exclure boissons, regrouper par catégorie, masquer prix.
- Taille police et largeur papier configurables.
- Aperçu live + bouton **Test d'impression**.

---

## 15. Installation tablette / PWA

1. Ouvrir l'URL publiée dans **Chrome** sur la tablette.
2. Menu Chrome → **Ajouter à l'écran d'accueil**.
3. L'app s'ouvre en plein écran.
4. **Mode hors ligne actif uniquement après publication** (pas dans l'éditeur).

### Configurer 2 imprimantes (Cuisine + Caisse)
- Brancher les 2 imprimantes.
- 1er clic sur **Bon Cuisine** → sélectionner imprimante cuisine, cocher « par défaut ».
- 1er clic sur **Ticket Caisse** → idem avec l'imprimante caisse.
- Chrome retient le choix par type de document.

---

## 16. Assistante IA CEO *(nouveau)*

Page **Assistant IA** — assistant personnel de la CEO, raisonne sur les données live de l'application.

### Capacités
- 📦 Stock économat en temps réel : « Quel est le stock de farine ? », « Articles en alerte ? », « Valeur totale ? »
- 💰 Analyse ventes, pertes, production, achats MP sur 7 / 30 jours.
- 📎 **Pièces jointes** : Excel (`.xlsx`), CSV, PDF — bouton trombone. L'IA croise le fichier avec les données live.
- 🎯 Suggère commandes à passer, alertes critiques, produits à arrêter.
- 🤖 Modèle : `gemini-2.5-flash` via Lovable AI Gateway.

### Mouvement de stock via l'IA
Dire « la production a sorti 3 cupcakes » → l'IA **prépare** la saisie (article, type, quantité, motif) et indique où cliquer dans **Économat → Mouvement**. La validation reste manuelle (traçabilité audit).

### Exemples
- « Stock actuel d'économat ? »
- « Articles en alerte ? »
- « Top 5 produits vendus cette semaine »
- « Rentabilité par catégorie »
- *(joindre Excel fournisseur)* « Compare-le à mon stock et liste les écarts »

---

## 17. Sauvegarde, sécurité & tests

- Données stockées dans Lovable Cloud (sauvegardes automatiques).
- **RLS (Row Level Security)** activé sur toutes les tables. Permissions granulaires par module (CRUD) via la matrice `module_permissions`. Le CEO bypasse tout.
- **Audit complet** de toutes les actions sensibles (table `audit_logs`).
- Roles stockés dans `user_roles` (séparé des profils — sécurité contre élévation de privilèges).
- **Tests Playwright E2E** : `tests/e2e/` — auth, navigation modules critiques, flux POS. Compte test `test@saade.com`. Lancer : `npx playwright test --config=playwright.e2e.config.ts`.

---

## 18. Dépannage rapide

| Problème | Solution |
|----------|----------|
| Ticket cuisine vide | Vérifier que les produits ne sont pas tous en catégorie « Boisson » (exclues par défaut). Voir Modèles de tickets. |
| Suppression produit refusée | Normal : produit utilisé dans l'historique. Désactivé automatiquement (toast clair indiquant le nombre de références préservées). |
| « Erreur » sans détail | Corrigé en juin 2026 : tous les toasts affichent la cause réelle (`e?.message`). |
| Vente en attente après reconnexion | Attendre 30 s sur POS, la file se vide. Ne pas vider le cache. |
| Import Excel rejeté | Vérifier les en-têtes. Économat : `MATIERES/DESIGNATION`, `SOTCKS INITIAL`, `UNITE/G`, `PRIX UNITAIRE`. Fiches : `INGREDIENT(S)`, `QTE`, `UNITE`. |
| Stock à 0 en clôture | Saisir d'abord achats + production de la journée. |
| IA ne lit pas le PDF | Privilégier Excel/CSV. Les PDF scannés (image) ne sont pas OCRisés. |
| Mail rapport non reçu | Le destinataire par défaut est l'email du compte Resend. Pour un autre destinataire, vérifier un domaine sur resend.com/domains. |
| Erreur ajout achat MP | Le vrai message Supabase s'affiche (ex : nom manquant, prix négatif). Corriger puis réessayer. |

---

Pour toute évolution, contacter l'équipe technique.
