const mongoose = require('mongoose');

const pointageSchema = new mongoose.Schema({
    nom: { type: String, required: true },
    prenom: { type: String, required: true },
    // matricule: { type: String, required: true },
    role: { type: String, required: true },
    date: { type: Date, required: true },
    heure_arrivee: { type: Date },
    heure_depart: { type: Date },
    vigile_nom: { type: String, required: true },
    vigile_matricule: { type: String, required: true },
});

module.exports = mongoose.model('Pointage', pointageSchema);
