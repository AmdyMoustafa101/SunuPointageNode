const express = require('express');
const router = express.Router();
const HistoriqueAction = require('../models/HistoriquesActions');

// Route pour enregistrer une action
router.post('/historique', async (req, res) => {
  try {
    const { action, utilisateur_id, cible_id, cible_type } = req.body;

    // Validation des champs obligatoires
    if (!action || !utilisateur_id) {
      return res.status(400).json({ message: 'Action et utilisateur_id sont requis.' });
    }

    // Création de l'entrée dans la collection
    const historique = new HistoriqueAction({
      action,
      utilisateur_id,
      cible_id: cible_id || null, // Peut être null
      cible_type: cible_type || null, // Peut être null
      date_action: new Date(), // Date actuelle
    });

    await historique.save();

    return res.status(201).json({ message: 'Action enregistrée avec succès.', historique });
  } catch (error) {
    console.error('Erreur lors de l’enregistrement de l’action :', error);
    return res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});

module.exports = router;