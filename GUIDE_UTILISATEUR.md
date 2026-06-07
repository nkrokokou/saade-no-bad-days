# Guide Utilisateur — SAADÉ

Dernière mise à jour : **juin 2026** (mise à jour Économat + Assistante IA).

Cette application gère le laboratoire pâtisserie, la cuisine, la salle, la caisse, **l'économat** et les rapports CEO de SAADÉ (Lomé, Togo). Elle s'utilise dans Chrome (PC, tablette tactile, smartphone) et peut être **installée comme application** via « Ajouter à l'écran d'accueil ».

---

## 1. Connexion & rôles

Chaque utilisateur a un compte et un rôle :

| Rôle | Accès principal |
|------|-----------------|
| **CEO** | Tout — administration, rapports, audits, paramètres, IA |
| **Labo pâtisserie / viennoiserie** | Production, pertes, fiches techniques |
| **Cuisine salée** | Production cuisine, pertes, fiches |
| **Salle / Caisse** | POS, tables, clients, clôture |
| **Économat** *(nouveau)* | Gestion complète du stock matières premières : articles, mouvements (entrées / sorties / pertes), alertes, import / export Excel |

La CEO crée les comptes depuis **Administration → Utilisateurs** et y assigne le rôle.

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
4. La vente est enregistrée + le ticket s'imprime.

### Tickets séparés Cuisine / Caisse
- Bouton **Bon Cuisine** : imprime un bon **sans prix**, **regroupé par poste** (Cuisine, Bar, Labo). Les boissons sont exclues par défaut.
- Bouton **Ticket Caisse** : imprime le reçu client complet.
- Chaque bouton ouvre la boîte de dialogue Chrome → choisir l'imprimante correspondante. Chrome mémorise la dernière imprimante par bouton.

### Mode hors ligne
- Si Internet ou le réseau coupe, l'app reste utilisable : catalogue, panier, impression.
- Une vente encaissée hors ligne est **mise en file d'attente locale** (IndexedDB du navigateur). Toast : « Vente enregistrée hors ligne ».
- Dès que la connexion revient, la file se vide automatiquement (notification « X ventes synchronisées »).
- **Important** : ne pas vider le cache du navigateur tant qu'il reste des ventes en attente.

### Tabs (tickets en attente)
- Mettre un ticket en pause avec **Mettre de côté** → réouverture depuis l'onglet des tabs.

---

## 3. Catalogue produits

- **Catalogue** : liste de tous les produits, filtres par catégorie / statut.
- **Ajouter** : nom, catégorie, prix vente, prix coût, photo, **poste de préparation** (salle / cuisine / bar / labo).
- **Désactiver** plutôt que supprimer : si le produit a déjà été vendu ou utilisé dans un bon de transfert, la suppression est impossible (intégrité historique). L'app le **désactive automatiquement** (toast explicite).
- **Import / Export Excel** disponibles en haut de la page.

### Catégories
- **Administration → Catégories** : créer, renommer, activer/désactiver, réordonner.

---

## 4. Fiches techniques

- Liste des fiches par produit, avec coût total auto-calculé à partir des matières premières.
- Boutons globaux sur la liste :
  - **Exporter Excel** : toutes les fiches dans un classeur multi-onglets (format identique à `FICHES TECHNIQUES.xlsx`).
  - **Importer Excel** : import multi-produits. Headers tolérés : `INGREDIENT(S)` / `MATIERE` / `NOM` / `DESIGNATION`, `QTE`, `UNITE`, `COUT UNITAIRE`. Le nom de l'onglet doit correspondre (même partiellement) au nom du produit.
- Boutons par produit : Excel + PDF + Import.

---

## 5. Matières premières & achats

- **Matières premières** : créer, prix unitaire, fournisseur, marque, colisage, stock min.
- **Achats MP** : enregistrer chaque achat (date, produit, quantité, prix). Mets à jour le coût moyen utilisé par les fiches.

---

## 6. Stock & inventaire

- **Stock tampon** : suivi quotidien des entrées/sorties (mouvements).
- **Inventaire** : saisie périodique du stock physique par section. Format Excel = même que FICHES TECHNIQUES.
- **Bons de transfert** : labo → salle, traçabilité avec validation/réception.

