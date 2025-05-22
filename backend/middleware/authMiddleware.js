const jwt = require('jsonwebtoken');
// Assurez-vous de définir JWT_SECRET dans vos variables d'environnement
const JWT_SECRET = process.env.JWT_SECRET || 'XeJVCBxHU2qa3YAd4rbNhk6gnjs8WRzTtypFuZcQPfDMS5mv@E';

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (token == null) return res.sendStatus(401); // Pas de token

  jwt.verify(token, JWT_SECRET, (err, user) => {
    console.log('[AuthMiddleware] Token reçu pour vérification:', token); // Log du token brut
    if (err) {
      console.error('[AuthMiddleware] Erreur de vérification JWT:', err.message);
      return res.sendStatus(403); // Token invalide
    }
    console.log('[AuthMiddleware] Token décodé (req.user):', user); // Log du payload décodé
    req.user = user; // Ajoute l'utilisateur décodé à l'objet requête
    next();
  });
}

// Vous pourriez vouloir un middleware spécifique pour les commerçants si la logique diffère
// Pour l'instant, nous utiliserons le même.
// function authenticateMerchantToken(req, res, next) { ... }

module.exports = {
  authenticateToken
};
