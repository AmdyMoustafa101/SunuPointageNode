const mongoose = require('mongoose');

const logAccessSchema = new mongoose.Schema({
  utilisateur_id: { type: Number, required: true }, // ID de l'employé depuis MySQL
  card_id: { type: String, default: null },         // Peut être NULL
  statut_acces: { type: String, enum: ['login', 'logout'], required: true },
  timestamp: { type: Date, default: Date.now },
  nom: { type: String, required: true },             // Nom de l'utilisateur
  prenom: { type: String, required: true },          // Prénom de l'utilisateur
  fonction: { type: String, required: true },          // Fonction de l'utilisateur
});

module.exports = mongoose.model('LogAccess', logAccessSchema);
