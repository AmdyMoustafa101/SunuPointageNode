const mongoose = require('mongoose');

const HistoriqueActionSchema = new mongoose.Schema({
  action: { type: String, required: true },
  utilisateur_id: { type: Number, required: true },
  cible_id: { type: Number, default: null }, // Peut être null
  cible_type: { type: String, default: null },
  date_action: { type: Date, default: Date.now },
});

module.exports = mongoose.model('HistoriqueAction', HistoriqueActionSchema);