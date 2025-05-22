const express = require('express');
const router = express.Router();
const db = require('../models/db');
const { authenticateToken } = require('../middleware/authMiddleware');

// Obtenir le profil du commerce (pour le commerçant connecté)
router.get('/profile', authenticateToken, async (req, res) => {
  if (req.user.type !== 'merchant') {
    return res.status(403).json({ message: "Accès non autorisé." });
  }
  const merchantId = req.user.id;

  try {
    const [merchants] = await db.query(
      'SELECT id, name, email, logo_url, loyalty_program_type, default_points_per_scan, offer_is_active, offer_trigger_points, offer_description FROM merchants WHERE id = ?',
      [merchantId]
    );
    if (merchants.length === 0) {
      return res.status(404).json({ message: "Profil commerçant non trouvé." });
    }
    res.json(merchants[0]);
  } catch (error) {
    console.error("Erreur de récupération du profil commerçant:", error);
    res.status(500).json({ message: "Erreur serveur." });
  }
});

// Gérer le profil du commerce
router.put('/profile', authenticateToken, async (req, res) => {
  if (req.user.type !== 'merchant') {
    return res.status(403).json({ message: "Accès non autorisé." });
  }
  const merchantId = req.user.id;
  const { name, logo_url, loyalty_program_type, default_points_per_scan, offer_is_active, offer_trigger_points, offer_description } = req.body;

  console.log('[DEBUG PUT /merchants/profile] req.body reçu:', req.body);

  const noDataToUpdate = 
    name === undefined &&
    logo_url === undefined &&
    loyalty_program_type === undefined &&
    default_points_per_scan === undefined &&
    offer_is_active === undefined &&
    offer_trigger_points === undefined &&
    offer_description === undefined;

  if (noDataToUpdate) {
    console.log('[DEBUG PUT /merchants/profile] Aucune donnée pertinente à mettre à jour détectée.');
    return res.status(400).json({ message: "Aucune donnée à mettre à jour." });
  }

  let queryFields = [];
  let queryParams = [];

  if (name !== undefined) {
    queryFields.push('name = ?');
    queryParams.push(name);
  }
  if (logo_url !== undefined) {
    queryFields.push('logo_url = ?');
    queryParams.push(logo_url);
  }
  if (loyalty_program_type !== undefined) {
    queryFields.push('loyalty_program_type = ?');
    queryParams.push(loyalty_program_type);
  }
  if (default_points_per_scan !== undefined) {
    queryFields.push('default_points_per_scan = ?');
    queryParams.push(parseInt(default_points_per_scan) || 1);
  }
  if (offer_is_active !== undefined) {
    queryFields.push('offer_is_active = ?');
    queryParams.push(Boolean(offer_is_active));
  }
  if (offer_trigger_points !== undefined) {
    queryFields.push('offer_trigger_points = ?');
    const parsedPoints = parseInt(offer_trigger_points);
    queryParams.push((offer_trigger_points === null || offer_trigger_points === '' || isNaN(parsedPoints) || parsedPoints <= 0) ? null : parsedPoints);
  }
  if (offer_description !== undefined) {
    queryFields.push('offer_description = ?');
    queryParams.push((offer_description === null || offer_description === '') ? null : offer_description);
  }

  if (queryFields.length === 0) {
    console.log('[DEBUG PUT /merchants/profile] queryFields est vide, aucune mise à jour SQL à effectuer.');
    return res.status(200).json({ message: "Aucun champ modifiable fourni ou valeurs inchangées." });
  }
  
  queryParams.push(merchantId);

  const queryString = `UPDATE merchants SET ${queryFields.join(', ')} WHERE id = ?`;

  console.log('[DEBUG PUT /merchants/profile] Requête SQL construite:', queryString);
  console.log('[DEBUG PUT /merchants/profile] Paramètres SQL:', queryParams);

  try {
    const [result] = await db.query(queryString, queryParams);

    if (result.affectedRows === 0) {
      console.log('[DEBUG PUT /merchants/profile] Aucun enregistrement affecté. Commerçant non trouvé ? ID:', merchantId);
      return res.status(404).json({ message: "Commerçant non trouvé ou aucune donnée modifiée." });
    }
    
    console.log('[DEBUG PUT /merchants/profile] Profil mis à jour avec succès pour le commerçant ID:', merchantId);
    res.json({ message: 'Profil mis à jour avec succès.' });
  } catch (error) {
    console.error("[DEBUG PUT /merchants/profile] Erreur lors de la mise à jour du profil commerçant:", error);
    res.status(500).json({ message: 'Erreur serveur lors de la mise à jour du profil.' });
  }
});

