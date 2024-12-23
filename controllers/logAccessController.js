const mysql = require('mysql2/promise');
const LogAccess = require('../models/LogAccess');

// Configuration de la connexion MySQL
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'sunupointagelaravel',
};

// Fonction pour créer un log d'accès
const createLog = async ({ utilisateur_id, card_id, statut_acces }) => {
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

    const { nom, prenom, fonction } = rows[0];

    // Créer un log d'accès dans MongoDB
    const log = new LogAccess({
      utilisateur_id,
      card_id: card_id || null,
      statut_acces,
      nom,
      prenom,
      fonction,
    });

    await log.save(); // Sauvegarder le log dans MongoDB
    console.log('Log enregistré:', log);
    return log;
  } catch (error) {
    console.error('Erreur lors de l\'enregistrement du log:', error.message);
    throw error;
  } finally {
    await connection.end(); // Toujours fermer la connexion MySQL
  }
};

// Fonction pour récupérer les logs
const getLogs = async (req, res) => {
    try {
      const { date, search, page = 1, limit = 10 } = req.query;
  
      const filter = {};
  
      if (date) {
        const startOfDay = new Date(date);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);
        filter.timestamp = { $gte: startOfDay, $lte: endOfDay };
      }
  
      if (search) {
        filter.$or = [
          { nom: { $regex: search, $options: 'i' } },
          { prenom: { $regex: search, $options: 'i' } },
          { fonction: { $regex: search, $options: 'i' } },
        ];
      }
  
      // Convertir page et limit en nombres
      const pageNum = parseInt(page, 10);
      const limitNum = parseInt(limit, 10);
  
      const logs = await LogAccess.find(filter)
        .sort({ timestamp: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum);
  
      const totalLogs = await LogAccess.countDocuments(filter);
  
      res.status(200).json({
        logs,
        totalLogs,
        currentPage: pageNum,
        totalPages: Math.ceil(totalLogs / limitNum),
      });
    } catch (error) {
      console.error('Erreur lors de la récupération des logs:', error.message);
      res.status(500).json({ message: 'Erreur lors de la récupération des logs', error });
    }
  };

module.exports = { createLog, getLogs };
