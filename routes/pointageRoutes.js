const express = require('express');
const router = express.Router();
const mongoose = require('mongoose'); 
const Pointage = require('../models/pointage'); // Assurez-vous que le modèle est bien importé
const jwt = require('jsonwebtoken');


// Route pour enregistrer un pointage
router.post('/pointages', async (req, res) => {
    const { userID, nom, prenom, matricule, telephone, role, date, heure_arrivee, heure_depart, vigile_nom, vigile_matricule } = req.body;

    // Validation des données
    if (!userID || !nom || !prenom || !role || !date || !vigile_nom || !vigile_matricule) {
        return res.status(400).json({ message: 'Les champs requis sont manquants' });
    }

    try {
        // Créer un nouveau pointage
        const pointage = new Pointage({
            userID,
            nom,
            prenom,
            matricule,
            telephone,
            role,
            date,
            heure_arrivee,
            heure_depart,
            vigile_nom,
            vigile_matricule,
        });

        // Sauvegarder dans la base de données
        const savedPointage = await pointage.save();
        res.status(201).json(savedPointage);
    } catch (error) {
        res.status(500).json({ message: "Erreur lors de l'enregistrement du pointage", error: error.message });
    }
});

router.get('/pointages', async (req, res) => {
    const { date } = req.query;
  
    try {
      const pointages = await Pointage.find({ date: new Date(date).toISOString().split('T')[0] });
      res.status(200).json(pointages);
    } catch (error) {
      res.status(500).json({ message: "Erreur lors de la récupération des pointages", error: error.message });
    }
  });





module.exports = router;
