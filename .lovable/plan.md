
## Objectif

Sept chantiers liés, livrés ensemble, sans casser l'existant.

---

### 1. Cycle de vie complet de chaque Matière Première

Nouvelle page **"Cycle de vie MP"** (route `/mp/:id/cycle`) accessible :
- depuis chaque ligne de **Matières Premières** (bouton "Voir cycle"),
- depuis **Suivi de Stock → onglet MP** (clic sur une MP),
- depuis l'**Économat / Achats MP / Pertes** (lien sur le nom MP).

Contenu (timeline + tableaux filtrables par date) :
- **Entrées** : achats (`achats_mp`), bons de transfert entrants.
- **Sorties** : conso production labo (`production_labo` × fiche technique), conso ventes minute (vente_lignes × fiche), bons de transfert sortants, pertes (`pertes`).
- **Ajustements** : inventaire (`inventaire`), corrections manuelles.
- **Solde courant** + **graphique d'évolution 30/90j**.
- **Anomalies** (consommation négative, ruptures, mouvements sans source).

Tout est exportable PDF + Excel (avec libellé MP, période, lignes complètes).

---

### 2. Toutes les cartes KPI cliquables (drill-down universel)

Étendre le `KpiDetailDialog` déjà créé pour Ventes à :
- **Tableau de bord** : CA jour, tickets, panier moyen, top vendeurs, alertes stock, pertes du jour.
- **SAADÉ en live** : CA live, sessions ouvertes, ticket courant.
- **Clients & Crédits** : Clients, Ardoises ouvertes, Total dû, Crédits soldés → liste détaillée + export.
- **Économat**, **Stock Tampon**, **Pertes**, **Achats MP**, **Inventaire**, **Production Labo** : chaque carte ouvre la liste complète filtrée + export PDF/Excel.

Composant générique `<KpiCard onClick clickable detail={...}/>` partagé pour garantir un comportement uniforme.

---

### 3. Assistant IA gratuit illimité pour la CEO

Le crédit Lovable AI est consommable → remplacement par un **Assistant local intelligent**, gratuit et sans limite, basé sur les données de l'app :

- Nouveau moteur `localCeoAssistant.ts` :
  - **Intent router** par mots-clés / regex FR (écart caisse, stock, top produits, MP en rupture, marge, pertes, clients en retard, CA jour/semaine/mois, etc.).
  - Chaque intent exécute des **requêtes Supabase paramétrées** (RLS CEO) et renvoie une réponse formatée Markdown avec chiffres, tableaux et liens vers la page concernée.
  - **Suggestions cliquables** mises à jour (15 questions clés CEO).
