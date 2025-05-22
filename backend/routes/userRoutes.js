const express = require('express');
const router = express.Router();
const db = require('../models/db');
const { authenticateToken } = require('../middleware/authMiddleware');
const { v4: uuidv4 } = require('uuid'); // Pour générer des identifiants uniques pour les cartes

// Obtenir les cartes de fidélité de l'utilisateur
router.get('/cards', authenticateToken, async (req, res) => {
  console.log('[UserRoutes GET /cards] req.user reçu:', req.user); // Log de req.user
  // req.user.id est disponible grâce au middleware authenticateToken
  if (!req.user || req.user.type !== 'user') { // Ajout d'une vérification de l'existence de req.user
    console.warn('[UserRoutes GET /cards] Tentative d\'accès non autorisé ou type incorrect. req.user.type:', req.user ? req.user.type : 'undefined');
    return res.status(403).json({ message: "Accès non autorisé pour ce type d'utilisateur ou token invalide." });
  }
  const userId = req.user.id;

  try {
    // Récupérer les cartes et joindre les informations du commerçant
    const [cards] = await db.query(
      `SELECT 
         lc.id, lc.user_id, lc.merchant_id, lc.card_identifier, lc.points, lc.stamps, lc.created_at, lc.updated_at, 
         m.name as merchant_name, m.logo_url
       FROM loyalty_cards lc
       JOIN merchants m ON lc.merchant_id = m.id
       WHERE lc.user_id = ?`,
      [userId]
    );

    // Pour chaque carte, vérifier s'il y a une offre active non réclamée
    const cardsWithOffers = await Promise.all(cards.map(async (card) => {
      const [offers] = await db.query(
        `SELECT offer_description_at_unlock 
         FROM user_card_offers 
         WHERE loyalty_card_id = ? AND is_active = TRUE AND claimed_at IS NULL 
         ORDER BY unlocked_at DESC 
         LIMIT 1`, // Prendre la plus récente offre active non réclamée
        [card.id]
      );
      if (offers.length > 0) {
        return { ...card, has_active_offer: true, active_offer_description: offers[0].offer_description_at_unlock };
      }
      return { ...card, has_active_offer: false, active_offer_description: null };
    }));

    res.json(cardsWithOffers);
  } catch (error) {
    console.error("[UserRoutes GET /cards] Erreur de récupération des cartes utilisateur:", error);
    res.status(500).json({ message: 'Erreur serveur lors de la récupération des cartes.' });
  }
});

// Ajouter une nouvelle carte de fidélité
router.post('/cards', authenticateToken, async (req, res) => {
  console.log('[UserRoutes POST /cards] req.user reçu:', req.user); // Log de req.user
  if (!req.user || req.user.type !== 'user') {  // Ajout d'une vérification de l'existence de req.user
    console.warn('[UserRoutes POST /cards] Tentative d\'accès non autorisé ou type incorrect. req.user.type:', req.user ? req.user.type : 'undefined');
    return res.status(403).json({ message: "Accès non autorisé pour ce type d'utilisateur ou token invalide." });
  }
  const userId = req.user.id;
  const { merchant_id } = req.body; // L'ID du commerçant doit être fourni

  if (!merchant_id) {
    return res.status(400).json({ message: "L'ID du commerçant (merchant_id) est requis." });
  }

  try {
    // Vérifier si le commerçant existe
    const [merchants] = await db.query('SELECT id FROM merchants WHERE id = ?', [merchant_id]);
    if (merchants.length === 0) {
      return res.status(404).json({ message: "Commerçant non trouvé." });
    }

    // Vérifier si une carte existe déjà pour cet utilisateur et ce commerçant
    const [existingCards] = await db.query(
      'SELECT id FROM loyalty_cards WHERE user_id = ? AND merchant_id = ?',
      [userId, merchant_id]
    );
    if (existingCards.length > 0) {
      return res.status(409).json({ message: "Vous avez déjà une carte de fidélité chez ce commerçant." });
    }

    const cardIdentifier = `KARTA-${userId}-${merchant_id}-${uuidv4().substring(0, 8).toUpperCase()}`;

    const [result] = await db.query(
      'INSERT INTO loyalty_cards (user_id, merchant_id, card_identifier, points, stamps) VALUES (?, ?, ?, 0, 0)',
      [userId, merchant_id, cardIdentifier]
    );
    
    res.status(201).json({ 
        message: 'Carte de fidélité ajoutée avec succès.', 
        cardId: result.insertId,
        card_identifier: cardIdentifier,
        merchant_id: merchant_id
    });
  } catch (error) {
    console.error("[UserRoutes POST /cards] Erreur d'ajout de carte utilisateur:", error);
    if (error.code === 'ER_DUP_ENTRY') { // Gérer le cas où card_identifier ne serait pas unique, bien que peu probable avec uuid
        return res.status(500).json({ message: 'Erreur lors de la génération de l\'identifiant de carte, veuillez réessayer.' });
    }
    res.status(500).json({ message: 'Erreur serveur lors de l\'ajout de la carte.' });
  }
});

module.exports = router;
