const express = require('express');
const router = express.Router();
const { getPresenceByDate } = require('../controllers/PresenceController');

// Endpoint pour récupérer les présences
router.get('/api/presences', async (req, res) => {
  try {
    const { date, role } = req.query;

    // Validation des paramètres
    if (!date || !role) {
      return res.status(400).json({ error: 'Date et rôle sont requis.' });
    }

    // Récupération des présences via le service
    const presences = await getPresenceByDate(date, role);
    res.json(presences);
  } catch (error) {
    console.error('Erreur lors de la récupération des présences:', error);
    res.status(500).json({ error: 'Erreur interne du serveur.' });
  }
});

module.exports = router;