- Fallback : si aucun intent ne matche, propose 3 reformulations basées sur les intents disponibles (pas d'appel LLM payant).
- Le bandeau "Crédits IA épuisés" disparaît ; remplacé par "Assistant SAADÉ (local, gratuit)".
- Option future (désactivée par défaut) : brancher Lovable AI uniquement pour les questions "ouvertes" si la CEO active un toggle.

---

### 4. Export PDF — fin des caractères illisibles (`&1 /&5&0&0& &F`)

Cause identifiée : jsPDF avec police par défaut ne supporte pas certains caractères + le format `Intl.NumberFormat('fr-FR')` insère des **espaces insécables U+202F** qui jsPDF rend en `&xxxx`.

Corrections :
- Embarquer une police Unicode (Roboto / DejaVu) via `jspdf` `addFileToVFS` + `addFont` une fois pour toute l'app (`src/lib/pdfFont.ts`).
- Helper `fmtPdf(n)` qui formate sans espaces insécables (`String(n).replace(/\u202F|\u00A0/g, ' ')`) et applique `F` sans casse.
- Toutes les exports PDF (Rapports CEO, Ventes, Audit, KpiDetail, Cycle MP, Clôture, Fiches Techniques) passent par un wrapper unique `createPdf()` qui :
  - charge la police Unicode,
  - utilise `jspdf-autotable` avec `styles: { font: 'Roboto' }`,
  - applique le pattern "smart page break" par section (data-pdf-section) pour ne plus couper les blocs.

---

### 5. Export Excel rapports journaliers — détaillé, pas un résumé

Nouvelle structure multi-feuilles dans **Rapports CEO** et **Clôture/Ventes** :
- `Résumé` : les KPIs actuels.
- `Tickets` : **chaque ticket** de la période (numéro, date, mode paiement, total, caissier, statut).
- `Lignes` : **chaque ligne** de vente (ticket, produit, catégorie, qté, PU, total, options).
- `Produits` : agrégat par produit (qté, CA, marge si dispo) — **tous les produits vendus**, pas le top 20.
- `Paiements` : par mode et par session.
- `Crédits` : nouveaux crédits, paiements reçus, encours.
- `Pertes` : lignes pertes de la période.
- `Clôture` : ouverture / reçu / vendu / invendu / -50% / compté / perte par produit.
- `Sessions caisse` : ouverture/fermeture/écart par session.

Côté code : `exportRapportJournalierDetaille(date|range)` factorisé, réutilisé par le bouton existant et le nouveau "Rapport détaillé".

---

### 6. Bug Admin "Erreur de chargement des utilisateurs"

Inspecter l'edge function `manage-users` (action `list`) :
- Vérifier la présence des secrets, le retour JWKS (`getClaims`) et les logs Edge.
- Côté front : afficher l'erreur réelle (message backend) au lieu du texte générique pour pouvoir diagnostiquer.
- Si l'erreur est due à `auth.admin.listUsers()` paginé : passer en `perPage: 1000` + boucle.
- Re-déployer la function après correctifs.

---

### 7. Ré-import propre des Fiches Techniques (FT MAI 2026.xlsx)

Le fichier contient **134 feuilles** : `LISTE MP`, `LISTING PR-PV-MARGE`, stocks, puis **une feuille par produit** (CAKE MARBRE, BROWNIE, COOKIE…).

Process :
- Script d'import contrôlé `importFichesFromFTMai2026.ts` (admin only) :
  1. Charge le xlsx, ignore les feuilles "système" (LISTE MP, LISTING…, STOCK…).
  2. Pour chaque feuille produit : utilise `parseFicheExcel.ts` existant (déjà robuste, déjà debuggé pour marges).
  3. **Matche le produit** par nom normalisé (existant dans `produits`). Si introuvable → log dans rapport, pas de création auto.
  4. **Remplace** (DELETE + INSERT) les `fiches_techniques` du produit pour cohérence stricte avec le fichier.
  5. Met à jour `fiches_techniques_meta` (rendement, temps, conservation, etc.) sans toucher PR/PV manuels.
  6. Recalcule le coût matière via prix MP courants + tolère prix surchargés du fichier en source secondaire.
- **Aperçu obligatoire** avant validation (réutilise `FicheImportPreviewDialog`) : la CEO voit exactement ce qui sera écrit, ligne par ligne, marges incluses.
- Rapport final téléchargeable (Excel) : produits importés, produits non trouvés, ingrédients non matchés aux MP.

Aucune marge "inventée" : la marge affichée = (PV catalogue − coût matière calculé), strictement.

---

### 8. Audit bugs transverses

Passe finale sur :
- Notifications & realtime (vérifier les channels, doublons).
- Permissions (`usePermissions`) : ajouter clé `suivi-stock`, `mp-cycle`.
- Sidebar : ajouter "Cycle MP" sous Stocks, regrouper visuellement (Pilotage / Ventes / Stocks / Admin) — cohérent avec l'ancienne suggestion.
- Cohérence dates (UTC vs Lomé) sur Clôture, Rapports, Suivi Stock.
- Tests build + lint, correctifs des warnings TypeScript bloquants éventuels.

---

## Détails techniques (résumé)

- **Nouveaux fichiers** : `src/pages/MpCycleDeVie.tsx`, `src/components/KpiCard.tsx`, `src/components/KpiDetailDialog.tsx` (étendu), `src/lib/localCeoAssistant.ts`, `src/lib/pdfFont.ts`, `src/lib/exportRapportDetaille.ts`, `src/lib/importFichesFTMai2026.ts`.
- **Migrations** : ajouter clé permission `suivi-stock` + `mp-cycle` (`module_permissions`).
- **Edge function** : patch `manage-users` (`list` action) + redeploy.
- **Aucune suppression** de données existantes hors fiches techniques remplacées via aperçu validé.

Risques : import des 134 feuilles long → exécuter en batches de 20 avec barre de progression. PDF font ajoute ~150 Ko au bundle (acceptable).