// Ajouter des points/tampons à une carte client
router.post('/scan', authenticateToken, async (req, res) => {
  if (req.user.type !== 'merchant') {
    return res.status(403).json({ message: "Accès non autorisé." });
  }
  const merchantId = req.user.id; // L'ID du commerçant vient du token
  const { card_identifier, points_added, stamps_added, transaction_type } = req.body;

  if (!card_identifier) {
    return res.status(400).json({ message: "L'identifiant de la carte client est requis." });
  }
  if ((points_added === undefined || points_added === null) && (stamps_added === undefined || stamps_added === null)) {
    return res.status(400).json({ message: "Veuillez spécifier les points ou tampons à ajouter." });
  }

  const points = parseInt(points_added) || 0;
  const stamps = parseInt(stamps_added) || 0;

  if (points < 0 || stamps < 0) {
      return res.status(400).json({ message: "Les points et tampons ne peuvent pas être négatifs."});
  }

  const connection = await db.getConnection(); // Utiliser une transaction

  try {
    await connection.beginTransaction();

    const [cards] = await connection.query(
      'SELECT id, merchant_id, points, stamps FROM loyalty_cards WHERE card_identifier = ?',
      [card_identifier]
    );

    if (cards.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Carte client non trouvée.' });
    }
    const card = cards[0];

    // Vérifier si la carte appartient bien à ce commerçant (important!)
    if (card.merchant_id !== merchantId) {
      await connection.rollback();
      return res.status(403).json({ message: 'Cette carte n\'appartient pas à votre commerce.' });
    }

    const newPoints = (card.points || 0) + (parseInt(points_added) || 0);
    const newStamps = (card.stamps || 0) + (parseInt(stamps_added) || 0);

    await connection.query(
      'UPDATE loyalty_cards SET points = ?, stamps = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newPoints, newStamps, card.id]
    );

    await connection.query(
      'INSERT INTO transactions (loyalty_card_id, merchant_id, points_added, stamps_added, transaction_type) VALUES (?, ?, ?, ?, ?)',
      [card.id, merchantId, points, stamps, transaction_type || (points > 0 ? 'earn_points' : 'earn_stamps')]
    );

    // Logique de déblocage d'offre (avec cumul)
    const [merchants] = await connection.query(
        'SELECT offer_is_active, offer_trigger_points, offer_description FROM merchants WHERE id = ?',
        [merchantId]
    );
    const merchantOfferSettings = merchants[0];
    let newOfferUnlockedThisScan = false;

    if (merchantOfferSettings && merchantOfferSettings.offer_is_active && merchantOfferSettings.offer_trigger_points && merchantOfferSettings.offer_trigger_points > 0 && merchantOfferSettings.offer_description) {
        const triggerPoints = merchantOfferSettings.offer_trigger_points;
        
        // Calculer combien de paliers d'offres ont été franchis
        // card.points sont les points *avant* l'ajout actuel
        const previousPointLevel = Math.floor(card.points / triggerPoints);
        const currentPointLevel = Math.floor(newPoints / triggerPoints);

        if (currentPointLevel > previousPointLevel) {
            // Un ou plusieurs nouveaux paliers ont été atteints
            for (let level = previousPointLevel + 1; level <= currentPointLevel; level++) {
                const pointsForThisOfferUnlock = level * triggerPoints; // Le palier exact
                // Vérifier si une offre pour ce palier exact n'a pas déjà été donnée
                // (utile si, par exemple, des points ont été retirés puis rajoutés, re-franchissant un palier)
                const [existingOffersForLevel] = await connection.query(
                    'SELECT id FROM user_card_offers WHERE loyalty_card_id = ? AND points_at_unlock = ?',
                    [card.id, pointsForThisOfferUnlock]
                );

                if (existingOffersForLevel.length === 0) {
                    await connection.query(
                        'INSERT INTO user_card_offers (loyalty_card_id, merchant_id, offer_description_at_unlock, points_at_unlock, is_active) VALUES (?, ?, ?, ?, TRUE)',
                        [card.id, merchantId, merchantOfferSettings.offer_description, pointsForThisOfferUnlock]
                    );
                    newOfferUnlockedThisScan = true; 
                    console.log(`Nouvelle offre (cumul) débloquée pour la carte ${card.id} au palier de ${pointsForThisOfferUnlock} points.`);
                }
            }
        }
    }

    // Vérifier s'il y a des offres actives non réclamées pour cette carte
    // On propose toujours la plus ancienne pour la réclamation
    const [activeUnclaimedOffers] = await connection.query(
        `SELECT id, offer_description_at_unlock 
         FROM user_card_offers 
         WHERE loyalty_card_id = ? AND is_active = TRUE AND claimed_at IS NULL 
         ORDER BY unlocked_at ASC LIMIT 1`, // Proposer la plus ancienne offre non réclamée
        [card.id]
    );

    await connection.commit();

    let availableOfferToClaim = null;
    if (activeUnclaimedOffers.length > 0) {
        availableOfferToClaim = {
            user_card_offer_id: activeUnclaimedOffers[0].id, // ID de l'entrée dans user_card_offers
            description: activeUnclaimedOffers[0].offer_description_at_unlock,
            loyalty_card_id: card.id // ID de la carte de fidélité
        };
    }
    
    res.json({
      message: 'Points/tampons ajoutés avec succès.',
      updatedCard: {
        card_identifier: card_identifier,
        points: newPoints,
        stamps: newStamps
      },
      available_offer_to_claim: availableOfferToClaim, // Envoyer l'info de l'offre au frontend
      new_offer_just_unlocked: newOfferUnlockedThisScan // Info si une offre a été débloquée PENDANT ce scan
    });

  } catch (error) {
    await connection.rollback();
    console.error("Erreur d'ajout de points/tampons:", error);
    res.status(500).json({ message: 'Erreur serveur lors de l\'ajout des points/tampons.' });
  } finally {
    connection.release();
  }
});

