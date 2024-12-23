const jwt = require('jsonwebtoken');
const Employe = require('../models/Employe'); // Modèle employé MySQL

const authMiddleware = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1]; // Récupérer le token Bearer
  if (!token) {
    return res.status(401).json({ message: 'Token manquant' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET); // Décoder le token avec votre clé secrète
    const employe = await Employe.findByPk(decoded.id); // Recherche dans MySQL via l'ID

    if (!employe || employe.role !== 'vigile') {
      return res.status(403).json({ message: 'Accès non autorisé' });
    }

    req.user = {
      matricule: employe.matricule,
      prenom: employe.prenom,
      id: employe.id,
    };
    next();
  } catch (error) {
    res.status(401).json({ message: 'Token invalide' });
  }
};

module.exports = authMiddleware;
