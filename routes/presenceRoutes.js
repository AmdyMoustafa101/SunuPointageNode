const express = require('express');
const router = express.Router();
const { getPresenceByDate, getYearlyPresenceAndAbsence } = require('../controllers/PresenceController');
const { getAbsencesAndDelays } = require('../controllers/PresenceController');
const { getWeeklyPresenceAndAbsence } = require('../controllers/PresenceController');
const { getPresenceByDepartement, getWeeklyPresenceByDepartement } = require('../controllers/PresenceController');

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

router.get('/api/presences/departement', async (req, res) => {
  try {
    const { date, departementId } = req.query;

    // Validation des paramètres
    if (!date || !departementId) {
      return res.status(400).json({ error: 'Date et identifiant du département sont requis.' });
    }

    // Récupération des présences via le service
    const presences = await getPresenceByDepartement(date, departementId);
    res.json(presences);
  } catch (error) {
    console.error('Erreur lors de la récupération des présences par département:', error);
    res.status(500).json({ error: 'Erreur interne du serveur.' });
  }
});

router.get('/api/presences/cohorte', async (req, res) => {
  try {
    const { date, cohorteId } = req.query;

    // Validation des paramètres
    if (!date || !cohorteId) {
      return res.status(400).json({ error: 'Date et identifiant de la cohorte sont requis.' });
    }

    // Récupération des présences via le service
    const presences = await getPresenceByCohorte(date, cohorteId);
    res.json(presences);
  } catch (error) {
    console.error('Erreur lors de la récupération des présences par cohorte:', error);
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

router.get('/api/weekly-presences/cohorte', async (req, res) => {
  try {
    const { dateRangeStart, dateRangeEnd, cohorteId } = req.query;

    // Validation des paramètres
    if (!dateRangeStart || !dateRangeEnd || !cohorteId) {
      return res.status(400).json({ error: 'Les paramètres dateRangeStart, dateRangeEnd et cohorteId sont requis.' });
    }

    // Récupération des présences hebdomadaires pour la cohorte
    const presences = await getWeeklyPresenceByCohorte(dateRangeStart, dateRangeEnd, parseInt(cohorteId, 10));

    res.json({ success: true, data: presences });
  } catch (error) {
    console.error('Erreur lors de la récupération des présences hebdomadaires pour la cohorte:', error);
    res.status(500).json({ error: 'Erreur interne du serveur.' });
  }
});

router.get('/api/weekly-presences/departement', async (req, res) => {
  try {
    const { dateRangeStart, dateRangeEnd, departementId } = req.query;

    // Validation des paramètres
    if (!dateRangeStart || !dateRangeEnd || !departementId) {
      return res.status(400).json({ error: 'Les paramètres dateRangeStart, dateRangeEnd et departementId sont requis.' });
    }

    // Récupération des présences hebdomadaires pour le département
    const presences = await getWeeklyPresenceByDepartement(dateRangeStart, dateRangeEnd, parseInt(departementId, 10));

    res.json({ success: true, data: presences });
  } catch (error) {
    console.error('Erreur lors de la récupération des présences hebdomadaires pour le département:', error);
    res.status(500).json({ error: 'Erreur interne du serveur.' });
  }
});


// Endpoint pour récupérer les statistiques du mois
router.get('/api/statistiques-mois', async (req, res) => {
  try {
    const year = req.query.year || new Date().getFullYear(); // Utilise l'année courante si non spécifiée

    if (isNaN(year)) {
      return res.status(400).json({ error: 'L\'année spécifiée est invalide.' });
    }

    // Définir les plages de dates pour l'année courante jusqu'à aujourd'hui
const today = new Date(); // Obtenir la date d'aujourd'hui
const currentYear = today.getFullYear();

// Définir les plages au format "AAAA-MM-JJ"
const dateRangeStart = `${year}-01-01`; // Début de l'année
const dateRangeEnd = parseInt(year) === currentYear
  ? `${currentYear}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}` // Aujourd'hui
  : `${year}-12-31`; // Fin de l'année


  console.log(`Période analysée : ${dateRangeStart} - ${dateRangeEnd}`);


    // Appeler la fonction pour récupérer les statistiques annuelles
    const statsAnnee = await getYearlyPresenceAndAbsence(dateRangeStart, dateRangeEnd);
    res.json(statsAnnee);
  } catch (error) {
    console.error('Erreur lors de la récupération des statistiques de l\'année :', error);
    res.status(500).json({ error: 'Erreur interne du serveur.' });
  }
});

module.exports = router;