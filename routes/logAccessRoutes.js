const express = require('express');
const { createLog, getLogs } = require('../controllers/logAccessController');
const router = express.Router();

// Route pour créer un log
router.post('/log-access', async (req, res) => {
  try {
    const { utilisateur_id, card_id, statut_acces } = req.body;

    if (!utilisateur_id || !statut_acces) {
      return res.status(400).json({ message: 'Champs requis manquants' });
    }

    const log = await createLog({ utilisateur_id, card_id, statut_acces });
    res.status(201).json({ message: 'Log créé avec succès', log });
  } catch (error) {
    console.error('Erreur lors de la création du log:', error.message);
    res.status(500).json({ message: 'Erreur lors de la création du log', error });
  }
});

// Route pour récupérer les logs
router.get('/logs', getLogs);

module.exports = router;
