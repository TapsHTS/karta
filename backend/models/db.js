const mysql = require('mysql2/promise');

// Configuration de la connexion à la base de données
// Remplacez par vos propres informations d'identification
const dbConfig = {
  host: process.env.DB_HOST || '88.198.32.216',
  user: process.env.DB_USER || 'u9219_7zhm9I8HKc',
  password: process.env.DB_PASSWORD || 'ZN8i6jrNeOvv09M27fg7gHGf',
  database: process.env.DB_NAME || 's9219_karta'
};

// Créer un pool de connexions
const pool = mysql.createPool(dbConfig);

// Tester la connexion
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('Connecté à la base de données MySQL avec succès!');
    connection.release();
  } catch (error) {
    console.error('Erreur de connexion à la base de données MySQL:', error);
    // Quitter l'application si la connexion échoue au démarrage
    process.exit(1); 
  }
}

testConnection();

module.exports = pool;
