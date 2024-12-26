const mysql = require('mysql2/promise');
const Pointage = require('../models/pointage');

// Configuration de la connexion MySQL
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'sunupointagelaravel',
};

async function getPresenceByDate(date, role) {
  const dayOfWeek = new Date(date).toLocaleString('fr-FR', { weekday: 'long' }).toLowerCase();
  const mysqlConnection = await mysql.createConnection(dbConfig);

  let pointages;
  if (role === 'employe') {
    pointages = await Pointage.find({ date, role: { $ne: 'apprenant' } });
  } else if (role === 'apprenant') {
    pointages = await Pointage.find({ date, role: 'apprenant' });
  } else {
    pointages = await Pointage.find({ date, role });
  }

  const groupedResults = {};

  for (const pointage of pointages) {
    let horaires = [];
    let nomDepartementOuCohorte = 'N/A';

    if (pointage.role === 'apprenant') {
      const [rows] = await mysqlConnection.query(
        'SELECT c.horaires, c.nom FROM apprenants a JOIN cohortes c ON a.cohorte_id = c.id WHERE a.id = ?',
        [pointage.userID]
      );
      if (rows.length > 0) {
        const apprenant = rows[0];
        horaires = JSON.parse(apprenant.horaires);
        nomDepartementOuCohorte = apprenant.nom;
      }
    } else {
      const [rows] = await mysqlConnection.query(
        'SELECT e.role, d.horaires, d.nom FROM employes e LEFT JOIN departements d ON e.departement_id = d.id WHERE e.id = ?',
        [pointage.userID]
      );
      if (rows.length > 0) {
        const employe = rows[0];

        if (employe.role === 'vigile') {
          horaires = [
            { jours: { lundi: true, mardi: true, mercredi: true, jeudi: true, vendredi: true, samedi: true }, heure_debut: '08:00', heure_fin: '18:00' }
          ];
          nomDepartementOuCohorte = 'sécurité';
        } else {
          horaires = JSON.parse(employe.horaires || '[]');
          nomDepartementOuCohorte = employe.nom;
        }
      }
    }

    const horaireJour = horaires.find(h => h.jours?.[dayOfWeek]);

    // Calcul des retards et du statut
    const retardArrivee = horaireJour
      ? calculateDifference(pointage.heure_arrivee, horaireJour.heure_debut)
      : 'N/A';

    const retardDepart = horaireJour
      ? calculateDifference(pointage.heure_depart, horaireJour.heure_fin)
      : 'N/A';

    const status = horaireJour ? 'Programmé' : 'Non programmé';

    if (!groupedResults[pointage.userID]) {
      groupedResults[pointage.userID] = {
        userID: pointage.userID,
        nom: pointage.nom,
        prenom: pointage.prenom,
        nomDepartementOuCohorte,
        heure_arrivee: pointage.heure_arrivee || 'N/A',
        retardArrivee,
        heure_depart: pointage.heure_depart || 'N/A',
        retardDepart,
        status,
      };
    } else {
      groupedResults[pointage.userID].heure_depart = pointage.heure_depart || 'N/A';
      groupedResults[pointage.userID].retardDepart = retardDepart;
    }
  }

  await mysqlConnection.end();
  return Object.values(groupedResults); // Renvoie un tableau regroupé par userId
}

function calculateDifference(heurePointage, heureRef) {
  if (!heurePointage) return 'Absent';

  const [pointageH, pointageM] = heurePointage.split(':').map(Number);
  const [refH, refM] = heureRef.split(':').map(Number);

  const totalPointage = pointageH * 60 + pointageM;
  const totalRef = refH * 60 + refM;

  if (totalPointage === totalRef) return 'À l\'heure';

  const diffMinutes = Math.abs(totalPointage - totalRef);
  const heures = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;

  const signe = totalPointage > totalRef ? '+' : '-';
  return `${signe}${heures}h ${minutes}m`;
}

module.exports = {
  getPresenceByDate,
};
