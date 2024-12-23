const mongoose = require('mongoose');

const pointageSchema = new mongoose.Schema({
  utilisateur_id: { type: Number, required: true },
  nom: { type: String, required: true },
  prenom: { type: String, required: true },
  role: { type: String, required: true }, // 'apprenant' ou 'employe'
  date: { type: Date, default: Date.now },
  heure_arrive: { type: String },
  heure_depart: { type: String },
  vigile_matricule: { type: String, required: true },
  vigile_prenom: { type: String, required: true },
});

module.exports = mongoose.model('Pointage', pointageSchema);
