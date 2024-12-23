const express = require('express');
const router = express.Router();
const mongoose = require('mongoose'); 
const Pointage = require('../models/pointage'); // Assurez-vous que le modèle est bien importé
const jwt = require('jsonwebtoken');


// Route pour enregistrer un pointage
router.post('/pointages', async (req, res) => {
    const { nom, prenom, role, date, heure_arrivee, heure_depart, vigile_nom, vigile_matricule } = req.body;

    // Validation des données
    if (!nom || !prenom || !role || !date || !vigile_nom || !vigile_matricule) {
        return res.status(400).json({ message: 'Les champs requis sont manquants' });
    }

    try {
        // Créer un nouveau pointage
        const pointage = new Pointage({
            nom,
            prenom,
            
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





module.exports = router;
