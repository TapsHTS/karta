const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../models/db');

// Assurez-vous de définir JWT_SECRET dans vos variables d'environnement
const JWT_SECRET = process.env.JWT_SECRET || 'XeJVCBxHU2qa3YAd4rbNhk6gnjs8WRzTtypFuZcQPfDMS5mv@E';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';

// Inscription utilisateur
router.post('/register/user', async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Veuillez fournir nom, email et mot de passe.' });
  }

  try {
    const [existingUsers] = await db.query('SELECT email FROM users WHERE email = ?', [email]);
    if (existingUsers.length > 0) {
      return res.status(409).json({ message: 'Cet email est déjà utilisé.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await db.query('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)', [name, email, hashedPassword]);
    
    res.status(201).json({ message: 'Utilisateur créé avec succès.', userId: result.insertId });
  } catch (error) {
    console.error("Erreur d'inscription utilisateur:", error);
    res.status(500).json({ message: 'Erreur serveur lors de l\'inscription.' });
  }
});

// Connexion utilisateur
router.post('/login/user', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Veuillez fournir email et mot de passe.' });
  }

  try {
    const [users] = await db.query('SELECT id, name, email, password_hash FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      return res.status(401).json({ message: 'Email ou mot de passe incorrect.' });
    }

    const user = users[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Email ou mot de passe incorrect.' });
    }

    const token = jwt.sign({ id: user.id, type: 'user', name: user.name }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    res.json({ token, userId: user.id, name: user.name, email: user.email });

  } catch (error) {
    console.error("Erreur de connexion utilisateur:", error);
    res.status(500).json({ message: 'Erreur serveur lors de la connexion.' });
  }
});

// Inscription commerçant
router.post('/register/merchant', async (req, res) => {
  const { name, email, password, loyalty_program_type } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Veuillez fournir nom du commerce, email et mot de passe.' });
  }

  try {
    const [existingMerchants] = await db.query('SELECT email FROM merchants WHERE email = ?', [email]);
    if (existingMerchants.length > 0) {
      return res.status(409).json({ message: 'Cet email est déjà utilisé pour un commerce.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      'INSERT INTO merchants (name, email, password_hash, loyalty_program_type) VALUES (?, ?, ?, ?)',
      [name, email, hashedPassword, loyalty_program_type || 'points']
    );
    
    res.status(201).json({ message: 'Commerce créé avec succès.', merchantId: result.insertId });
  } catch (error) {
    console.error("Erreur d'inscription commerçant:", error);
    res.status(500).json({ message: 'Erreur serveur lors de l\'inscription du commerce.' });
  }
});

// Connexion commerçant
router.post('/login/merchant', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Veuillez fournir email et mot de passe.' });
  }

  try {
    const [merchants] = await db.query('SELECT id, name, email, password_hash, logo_url, loyalty_program_type FROM merchants WHERE email = ?', [email]);
    if (merchants.length === 0) {
      return res.status(401).json({ message: 'Email ou mot de passe incorrect.' });
    }

    const merchant = merchants[0];
    const isMatch = await bcrypt.compare(password, merchant.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Email ou mot de passe incorrect.' });
    }

    const token = jwt.sign({ id: merchant.id, type: 'merchant', name: merchant.name }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    res.json({ 
        token, 
        merchantId: merchant.id, 
        name: merchant.name, 
        email: merchant.email,
        logoUrl: merchant.logo_url,
        loyaltyProgramType: merchant.loyalty_program_type
    });

  } catch (error) {
    console.error("Erreur de connexion commerçant:", error);
    res.status(500).json({ message: 'Erreur serveur lors de la connexion du commerce.' });
  }
});

module.exports = router;
