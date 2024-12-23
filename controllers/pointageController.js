const Pointage = require('../models/pointage');

// Enregistrer un pointage
exports.enregistrerPointage = async (req, res) => {
  const { utilisateur_id, nom, prenom, role, type, vigile_matricule, vigile_prenom } = req.body;

  try {
    const heure = new Date().toLocaleTimeString();

    const pointageData = {
      utilisateur_id,
      nom,
      prenom,
      role,
      date: new Date(),
      vigile_matricule,
      vigile_prenom,
    };

    if (type === 'arrivee') {
      pointageData.heure_arrive = heure;
    } else if (type === 'depart') {
      pointageData.heure_depart = heure;
    } else {
      return res.status(400).json({ message: 'Type invalide' });
    }

    const pointage = new Pointage(pointageData);
    await pointage.save();

    res.status(201).json({ message: 'Pointage enregistré avec succès', pointage });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error });
  }
};