---

## 7. Production labo & cuisine

- Saisir la quantité produite, la quantité sortie en salle et les pertes pour chaque produit/jour.
- Tableau de bord dédié par labo.

---

## 8. Pertes & dégustations

- **Pertes** : par semaine, jour, labo, produit. Photo justificative possible.
- **Dégustations** : produit goûté + motif + photo.

---

## 9. Ventes & Clients

- **Ventes** : historique filtrable + détail par ticket.
- **Clients** : fiche client, plafond crédit, encours, paiements.
- Les crédits sont créés automatiquement quand on choisit le mode « Crédit » au POS.

---

## 10. Clôture journalière

Page **Clôture journalière** :
- Stock d'ouverture **calculé automatiquement** : initial + achats − ventes − pertes.
- Saisir la qte invendue, perte, dégustation, comptage final.
- Sessions de caisse verrouillées en fin de journée (rapport CEO).

---

## 11. Rapports & Audits CEO

- **Rapports CEO** : rapport journalier envoyé par email **automatiquement à 23h00** (configurable).
- **Audits CEO** : grille d'audit multi-rubriques avec défauts / améliorations.
- **Assistante IA** *(nouvelle version)* : voir section 17.

---

## 12. Économat *(nouveau module)*

Page **Économat** (rôles : CEO + Économat).

### Référentiel
- 210+ articles importés depuis la fiche de stock client (Arômes, Fruits & légumes, Viandes, Laitiers, Épicerie, etc.).
- Pour chaque article : catégorie, nom, unité (G / KG / L / pièce), prix unitaire, stock initial, stock minimum (alerte).
- Boutons **+ Nouvel article**, **Éditer**, **Supprimer**.

### Mouvements de stock
- Bouton **Mouvement** → 3 types :
  - **Entrée** : réception fournisseur, achat
  - **Sortie** : consommation, transfert vers labo / cuisine
  - **Perte / Avarie** : casse, péremption
- Le **stock courant** est recalculé automatiquement : `initial + entrées − sorties − pertes`.
- L'historique des 200 derniers mouvements est consultable dans l'onglet **Mouvements**.

### Indicateurs en haut de page
- Nombre d'articles, valeur totale du stock (FCFA), pertes cumulées, alertes (stock ≤ minimum).

### Import / Export Excel
- **Exporter Excel / PDF** : exporte l'état complet du stock.
- **Importer Excel** : compatible avec le modèle « FICHE DE STOCK VILLA NO BAD DAY ». Colonnes reconnues :
  `MATIERES/DESIGNATION` · `SOTCKS INITIAL` · `UNITE/G` · `PRIX UNITAIRE`.
- Les lignes d'**en-tête en majuscules** (ex : « AROME / COLORANTS », « FRUITS ET LEGUMES ») sont détectées comme **catégories** automatiquement.
- L'import met à jour les articles déjà connus (par nom) et crée les nouveaux.

---

## 12. Journal d'activité

- **Administration → Journal d'activité** : trace automatique de toute création / modification / suppression sur 22 tables clés (produits, ventes, fiches, sessions caisse, achats, pertes, etc.).
- Lecture **réservée à la CEO**. Le journal se remplit tout seul via des triggers SQL — aucune action requise.

---

## 13. Modèles de tickets (CEO)

**Administration → Modèles de tickets** :
- 2 templates : `caisse` et `cuisine`.
- Personnaliser en-tête (nom, sous-titre, adresse, téléphone), pied de page, options d'affichage (prix, serveur, table, mode paiement, monnaie rendue).
- Spécifique cuisine : exclure les boissons, regrouper par catégorie, masquer/afficher les prix.
- Taille de police et largeur papier configurables.
- Aperçu live + bouton **Test d'impression**.

---

## 14. Installation tablette / PWA