// Nouvelle route pour réclamer une offre
router.post('/offers/claim', authenticateToken, async (req, res) => {
    if (req.user.type !== 'merchant') {
        return res.status(403).json({ message: "Accès non autorisé." });
    }
    const merchantId = req.user.id; // Commerçant qui effectue l'action
    const { user_card_offer_id, loyalty_card_id } = req.body;

    if (!user_card_offer_id || !loyalty_card_id) {
        return res.status(400).json({ message: "Les identifiants user_card_offer_id et loyalty_card_id sont requis." });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Vérifier que l'offre appartient bien au commerçant (indirectement via la carte) et est active
        const [offers] = await connection.query(
            `SELECT uco.id, uco.loyalty_card_id, uco.claimed_at, uco.is_active, lc.merchant_id, lc.points as current_card_points
             FROM user_card_offers uco
             JOIN loyalty_cards lc ON uco.loyalty_card_id = lc.id
             WHERE uco.id = ? AND lc.id = ? AND lc.merchant_id = ?`,
            [user_card_offer_id, loyalty_card_id, merchantId]
        );

        if (offers.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: "Offre non trouvée, n'appartient pas à ce commerçant ou carte invalide." });
        }
        const offerToClaim = offers[0];

        if (offerToClaim.claimed_at !== null || !offerToClaim.is_active) {
            await connection.rollback();
            return res.status(400).json({ message: "Cette offre a déjà été réclamée ou n'est plus active." });
        }

        // 2. Récupérer les offer_trigger_points du commerçant pour savoir combien de points soustraire
        const [merchantSettings] = await connection.query(
            'SELECT offer_trigger_points FROM merchants WHERE id = ?',
            [merchantId]
        );
        if (merchantSettings.length === 0 || !merchantSettings[0].offer_trigger_points) {
            await connection.rollback();
            return res.status(500).json({ message: "Configuration des points de déclenchement de l'offre manquante pour le commerçant." });
        }
        const pointsToDeduct = merchantSettings[0].offer_trigger_points;

        // 3. Marquer l'offre comme réclamée
        await connection.query(
            'UPDATE user_card_offers SET claimed_at = CURRENT_TIMESTAMP, is_active = FALSE WHERE id = ?',
            [user_card_offer_id]
        );

        // 4. Soustraire les points de la carte de fidélité
        const newCardPoints = Math.max(0, offerToClaim.current_card_points - pointsToDeduct); // S'assurer que les points ne deviennent pas négatifs
        await connection.query(
            'UPDATE loyalty_cards SET points = ? WHERE id = ?',
            [newCardPoints, loyalty_card_id]
        );

        await connection.commit();
        res.json({ 
            message: "Offre réclamée avec succès.",
            updated_card_points: newCardPoints
        });

    } catch (error) {
        await connection.rollback();
        console.error("Erreur lors de la réclamation de l'offre:", error);
        res.status(500).json({ message: "Erreur serveur lors de la réclamation de l'offre." });
    } finally {
        if (connection) connection.release();
    }
});

