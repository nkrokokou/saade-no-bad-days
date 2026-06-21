# Plan — Finitions avant présentation

## 1. Sidebar regroupée par pôles
Réorganiser `AppSidebar.tsx` en groupes (collapsibles) :
- **Pilotage** : Tableau de bord, SAADÉ Live, Assistant IA, Rapports CEO, Audits CEO
- **Ventes** : Caisse/POS, Ventes & Rapports, Tables Restaurant, Clients & Crédits, Clôture journalière, Caisses Live
- **Production** : Production Labo, Fiches Techniques, Dégustations
- **Stocks** : Suivi Stock, Matières Premières, Économat, Stock Tampon, Bons de Transfert, Inventaire, Pertes, Achats MP
- **Catalogue** : Catalogue, Catégories, Templates Ticket
- **Admin** : Admin, Audit Log

## 2. Cycle de vie MP — accès visible
Ajouter bouton "📈 Cycle de vie" sur chaque ligne de `MatieresPremieres.tsx`, `Economat.tsx`, `SuiviStock.tsx` (onglet MP) → ouvre `/mp/:id/cycle`. Plus une bannière d'aide en haut de la page MP.

## 3. Assistant IA — switch + recherche approfondie
- Toggle en haut : **🆓 Local** ↔ **✨ Lovable AI** (persisté localStorage).
- Mode Lovable AI : appelle l'edge function `ai-insights` existante avec contexte enrichi (CA, top produits, ruptures, écarts du jour).
- Mode Local : étendre `ceoAssistantLocal.ts` pour :
  - Comprendre dates relatives ET absolues ("vente du 18/06/2026", "semaine dernière", "mois")
  - Conserver contexte de la conversation précédente (date sélectionnée)
  - Nouveaux intents : écarts caisse détaillés, ventes par caissier, ventes par catégorie, stock critique, marges, ruptures à venir
  - Réponses avec liens cliquables vers pages détails

## 4. KPI cliquables — généralisation
Étendre le pattern `KpiDetailDialog` aux pages : Tableau de bord, Clients, Économat, SuiviStock, Pertes, AchatsMP, Inventaire, ProductionLabo. Composant générique `<KpiCardClickable />` partagé.

## 5. Écarts de caisse — explication + affichage
Documenter et afficher dans `ClotureJournaliere.tsx` + nouvelle modale d'aide :

**Formule** : `écart = (fond_ouverture + ventes_espèces_session) − fond_fermeture_compté`

Causes possibles :
- Fond d'ouverture non renseigné → traité comme 0
- Session non clôturée manuellement → auto-clôture sans comptage physique (donc 0 espèces comptées)
- Crédits encaissés en espèces non rattachés à la session
- Remboursements non saisis

Actions :
- Ajouter colonne "Origine" dans tableau écarts (manuel / auto / fond manquant)
- Bannière d'alerte si sessions auto-clôturées sans comptage
- Tooltip ❓ avec formule sur chaque écart

## 6. Reporté précédemment — Ré-import 134 fiches
Page admin `/fiches/import-mai-2026` avec :
- Upload XLSX (ou chargement du fichier joint)
- Aperçu obligatoire (diff par produit : qtés, coûts, marge avant/après)
- Validation case par case OU tout-en-un
- Rapport final Excel téléchargeable

## Détails techniques

**Fichiers à modifier** :
- `src/components/AppSidebar.tsx` (groupes)
- `src/pages/MatieresPremieres.tsx`, `Economat.tsx`, `SuiviStock.tsx` (bouton cycle)
- `src/pages/InsightsBot.tsx` (toggle + UI)
- `src/lib/ceoAssistantLocal.ts` (intents étendus, contexte)
- `src/pages/ClotureJournaliere.tsx` (écarts détaillés)
- `src/components/KpiCardClickable.tsx` (nouveau)
- 8 pages dashboards (intégration KPI cliquables)

**Fichiers à créer** :
- `src/pages/FichesImportMai2026.tsx`
- `src/components/EcartCaisseHelpDialog.tsx`

Aucune migration DB, aucune suppression de données. Tout est additif/UI.

Confirme et je lance l'implémentation en parallèle.