1. Ouvrir l'URL publiée dans **Chrome** sur la tablette.
2. Menu Chrome → **Ajouter à l'écran d'accueil** → Installer.
3. L'app s'ouvre en plein écran, mémorise l'imprimante par défaut.
4. **Mode hors ligne actif uniquement après publication** (pas dans l'éditeur Lovable).

### Configurer 2 imprimantes (Cuisine + Caisse)
- Brancher les 2 imprimantes au système (Bluetooth, USB ou réseau).
- 1er clic sur **Bon Cuisine** → sélectionner l'imprimante cuisine → cocher « Imprimante par défaut » dans la boîte Chrome (option avancée).
- 1er clic sur **Ticket Caisse** → idem avec l'imprimante caisse.
- Chrome retient le choix pour chaque type de document.

---

## 15. Sauvegarde & sécurité

- Données stockées dans Lovable Cloud (sauvegardes automatiques).
- RLS (Row Level Security) : chaque rôle voit uniquement ce qu'il doit voir.
- Audit complet de toutes les actions sensibles.

---

## 17. Assistante IA (CEO) *(nouveau)*

Page **Assistant IA** — un véritable assistant personnel pour la CEO, qui raisonne sur l'ensemble des données de l'application en temps réel.

### Ce qu'il sait faire
- 📦 Répondre instantanément sur le **stock économat** : « Quel est le stock de farine ? », « Quels articles sont en alerte ? », « Quelle est la valeur de mon stock ? »
- 💰 Analyser les **ventes**, **pertes**, **production**, **achats matières premières** des 7 / 30 derniers jours.
- 📎 **Lire un fichier joint** (Excel `.xlsx`, `.csv` ou PDF) → bouton trombone à gauche de la zone de saisie. L'IA croise le fichier avec les données live (ex : « Compare cet inventaire fournisseur avec mon stock actuel »).
- 🎯 Suggérer des actions concrètes (commandes à passer, alertes critiques, produits à arrêter, etc.).

### Mouvement de stock via l'IA
Quand on demande à l'IA « la production a sorti 3 cupcakes » ou « ajoute 2 kg de farine », elle **prépare la saisie** (article, type, quantité, motif) et indique précisément où cliquer dans **Économat → Mouvement**. La validation finale reste manuelle pour traçabilité (audit log).

### Exemples de questions
- « Quel est le stock actuel d'économat ? »
- « Quels articles sont en alerte stock ? »
- « Top 5 produits les plus vendus cette semaine »
- « Analyse de rentabilité par catégorie »
- *(joindre un Excel fournisseur)* « Compare-le à mon stock et liste les écarts »

---

## 18. Sauvegarde & sécurité

- Données stockées dans Lovable Cloud (sauvegardes automatiques).
- RLS (Row Level Security) : chaque rôle voit uniquement ce qu'il doit voir.
- Audit complet de toutes les actions sensibles.

---

## 19. Dépannage rapide

| Problème | Solution |
|----------|----------|
| Ticket cuisine vide | Vérifier que les produits ne sont pas tous en catégorie "Boisson" (qui sont exclues par défaut). Voir Modèles de tickets. |
| Suppression produit refusée | Normal : le produit est utilisé dans l'historique. Il est **désactivé** automatiquement (toast clair indiquant le nombre de références préservées). Aucune erreur SQL n'est affichée à l'utilisateur. |
| « Erreur » affiché sans détail | Corrigé en juin 2026 : tous les messages d'erreur affichent désormais la cause réelle (ex : « Sauvegarde : violates unique constraint »). |
| Vente en attente après reconnexion | Ouvrir le POS, attendre 30 s, la file se vide automatiquement. Ne pas vider le cache navigateur. |
| Import Excel rejeté | Vérifier les en-têtes. Pour Économat : `MATIERES/DESIGNATION`, `SOTCKS INITIAL`, `UNITE/G`, `PRIX UNITAIRE`. Pour fiches techniques : `INGREDIENT(S)`, `QTE`, `UNITE`. |
| Stock à 0 par défaut en clôture | Calcul auto : il faut avoir saisi les achats et la production de la journée. |
| IA ne lit pas le PDF | Privilégier Excel/CSV. Les PDF scannés (image) ne sont pas OCRisés ; convertir en Excel d'abord. |

---

Pour toute évolution, contacter l'équipe technique.
