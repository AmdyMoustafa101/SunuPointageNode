const express = require('express');
const router = express.Router();
const { getPresenceByDate } = require('../controllers/PresenceController');
const { getAbsencesAndDelays } = require('../controllers/PresenceController');
const { getWeeklyPresenceAndAbsence } = require('../controllers/PresenceController');
const { getMonthlyPresenceAndAbsence } = require('../controllers/PresenceController');

// Endpoint pour récupérer les présences
router.get('/api/presences', async (req, res) => {
  try {
    const { date, role } = req.query;

    // Validation des paramètres
    if (!date || !role) {
      return res.status(400).json({ error: 'Date et rôle sont requis.' });
    }

    // Récupération des présences via le service
    const presences = await getPresenceByDate(date, role);
    res.json(presences);
  } catch (error) {
    console.error('Erreur lors de la récupération des présences:', error);
    res.status(500).json({ error: 'Erreur interne du serveur.' });
  }
});

router.get('/api/absences-retards', async (req, res) => {
  try {
    const { date } = req.query;

    // Validation des paramètres
    if (!date) {
      return res.status(400).json({ error: 'La date est requise.' });
    }

    // Récupération des absences et retards via le service
    const { absences, retards } = await getAbsencesAndDelays(date);
    res.json({ absences, retards });
  } catch (error) {
    console.error('Erreur lors de la récupération des absences et retards:', error);
    res.status(500).json({ error: 'Erreur interne du serveur.' });
  }
});

// Endpoint pour récupérer les statistiques de la semaine
router.get('/api/statistiques-semaine', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Les dates de début et de fin sont requises.' });
    }

    const statsSemaine = await getWeeklyPresenceAndAbsence(startDate, endDate);
    res.json(statsSemaine);
  } catch (error) {
    console.error('Erreur lors de la récupération des statistiques de la semaine:', error);
    res.status(500).json({ error: 'Erreur interne du serveur.' });
  }
});

// Endpoint pour récupérer les statistiques du mois
router.get('/api/statistiques-mois', async (req, res) => {
  try {
    const { year, month } = req.query;

    if (!year || !month) {
      return res.status(400).json({ error: 'L\'année et le mois sont requis.' });
    }

    const statsMois = await getMonthlyPresenceAndAbsence(year, month);
    res.json(statsMois);
  } catch (error) {
    console.error('Erreur lors de la récupération des statistiques du mois:', error);
    res.status(500).json({ error: 'Erreur interne du serveur.' });
  }
});

module.exports = router;
