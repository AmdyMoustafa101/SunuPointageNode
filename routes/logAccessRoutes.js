const express = require('express');
const { createLog } = require('../controllers/logAccessController');
const router = express.Router();

// Endpoint pour enregistrer un log d'accès
router.post('/log-access', async (req, res) => {
  try {
    const { utilisateur_id, card_id, statut_acces } = req.body;

    // Validation basique des champs requis
    if (!utilisateur_id || !statut_acces) {
      return res.status(400).json({ message: 'Champs requis manquants' });
    }

    const log = await createLog({ utilisateur_id, card_id, statut_acces });
    res.status(201).json({ message: 'Log créé avec succès', log });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la création du log', error });
  }
});

module.exports = router;