# Guide de Contribution

Merci de votre intérêt pour contribuer au projet SAADÉ ! Ce guide vous aidera à démarrer.

## 📋 Prérequis

- Node.js 18+
- npm ou bun
- Compte Supabase (pour le développement local)

## 🚀 Installation

1. **Fork le repository**
2. **Clonez votre fork**
```bash
git clone https://github.com/votre-username/saade-no-bad-days.git
cd saade-no-bad-days
```

3. **Installez les dépendances**
```bash
npm install
```

4. **Configurez les variables d'environnement**
```bash
cp .env.example .env
```
Éditez `.env` avec vos credentials Supabase.

5. **Lancez le serveur de développement**
```bash
npm run dev
```

## 🌳 Branches

- `main` - Branche de production
- `develop` - Branche de développement
- `feature/*` - Nouvelles fonctionnalités
- `fix/*` - Corrections de bugs
- `hotfix/*` - Corrections urgentes en production

## 📝 Processus de contribution

### 1. Créez une branche

```bash
git checkout develop
git pull origin develop
git checkout -b feature/ma-fonctionnalite
```

### 2. Faites vos modifications

- Suivez les conventions de code existantes
- Ajoutez des tests pour les nouvelles fonctionnalités
- Mettez à jour la documentation si nécessaire

### 3. Formattage et linting

```bash
npm run format
npm run lint
npm run lint:fix
```

### 4. Tests

```bash
npm run test
```

### 5. Commit

Utilisez des messages de commit clairs :

```
feat: ajouter la fonctionnalité X
fix: corriger le bug Y
docs: mettre à jour la documentation
style: formattage du code
refactor: refactorisation du code
test: ajouter des tests
chore: mise à jour des dépendances
```

### 6. Push et Pull Request

```bash
git push origin feature/ma-fonctionnalite
```

Ensuite, ouvrez une Pull Request sur GitHub avec :
- Une description claire des modifications
- Des captures d'écran si applicable
- Référence aux issues liées

## 🎨 Conventions de code

### TypeScript

- Utilisez le mode strict TypeScript
- Définissez les types explicitement
- Évitez `any` autant que possible
- Utilisez les interfaces pour les objets

### React

- Utilisez les composants fonctionnels
- Utilisez les hooks pour la logique
- Suivez les règles des hooks de React
- Utilisez TypeScript pour les props

### Styling

- Utilisez TailwindCSS
- Utilisez les composants shadcn/ui
- Suivez les conventions de nommage
- Privilégiez le responsive design

### Tests

- Écrivez des tests pour les nouvelles fonctionnalités
- Utilisez Vitest pour les tests unitaires
- Utilisez Playwright pour les tests E2E
- Visez une couverture de code > 80%

## 📁 Structure du projet

```
src/
├── components/       # Composants React réutilisables
│   ├── ui/          # Composants shadcn/ui
│   └── ...          # Composants personnalisés
├── pages/           # Pages de l'application
├── contexts/        # Contexts React
├── hooks/           # Hooks personnalisés
├── lib/             # Utilitaires et configurations
├── integrations/    # Intégrations Supabase
└── locales/         # Fichiers de traduction
```

## 🌍 Internationalisation

- Toutes les nouvelles chaînes de caractères doivent être internationalisées
- Ajoutez les traductions dans `src/lib/i18n.ts` pour FR, EN, et AR
- Utilisez le hook `useTranslation` pour accéder aux traductions

## 🔒 Sécurité

- Ne commitez jamais de credentials ou de clés API
- Utilisez les variables d'environnement pour les secrets
- Suivez les meilleures pratiques de sécurité Supabase
- Vérifiez les permissions RLS avant de déployer

## 🐛 Signalement de bugs

Pour signaler un bug :
1. Vérifiez si le bug existe déjà
2. Créez une nouvelle issue avec :
   - Un titre descriptif
   - Les étapes pour reproduire
   - Le comportement attendu
   - Le comportement actuel
   - Captures d'écran si applicable
   - Environnement (OS, navigateur, version)

## 💡 Suggestions de fonctionnalités

Pour suggérer une nouvelle fonctionnalité :
1. Vérifiez si la suggestion existe déjà
2. Créez une nouvelle issue avec :
   - Un titre descriptif
   - Une description détaillée
   - Le cas d'utilisation
   - Des maquettes ou captures d'écran si applicable

## 📞 Contact

Pour toute question, contactez l'équipe technique SAADÉ.

## 📄 Licence

En contribuant à ce projet, vous acceptez que vos contributions soient licenciées sous la même licence que le projet.
