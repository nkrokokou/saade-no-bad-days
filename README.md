# SAADÉ — Laboratoire & Boutique

Application web de gestion complète pour la pâtisserie libanaise SAADÉ à Lomé. Gestion de production, ventes, pertes, stocks, catalogue, clients et bien plus encore.

## 🚀 Fonctionnalités

### Modules principaux
- **Dashboard** - Tableau de bord avec KPIs et graphiques
- **POS / Caisse** - Point de vente pour la boutique
- **Ventes & Rapports** - Historique et analyse des ventes
- **Clients & Crédits** - Gestion de la clientèle
- **Catalogue produits** - Gestion du catalogue
- **Matières Premières** - Stock et achats MP
- **Fiches Techniques** - Recettes et ratios de production
- **Bons de Transfert** - Transferts entre zones
- **Stock Tampon** - Stock intermédiaire
- **Pertes** - Suivi des pertes
- **Production Labo** - Production du laboratoire
- **Inventaire** - Gestion des inventaires
- **Clôture Journalière** - Bilan quotidien
- **Dégustations** - Échantillons et dégustations
- **Tables Restaurant** - Gestion des tables
- **Insights Bot** - Assistant IA pour l'analyse
- **Administration** - Gestion système et audit

### Rôles utilisateurs
- **CEO** - Accès complet à tous les modules
- **Labo Pâtisserie** - Production et fiches techniques
- **Labo Viennoiserie** - Production viennoiserie
- **Cuisine Salée** - Production cuisine salée
- **Salle** - Ventes et caisse

## 🛠️ Stack technique

### Frontend
- **React 18** avec TypeScript
- **Vite** - Build tool et dev server
- **TailwindCSS** - Styling
- **shadcn/ui** - Composants UI
- **React Router** - Routing
- **TanStack Query** - Gestion d'état serveur
- **React Hook Form** - Gestion des formulaires
- **Zod** - Validation des données
- **i18next** - Internationalisation (FR/EN/AR)

### Backend
- **Supabase** - BaaS (Base de données, Auth, Realtime)
- **PostgreSQL** - Base de données

### Testing
- **Vitest** - Tests unitaires
- **Playwright** - Tests E2E
- **Testing Library** - Tests React

## 📦 Installation

### Prérequis
- Node.js 18+ 
- npm ou bun
- Compte Supabase

### Étapes d'installation

1. **Cloner le repository**
```bash
git clone <repository-url>
cd saade-no-bad-days
```

2. **Installer les dépendances**
```bash
npm install
# ou
bun install
```

3. **Configurer les variables d'environnement**
```bash
cp .env.example .env
```

Éditer `.env` avec vos credentials Supabase :
```env
VITE_SUPABASE_PROJECT_ID="your-project-id"
VITE_SUPABASE_PUBLISHABLE_KEY="your-publishable-key"
VITE_SUPABASE_URL="https://your-project.supabase.co"
```

4. **Configurer la base de données**
```bash
# Appliquer les migrations Supabase
supabase db push
```

5. **Lancer le serveur de développement**
```bash
npm run dev
# ou
bun run dev
```

L'application sera disponible sur `http://localhost:8080`

## 🏗️ Structure du projet

```
src/
├── components/       # Composants React réutilisables
│   ├── ui/          # Composants shadcn/ui
│   └── ...          # Composants personnalisés
├── pages/           # Pages de l'application
├── contexts/        # Contexts React (Auth, etc.)
├── hooks/           # Hooks personnalisés
├── lib/             # Utilitaires et configurations
├── integrations/    # Intégrations Supabase
└── locales/         # Fichiers de traduction
```

## 🌍 Internationalisation

L'application supporte 3 langues :
- 🇫🇷 Français (défaut)
- 🇬🇧 Anglais
- 🇸🇦 Arabe (RTL)

Pour changer la langue, utilisez le sélecteur dans l'interface ou modifiez `localStorage`.

## 🧪 Tests

### Tests unitaires
```bash
npm run test
```

### Tests E2E
```bash
npx playwright test
```

### Tests en mode watch
```bash
npm run test:watch
```

## 📦 Build de production

```bash
npm run build
```

Le build sera généré dans le dossier `dist/`.

### Preview du build
```bash
npm run preview
```

## 🚢 Déploiement

### Vercel
1. Connecter le repository à Vercel
2. Configurer les variables d'environnement
3. Déployer automatiquement

### Autres plateformes
Le projet peut être déployé sur :
- Netlify
- Cloudflare Pages
- Tout hébergement avec support Node.js

## 🔐 Sécurité

- Authentification via Supabase Auth
- Rôles et permissions granulaires
- Row Level Security (RLS) activé
- Audit trail complet

## 📝 Développement

### Linting
```bash
npm run lint
```

### Formattage
Le projet utilise ESLint pour le linting. Prettier peut être ajouté pour le formattage automatique.

### Branches
- `main` - Branche de production
- `develop` - Branche de développement
- `feature/*` - Nouvelles fonctionnalités
- `fix/*` - Corrections de bugs

## 🤝 Contribution

Les contributions sont les bienvenues ! Voir [CONTRIBUTING.md](CONTRIBUTING.md) pour plus de détails.

## 📄 Licence

Ce projet est propriétaire de SAADÉ.

## 📞 Support

Pour toute question ou problème, contactez l'équipe technique SAADÉ.