// Nouvelle route pour rechercher des clients/cartes par le commerçant
router.get('/clients/search', authenticateToken, async (req, res) => {
    if (req.user.type !== 'merchant') {
        return res.status(403).json({ message: "Accès non autorisé." });
    }
    const merchantId = req.user.id;
    const { searchTerm } = req.query;

    if (!searchTerm || searchTerm.trim() === '') {
        return res.status(400).json({ message: "Le terme de recherche est requis." });
    }

    try {
        // Recherche dans les noms d'utilisateurs, emails, ou identifiants de carte
        // On joint loyalty_cards avec users pour avoir les infos de l'utilisateur
        const [results] = await db.query(
            `SELECT 
                u.id as user_id, u.name as user_name, u.email as user_email, 
                lc.id as loyalty_card_id, lc.card_identifier, lc.points, lc.stamps
             FROM loyalty_cards lc
             JOIN users u ON lc.user_id = u.id
             WHERE lc.merchant_id = ? AND 
                   (u.name LIKE ? OR u.email LIKE ? OR lc.card_identifier LIKE ?)
             LIMIT 10`, // Limiter le nombre de résultats
            [merchantId, `%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`]
        );
        res.json(results);
    } catch (error) {
        console.error("Erreur lors de la recherche de clients:", error);
        res.status(500).json({ message: "Erreur serveur lors de la recherche de clients." });
    }
});

// Nouvelle route pour mettre à jour les points d'une carte client spécifique
router.put('/clients/cards/:card_id/points', authenticateToken, async (req, res) => {
    if (req.user.type !== 'merchant') {
        return res.status(403).json({ message: "Accès non autorisé." });
    }
    const merchantId = req.user.id;
    const { card_id } = req.params; // ID de la carte de fidélité (lc.id)
    const { points } = req.body;

    if (points === undefined || isNaN(parseInt(points)) || parseInt(points) < 0) {
        return res.status(400).json({ message: "Nombre de points invalide." });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // Vérifier que la carte appartient bien à ce commerçant
        const [cards] = await connection.query(
            'SELECT id, points FROM loyalty_cards WHERE id = ? AND merchant_id = ?',
            [card_id, merchantId]
        );

        if (cards.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: "Carte de fidélité non trouvée pour ce commerçant." });
        }
        
        const card = cards[0];
        const oldPoints = card.points;
        const newPoints = parseInt(points);

        await connection.query(
            'UPDATE loyalty_cards SET points = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [newPoints, card_id]
        );
        
        // Logique de déblocage d'offre (similaire à /scan, mais sans ajout, juste basé sur le nouveau total)
        // On pourrait la factoriser dans une fonction utilitaire plus tard
        const [merchants] = await connection.query(
            'SELECT offer_is_active, offer_trigger_points, offer_description FROM merchants WHERE id = ?',
            [merchantId]
        );
        const merchantOfferSettings = merchants[0];

        if (merchantOfferSettings && merchantOfferSettings.offer_is_active && merchantOfferSettings.offer_trigger_points && merchantOfferSettings.offer_trigger_points > 0 && merchantOfferSettings.offer_description) {
            const triggerPoints = merchantOfferSettings.offer_trigger_points;
            
            const previousPointLevel = Math.floor(oldPoints / triggerPoints);
            const currentPointLevel = Math.floor(newPoints / triggerPoints);

            if (currentPointLevel > previousPointLevel) {
                for (let level = previousPointLevel + 1; level <= currentPointLevel; level++) {
                    const pointsForThisOfferUnlock = level * triggerPoints;
                    const [existingOffersForLevel] = await connection.query(
                        'SELECT id FROM user_card_offers WHERE loyalty_card_id = ? AND points_at_unlock = ?',
                        [card_id, pointsForThisOfferUnlock]
                    );
                    if (existingOffersForLevel.length === 0) {
                        await connection.query(
                            'INSERT INTO user_card_offers (loyalty_card_id, merchant_id, offer_description_at_unlock, points_at_unlock, is_active) VALUES (?, ?, ?, ?, TRUE)',
                            [card_id, merchantId, merchantOfferSettings.offer_description, pointsForThisOfferUnlock]
                        );
                    }
                }
            }
            // TODO: Gérer le cas où les points sont réduits et une offre devrait être invalidée (plus complexe, pour une V2)
        }


        await connection.commit();
        res.json({ message: "Points mis à jour avec succès.", updated_points: newPoints });

    } catch (error) {
        await connection.rollback();
        console.error("Erreur lors de la mise à jour des points du client:", error);
        res.status(500).json({ message: "Erreur serveur lors de la mise à jour des points." });
    } finally {
        if (connection) connection.release();
    }
});

