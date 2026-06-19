## Plan approuvé + ajouts Ventes & Rapports

### 1. Suivi de Stock — sélecteur de date
Barre `[<] [date] [>]  [Aujourd'hui] [Hier] [-7j]` en haut de `/suivi-stock`. La date pilote le snapshot Produits Labo du jour, la conso N jours, et le filtre par défaut de l'historique. KPIs valeur stock / anomalies restent temps réel (badge "live").

### 2. Production Labo — Pain Bro + recherche
- Filtrer la saisie sur `type_production = 'labo'` uniquement → Pain Bro, formules, boissons et autres "minute/revente" disparaissent de l'écran Production.
- Recherche déjà présente, rendue plus visible (pleine largeur mobile, placeholder explicite, compteur "X/Y produits").
- **Aucune donnée modifiée** : la CEO reclassera Pain Bro depuis Catalogue (minute si préparé, revente si acheté, et le pain "matière" reste géré par Matières Premières / Achats MP).

### 3. Rapports CEO — gros bouton "Rapport journalier"
Encart en haut de `/rapports-ceo` avec sélecteur de date + raccourcis Hier/-7j + deux gros boutons **Télécharger PDF** et **Télécharger Excel**. Données 100 % cohérentes avec l'email automatique (mêmes requêtes : CA, tickets, top produits, écarts caisse, crédits, pertes, MP critiques, anomalies). Génération côté client, fonctionne même si Resend est en panne.

### 4. Ventes & Rapports — KPIs cliquables + Top produits étendu (ajout de cette itération)

**KPI cards cliquables** (CA, Tickets, Panier moyen, Articles vendus) :
- Chaque carte ouvre une **modale de détail** sur la période sélectionnée, exportable Excel + PDF.
  - **Chiffre d'affaires** → ventilation par jour + par mode de paiement + par catégorie.
  - **Tickets** → liste paginée de tous les tickets (date/heure, n°, mode paiement, total, statut). Clic ticket = même drawer "détail ticket" que celui du Journal.
  - **Panier moyen** → distribution (min / médiane / max), top 10 plus gros tickets, top 10 plus petits.
  - **Articles vendus** → liste complète des produits avec quantité (équivalent du Top produits étendu — lien direct vers l'onglet Top produits).

**Top produits étendu** :
- Bouton **"Voir plus"** sous le Top 20 → bascule en mode "tous les produits du catalogue", triés du plus vendu au jamais vendu (les jamais vendus apparaissent en bas avec quantité 0 et un badge "Jamais vendu").
- Recherche + tri (quantité / CA / nom) + filtre catégorie.
- Export **Excel ET PDF** de la liste complète affichée (pas seulement le top 20).

### Audit de cohérence
Avant de coder, je revérifie que :
- `v_mp_stock` est bien la seule source pour les MP.
- Produits Labo dans Suivi Stock = uniquement `type_production='labo'`.
- Ticket modal Ventes utilise le même composant `TicketDetailDialog` créé précédemment dans le Journal.
- Aucune donnée inventée, aucune migration SQL dans cette itération.

### Problèmes constatés (rappel) + propositions pour la CEO
**Problèmes** : ProductionLabo pollué par non-labo, SuiviStock figé sur aujourd'hui, RapportsCEO dépendant de l'email, pas de détail-par-MP, sidebar dense.
**Propositions (à valider après)** : sidebar regroupée en 4 sections (Pilotage / Ventes / Stocks / Admin), Cockpit CEO fusionné, détail MP cliquable avec courbe 30j, cloche notifications, recherche globale ⌘K.

### Détails techniques
- `SuiviStock.tsx` : `useState selectedDate`, propagation dans queries.
- `ProductionLabo.tsx` : `products.filter(p => p.type_production === 'labo')`.
- `RapportsCeo.tsx` : nouveau composant `RapportJournalierExport` (jsPDF + autoTable, ajout dep si absent ; Excel via `exportToExcel`).
- `Ventes.tsx` : wrapping des `<Card>` KPI en boutons accessibles, 4 modales `Dialog` (CADetailDialog, TicketsListDialog, PanierMoyenDialog, ArticlesVendusDialog) ; bouton "Voir plus" qui bascule la query `top_produits` vers un mode `all_with_zero` (LEFT JOIN `produits` ← `vente_lignes` agrégé). Export PDF + Excel sur chaque vue.
- Aucun changement DB, aucune donnée modifiée.
