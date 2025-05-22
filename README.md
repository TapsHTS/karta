# Karta - Plateforme Universelle de Cartes de Fidélité Numériques

Karta est une plateforme web conçue pour permettre aux utilisateurs de centraliser leurs cartes de fidélité numériques et aux commerçants de gérer facilement leurs programmes de fidélité.

## Objectif du MVP

*   Permettre à un utilisateur d’avoir plusieurs cartes dans un seul espace web.
*   Permettre à un commerçant de scanner une carte et de mettre à jour les points.
*   Créer une plateforme simple, rapide et mobile-friendly.

## Structure du Projet

```
/
├── backend/        # API Node.js/Express
│   ├── models/     # Modèles de données et connexion DB
│   ├── routes/     # Définitions des routes de l'API
│   ├── server.js   # Point d'entrée du serveur backend
│   └── package.json
├── database/       # Scripts SQL
│   └── schema.sql  # Schéma de la base de données
├── frontend/       # Interface utilisateur (HTML, CSS, JS)
│   ├── css/
│   ├── js/
│   │   └── lib/    # Bibliothèques JS (QR Code, Barcode)
│   ├── assets/     # Images, logos
│   ├── index.html  # Page de connexion/inscription utilisateur
│   ├── dashboard.html # Tableau de bord utilisateur
│   ├── merchant_login.html # Page de connexion/inscription commerçant
│   └── merchant_dashboard.html # Tableau de bord commerçant
└── README.md
```

## Technologies

*   **Backend**: Node.js, Express.js
*   **Frontend**: HTML, CSS, JavaScript, Bootstrap
*   **Base de données**: MySQL
*   **QR/Barcode**: qrcode.js, JsBarcode
*   **Authentification**: JWT (prévu)

## Installation et Démarrage (Instructions de base)

### Prérequis

*   Node.js et npm
*   Serveur MySQL

### Base de données

1.  Assurez-vous que votre serveur MySQL est en cours d'exécution.
2.  Créez une base de données (par ex., `karta_db`).
3.  Créez un utilisateur pour cette base de données (par ex., `karta_user` avec un mot de passe). Accordez-lui les permissions nécessaires.
4.  Exécutez le script `database/schema.sql` pour créer les tables.
5.  Configurez les informations de connexion à la base de données dans `backend/models/db.js` ou via des variables d'environnement (`DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`).

### Backend

1.  Naviguez vers le dossier `backend`: `cd backend`
2.  Installez les dépendances: `npm install`
3.  Démarrez le serveur: `npm start` (ou `npm run dev` pour nodemon)
    Le serveur backend devrait démarrer sur `http://localhost:3000` (ou le port configuré).

### Frontend

1.  Ouvrez les fichiers HTML (par ex., `frontend/index.html`) directement dans votre navigateur.
2.  Pour une meilleure expérience de développement, vous pouvez utiliser une extension de serveur live pour VS Code ou un simple serveur HTTP statique.
3.  Téléchargez les bibliothèques `qrcode.min.js` et `JsBarcode.all.min.js` et placez-les dans `frontend/js/lib/`.
    *   QRCode.js: [https://github.com/davidshimjs/qrcodejs](https://github.com/davidshimjs/qrcodejs)
    *   JsBarcode: [https://github.com/lindell/JsBarcode](https://github.com/lindell/JsBarcode) (cherchez dans le dossier `dist`)

## Prochaines Étapes (Développement MVP)

1.  Implémenter la logique d'authentification (inscription, connexion) dans `backend/routes/authRoutes.js` (hachage de mot de passe, génération de JWT).
2.  Implémenter les appels API correspondants dans `frontend/js/script.js` pour la connexion et l'inscription.
3.  Sécuriser les routes API du backend avec un middleware d'authentification JWT.
4.  Développer les fonctionnalités CRUD pour les cartes de fidélité (côté utilisateur et commerçant).
5.  Intégrer la lecture de QR code/code-barres via la caméra (côté commerçant).
6.  Affiner l'interface utilisateur et l'expérience utilisateur.
