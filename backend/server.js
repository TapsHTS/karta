const express = require('express');
const cors = require('cors');
const path = require('path'); // Ajout du module path
const db = require('./models/db'); // Assurez-vous que db.js exporte la connexion

// N'oubliez pas de définir JWT_SECRET dans vos variables d'environnement
// par exemple : export JWT_SECRET='votre_super_secret_jwt'
// Pour la génération d'UUID pour les card_identifier, nous utiliserons le package 'uuid'
// Assurez-vous qu'il est installé : npm install uuid

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const merchantRoutes = require('./routes/merchantRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json()); // Pour parser les requêtes JSON
app.use(express.urlencoded({ extended: true })); // Pour parser les formulaires URL-encoded

// Service des fichiers statiques du frontend
// __dirname se réfère au dossier actuel (backend), donc ../frontend pour remonter d'un niveau
app.use(express.static(path.join(__dirname, '../frontend')));

// Routes API
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/merchants', merchantRoutes);

// Route de test de la base de données
app.get('/api/test-db', async (req, res) => {
  try {
    const [results] = await db.query('SELECT NOW()');
    res.json({ message: 'Connexion à la base de données réussie!', time: results[0] });
  } catch (error) {
    console.error('Erreur de connexion à la base de données:', error);
    res.status(500).json({ message: 'Erreur de connexion à la base de données', error: error.message });
  }
});

// Route racine pour servir la page d'accueil du frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Optionnel : Une route "catch-all" pour les applications monopage (SPA)
// Si vous prévoyez que le frontend gère son propre routage (par exemple avec React Router, Vue Router)
// décommentez ceci. Pour l'instant, avec des fichiers HTML séparés, ce n'est pas strictement nécessaire
// si les liens HTML pointent correctement vers les autres fichiers .html.
/*
app.get('*', (req, res) => {
  // Vérifie si la requête n'est pas pour une API pour éviter de surcharger les routes API
  if (!req.originalUrl.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
  } else {
    // Si c'est une route API non trouvée, laissez Express gérer (généralement 404)
    // ou ajoutez un gestionnaire 404 spécifique pour les API.
    // Pour l'instant, on laisse comme ça.
  }
});
*/

app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});