// Voir les clients actifs et statistiques
router.get('/stats', authenticateToken, async (req, res) => {
  if (req.user.type !== 'merchant') {
    return res.status(403).json({ message: "Accès non autorisé." });
  }
  const merchantId = req.user.id;

  try {
    // Nombre de cartes de fidélité actives pour ce commerçant
    const [activeClientsResult] = await db.query(
      'SELECT COUNT(DISTINCT user_id) as activeClientsCount FROM loyalty_cards WHERE merchant_id = ?',
      [merchantId]
    );
    const activeClientsCount = activeClientsResult[0].activeClientsCount;

    // Nombre total de transactions pour ce commerçant
    const [totalTransactionsResult] = await db.query(
      'SELECT COUNT(id) as totalTransactionsCount FROM transactions WHERE merchant_id = ?',
      [merchantId]
    );
    const totalTransactionsCount = totalTransactionsResult[0].totalTransactionsCount;

    res.json({
      merchantId: merchantId,
      activeClientsCount: activeClientsCount,
      totalTransactionsCount: totalTransactionsCount
      // D'autres statistiques peuvent être ajoutées ici
    });
  } catch (error) {
    console.error("Erreur de récupération des statistiques commerçant:", error);
    res.status(500).json({ message: 'Erreur serveur lors de la récupération des statistiques.' });
  }
});

// Route pour permettre à un commerçant de rechercher des commerçants (utile pour l'utilisateur ajoutant une carte)
// Bien que cela soit dans merchantRoutes, c'est une information publique.
// Ou cela pourrait être une route non protégée ailleurs.
router.get('/search', async (req, res) => {
    const { name } = req.query;
    if (!name) {
        return res.status(400).json({ message: "Le paramètre 'name' est requis pour la recherche." });
    }
    try {
        const [merchants] = await db.query(
            "SELECT id, name, logo_url, loyalty_program_type FROM merchants WHERE name LIKE ?", 
            [`%${name}%`]
        );
        res.json(merchants);
    } catch (error) {
        console.error("Erreur de recherche de commerçants:", error);
        res.status(500).json({ message: "Erreur serveur lors de la recherche." });
    }
});

// Nouvelle route pour récupérer les offres d'une carte client spécifique par le commerçant
router.get('/clients/cards/:loyalty_card_id/offers', authenticateToken, async (req, res) => {
    if (req.user.type !== 'merchant') {
        return res.status(403).json({ message: "Accès non autorisé." });
    }
    const merchantId = req.user.id;
    const { loyalty_card_id } = req.params;

    if (!loyalty_card_id) {
        return res.status(400).json({ message: "L'identifiant de la carte de fidélité est requis." });
    }

    try {
        // Vérifier d'abord que la carte appartient bien à un client de ce commerçant
        const [cards] = await db.query(
            'SELECT id FROM loyalty_cards WHERE id = ? AND merchant_id = ?',
            [loyalty_card_id, merchantId]
        );

        if (cards.length === 0) {
            return res.status(404).json({ message: "Carte de fidélité non trouvée pour ce commerçant." });
        }

        // Récupérer les offres pour cette carte
        const [offers] = await db.query(
            `SELECT id, loyalty_card_id, offer_description_at_unlock, points_at_unlock, unlocked_at, claimed_at, is_active 
             FROM user_card_offers 
             WHERE loyalty_card_id = ? 
             ORDER BY unlocked_at DESC`,
            [loyalty_card_id]
        );
        
        res.json(offers);

    } catch (error) {
        console.error(`Erreur lors de la récupération des offres pour la carte ${loyalty_card_id}:`, error);
        res.status(500).json({ message: "Erreur serveur lors de la récupération des offres." });
    }
});

module.exports = router;
