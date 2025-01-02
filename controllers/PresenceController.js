const mysql = require('mysql2/promise');
const Pointage = require('../models/pointage');

// Configuration de la connexion MySQL
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'sunupointagelaravel',
};

async function getAbsencesAndDelays(date) {
  const dayOfWeek = new Date(date).toLocaleString('fr-FR', { weekday: 'long' }).toLowerCase();
  const mysqlConnection = await mysql.createConnection(dbConfig);

  // Récupérer tous les utilisateurs (apprenants et employés)
  const [apprenants] = await mysqlConnection.query(
    'SELECT a.id AS userID, c.horaires FROM apprenants a JOIN cohortes c ON a.cohorte_id = c.id'
  );
  const [employes] = await mysqlConnection.query(
    'SELECT e.id AS userID, e.role, d.horaires FROM employes e LEFT JOIN departements d ON e.departement_id = d.id'
  );

  const allUsers = [...apprenants, ...employes];

  // Récupérer les pointages de la journée
  const pointages = await Pointage.find({ date });

  let absences = 0;
  let retards = 0;

  for (const user of allUsers) {
    // Gérer les horaires non définis ou mal formattés
    let horaires = [];
    try {
      horaires = JSON.parse(user.horaires || '[]');
    } catch (e) {
      console.warn(`Horaires invalides pour l'utilisateur ${user.userID}:`, user.horaires);
      continue;
    }

    const horaireJour = horaires.find(h => h.jours?.[dayOfWeek]);
    if (!horaireJour) continue; // L'utilisateur n'est pas programmé ce jour-là

    const pointage = pointages.find(p => p.userID.toString() === user.userID.toString());

    if (!pointage) {
      // Absent
      absences++;
    } else {
      // Vérifier le retard
      const retardArrivee = calculateDifference(pointage.heure_arrivee, horaireJour.heure_debut);
      if (retardArrivee.startsWith('+')) {
        retards++;
      }
    }
  }

  await mysqlConnection.end();

  return { absences, retards };
}


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

async function getWeeklyPresenceAndAbsence(dateRangeStart, dateRangeEnd) {
  const start = new Date(dateRangeStart);
  const end = new Date(dateRangeEnd);

  // Initialiser les résultats
  const weeklyStats = {
    lundi: { presences: 0, absences: 0 },
    mardi: { presences: 0, absences: 0 },
    mercredi: { presences: 0, absences: 0 },
    jeudi: { presences: 0, absences: 0 },
    vendredi: { presences: 0, absences: 0 },
    samedi: { presences: 0, absences: 0 },
    dimanche: { presences: 0, absences: 0 },
  };

  // Récupérer tous les utilisateurs (apprenants et employés)
  const mysqlConnection = await mysql.createConnection(dbConfig);
  const [apprenants] = await mysqlConnection.query(
    'SELECT a.id AS userID, c.horaires FROM apprenants a JOIN cohortes c ON a.cohorte_id = c.id'
  );
  const [employes] = await mysqlConnection.query(
    'SELECT e.id AS userID, e.role, d.horaires FROM employes e LEFT JOIN departements d ON e.departement_id = d.id'
  );
  const allUsers = [...apprenants, ...employes];

  // Récupérer les pointages pour la période donnée
  const pointages = await Pointage.find({
    date: { $gte: start, $lte: end },
  }).exec();

  // Compter les présences et absences par jour
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dayOfWeek = d.toLocaleString('fr-FR', { weekday: 'long' }).toLowerCase();

    for (const user of allUsers) {
      // Vérifier si l'utilisateur est programmé ce jour-là
      let horaires = [];
      try {
        horaires = JSON.parse(user.horaires || '[]');
      } catch (e) {
        console.warn(`Horaires invalides pour l'utilisateur ${user.userID}:`, user.horaires);
        continue;
      }

      const horaireJour = horaires.find((h) => h.jours?.[dayOfWeek]);
      if (!horaireJour) continue; // L'utilisateur n'est pas programmé ce jour-là

      // Vérifier la présence dans les pointages
      const dailyPointage = pointages.find(
        (p) =>
          p.userID.toString() === user.userID.toString() &&
          new Date(p.date).toDateString() === d.toDateString()
      );

      if (dailyPointage) {
        weeklyStats[dayOfWeek].presences++;
      } else {
        weeklyStats[dayOfWeek].absences++;
      }
    }
  }

  await mysqlConnection.end();
  return weeklyStats;
}




async function getMonthlyPresenceAndAbsence(year) {
  const monthlyStats = Array(12).fill(null).map((_, index) => ({
    month: new Date(year, index).toLocaleString('fr-FR', { month: 'long' }),
    presences: 0,
    absences: 0,
  }));

  // Récupérer les pointages pour l'année donnée depuis MongoDB
  const pointages = await Pointage.find({
    date: { $gte: new Date(`${year}-01-01`), $lte: new Date(`${year}-12-31`) },
  }).exec();

  // Compter les présences et absences par mois
  for (const pointage of pointages) {
    const month = new Date(pointage.date).getMonth();
    monthlyStats[month].presences++;

    // Vous pouvez aussi gérer les absences ici si vous avez la liste des utilisateurs programmés
    // Exemple : monthlyStats[month].absences = totalUsersInMonth - monthlyStats[month].presences;
  }

  return monthlyStats;
}



module.exports = {
  getPresenceByDate,
  getAbsencesAndDelays,
  getWeeklyPresenceAndAbsence,
  getMonthlyPresenceAndAbsence,
};
