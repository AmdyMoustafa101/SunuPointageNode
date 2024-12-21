const mysql = require('mysql2/promise');
const LogAccess = require('../models/LogAccess');

// Configuration de la connexion MySQL
const dbConfig = {
  host: 'localhost',
  user: 'root',      // Remplacez par vos informations de connexion
  password: '',      // Remplacez par vos informations de connexion
  database: 'sunupointagelaravel', // Nom de votre base de données MySQL
};

// Fonction pour créer un log d'accès
const createLog = async ({ utilisateur_id, card_id, statut_acces }) => {
  // Connexion à MySQL
  const connection = await mysql.createConnection(dbConfig);

  try {
    // Récupérer les informations de l'employé depuis MySQL
    const [rows] = await connection.execute(
      'SELECT nom, prenom, fonction FROM employes WHERE id = ?',
      [utilisateur_id]
    );

    if (rows.length === 0) {
      throw new Error('Employé non trouvé');
    }

    const { nom, prenom, fonction } = rows[0]; // Récupérer nom et prénom

    // Créer un log d'accès dans MongoDB
    const log = new LogAccess({
      utilisateur_id,
      card_id: card_id || null, // Si card_id est fourni, l'utiliser
      statut_acces,
      nom,
      prenom,
      fonction
    });

    await log.save(); // Sauvegarder le log dans MongoDB
    console.log('Log enregistré:', log);
    return log;
  } catch (error) {
    console.error('Erreur lors de l\'enregistrement du log:', error);
    throw error;
  } finally {
    connection.end(); // Toujours fermer la connexion MySQL
  }
};

module.exports = { createLog };
