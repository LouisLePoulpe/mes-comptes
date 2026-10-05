# Poulpécule 2.1.0

- [Ouvrir le site](https://louislepoulpe.github.io/mes-comptes/)
- [Télécharger l’APK Android signée](https://github.com/LouisLePoulpe/mes-comptes/releases/download/v2.1.0/Poulpecule-2.1.0.apk)
- [Installation et notes de version](https://github.com/LouisLePoulpe/mes-comptes/releases/tag/v2.1.0)

Comptes personnels isolés, données chiffrées, historique complet, import/export Excel,
budget configurable, recherche, calculs de montants et modes clair/sombre/système.

La version 2.0.2 rétablit l’usage hors connexion avec conservation des modifications
après redémarrage et synchronisation automatique. Après la mise à jour, ouvrir
l’application avec Internet et attendre l’icône de synchronisation verte une première fois.
Voir [le fonctionnement hors connexion et ses tests](docs/OFFLINE.md).

La version 2.0.3 retire le bandeau supérieur, regroupe la déconnexion et « À propos »
dans Paramètres, affiche un indicateur de synchronisation compact dans Dashboard
et Historique, et centre les boutons de navigation.

L’export Android a été validé sur appareil. La release configure Google natif ;
son parcours complet reste à confirmer sur appareil. La signature stable permet
les futures mises à jour. Pour remplacer une APK de test signée différemment,
conserver son export et sa passphrase avant de la désinstaller.

Fonctionnalités : [suivi V2](docs/V2-FEATURES.md). Version APK : [préparation Android](docs/ANDROID.md).

Fondations et procédure de migration : [docs/V2-MIGRATION.md](docs/V2-MIGRATION.md). Les builds utilisent les émulateurs par défaut. Aucune migration en production n’est automatique.

# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
