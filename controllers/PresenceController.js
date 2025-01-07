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
      horaires = user.horaires || '[]';
    } catch (e) {
      console.warn(`Horaires invalides pour l'utilisateur ${user.userID}:`, user.horaires);
      continue;
    }

    const horaireJour = Object.values(horaires).find(h => h.jours?.[dayOfWeek]);
    if (!horaireJour) continue; // L'utilisateur n'est pas programmé ce jour-là

    const pointage =  pointages.find(p => p.userID.toString() === user.userID.toString());

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
        horaires = apprenant.horaires;
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
          horaires = employe.horaires || '[]';
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
  const start = dateRangeStart;
  const end = dateRangeEnd;
  const today = new Date(); // Date actuelle

  console.log("la date : ", start, " et ", end);

  // Initialiser les résultats
  const weeklyStats = {
    lundi: { absences: 0, retards: 0 },
    mardi: { absences: 0, retards: 0 },
    mercredi: { absences: 0, retards: 0 },
    jeudi: { absences: 0, retards: 0 },
    vendredi: { absences: 0, retards: 0 },
    samedi: { absences: 0, retards: 0 },
    dimanche: { absences: 0, retards: 0 },
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
   let pointages;
   try {
     pointages = await Pointage.find({
       date: { $gte: dateRangeStart, $lte: dateRangeEnd },
     }).exec();
   } catch (error) {
     console.error('Erreur lors de la récupération des pointages:', error);
     throw new Error('Impossible de récupérer les pointages.');
   }

   if (!pointages || pointages.length === 0) {
     console.warn('Aucun pointage trouvé pour la période spécifiée.');
   }


  // Compter les présences et absences par jour
  for (let d = new Date(dateRangeStart); d <= new Date(dateRangeEnd); d.setDate(d.getDate() + 1)) {
    if (d > today) {
      console.log(`Jour ignoré : ${d.toDateString()} (jour futur)`);
      break; // Arrête la boucle si on atteint un jour futur
    }

    const dayOfWeek = d.toLocaleString('fr-FR', { weekday: 'long' }).toLowerCase();
  
    for (const user of allUsers) {
      // Vérifier si l'utilisateur est programmé ce jour-là
      let horaires = [];
      try {
        horaires = user.horaires || '[]';
      } catch (e) {
        console.warn(`Horaires invalides pour l'utilisateur ${user.userID}:`, user.horaires);
        continue;
      }
  
      const horaireJour = Object.values(horaires).find((h) => h.jours?.[dayOfWeek]);
      if (!horaireJour) continue; // L'utilisateur n'est pas programmé ce jour-là
  
      // Vérifier le pointage dans les données
      const dailyPointage = pointages.find(
        (p) =>
          p.userID.toString() === user.userID.toString() &&
          new Date(p.date).toDateString() === d.toDateString()
      );
  
      if (dailyPointage) {
        // Calculer le retard en comparant l'heure d'arrivée au début des horaires
        const retardArrivee = calculateDifference(
          dailyPointage.heure_arrivee,
          horaireJour.heure_debut
        );
  
        // Si l'utilisateur est en retard (retard > 0), incrémenter le compteur des retards
        if (retardArrivee.startsWith('+')) {
          weeklyStats[dayOfWeek].retards = (weeklyStats[dayOfWeek].retards || 0) + 1;
        }
      } else {
        // Si aucun pointage n'est trouvé, incrémenter le compteur des absences
        weeklyStats[dayOfWeek].absences = (weeklyStats[dayOfWeek].absences || 0) + 1;
      }
    }
  }
  await mysqlConnection.end();
  return weeklyStats;
}

async function getWeeklyPresenceByCohorte(dateRangeStart, dateRangeEnd, cohorteId) {
  const start = new Date(dateRangeStart);
  const end = new Date(dateRangeEnd);

  // Initialiser les résultats
  const weeklyStats = {
    lundi: 0,
    mardi: 0,
    mercredi: 0,
    jeudi: 0,
    vendredi: 0,
    samedi: 0,
    dimanche: 0,
  };

  const mysqlConnection = await mysql.createConnection(dbConfig);

  // Récupérer les apprenants de la cohorte spécifiée
  const [apprenants] = await mysqlConnection.query(
    'SELECT a.id AS userID, c.horaires FROM apprenants a JOIN cohortes c ON a.cohorte_id = c.id WHERE c.id = ?',
    [cohorteId]
  );

  // Récupérer les pointages pour la période donnée
  const pointages = await Pointage.find({
    date: { $gte: start, $lte: end },
    role: 'apprenant',
  }).exec();

  // Calcul des présences
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dayOfWeek = d.toLocaleString('fr-FR', { weekday: 'long' }).toLowerCase();

    for (const apprenant of apprenants) {
      let horaires = [];
      try {
        horaires = JSON.parse(apprenant.horaires || '[]');
      } catch (e) {
        console.warn(`Horaires invalides pour l'apprenant ${apprenant.userID}:`, apprenant.horaires);
        continue;
      }

      const horaireJour = horaires.find((h) => h.jours?.[dayOfWeek]);
      if (!horaireJour) continue; // Non programmé ce jour-là

      const dailyPointage = pointages.find(
        (p) =>
          p.userID.toString() === apprenant.userID.toString() &&
          new Date(p.date).toDateString() === d.toDateString()
      );

      if (dailyPointage) {
        weeklyStats[dayOfWeek]++;
      }
    }
  }

  await mysqlConnection.end();
  return weeklyStats;
}

async function getWeeklyPresenceByDepartement(dateRangeStart, dateRangeEnd, departementId) {
  const start = new Date(dateRangeStart);
  const end = new Date(dateRangeEnd);

  // Initialiser les résultats
  const weeklyStats = {
    lundi: 0,
    mardi: 0,
    mercredi: 0,
    jeudi: 0,
    vendredi: 0,
    samedi: 0,
    dimanche: 0,
  };

  const mysqlConnection = await mysql.createConnection(dbConfig);

  // Récupérer les employés du département spécifié
  const [employes] = await mysqlConnection.query(
    'SELECT e.id AS userID, e.role, d.horaires FROM employes e LEFT JOIN departements d ON e.departement_id = d.id WHERE d.id = ?',
    [departementId]
  );

  // Récupérer les pointages pour la période donnée
  const pointages = await Pointage.find({
    date: { $gte: dateRangeStart, $lte: dateRangeEnd },
    role: { $ne: 'apprenant' },
  }).exec();


  // Calcul des présences
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dayOfWeek = d.toLocaleString('fr-FR', { weekday: 'long' }).toLowerCase();

    for (const employe of employes) {
      let horaires = [];
      try {
        horaires = employe.horaires || '[]';
      } catch (e) {
        console.warn(`Horaires invalides pour l'employé ${employe.userID}:`, employe.horaires);
        continue;
      }

      const horaireJour = horaires.find((h) => h.jours?.[dayOfWeek]);
      if (!horaireJour) continue; // Non programmé ce jour-là

      const dailyPointage = pointages.find(
        (p) =>
          p.userID.toString() === employe.userID.toString() &&
          new Date(p.date).toDateString() === d.toDateString()
      );

      if (dailyPointage) {
        weeklyStats[dayOfWeek]++;
      }
    }
  }

  await mysqlConnection.end();
  return weeklyStats;
}


async function getYearlyPresenceAndAbsence(dateRangeStart, dateRangeEnd) {
  const start = new Date(dateRangeStart);
  const end = new Date(dateRangeEnd);

  // Initialiser les statistiques pour chaque mois
  const yearlyStats = {
    janvier: { presences: 0, absences: 0 },
    février: { presences: 0, absences: 0 },
    mars: { presences: 0, absences: 0 },
    avril: { presences: 0, absences: 0 },
    mai: { presences: 0, absences: 0 },
    juin: { presences: 0, absences: 0 },
    juillet: { presences: 0, absences: 0 },
    août: { presences: 0, absences: 0 },
    septembre: { presences: 0, absences: 0 },
    octobre: { presences: 0, absences: 0 },
    novembre: { presences: 0, absences: 0 },
    décembre: { presences: 0, absences: 0 },
  };

  // Connexion MySQL
  const mysqlConnection = await mysql.createConnection(dbConfig);

  try {
    // Récupérer les utilisateurs (apprenants et employés)
    const [apprenants] = await mysqlConnection.query(
      'SELECT a.id AS userID, c.horaires FROM apprenants a JOIN cohortes c ON a.cohorte_id = c.id'
    );
    const [employes] = await mysqlConnection.query(
      'SELECT e.id AS userID, e.role, d.horaires FROM employes e LEFT JOIN departements d ON e.departement_id = d.id'
    );
    const allUsers = [...apprenants, ...employes];

    // Récupérer les pointages pour la période donnée
    const pointages = await Pointage.find({
      date: { $gte: dateRangeStart, $lte: dateRangeEnd },
    }).exec();

    console.log("Les pointages : ", pointages);
    const today = new Date(); 

    // Parcourir chaque jour de l'année
    for (let d = new Date(dateRangeStart); d <= new Date(dateRangeEnd); d.setDate(d.getDate() + 1)) {

      if (
        d.getFullYear() === today.getFullYear() && 
        d.getMonth() === today.getMonth() && 
        d > today
      ) {
        break; // Sortir de la boucle si on dépasse la date d'aujourd'hui dans le mois courant
      }

      const dayOfWeek = d.toLocaleString('fr-FR', { weekday: 'long' }).toLowerCase();
      const month = d.toLocaleString('fr-FR', { month: 'long' }).toLowerCase();

      for (const user of allUsers) {
        let horaires = [];
        try {
          horaires = user.horaires || '[]'; // Horaires JSON
        } catch (e) {
          console.warn(`Horaires invalides pour l'utilisateur ${user.userID}:`, user.horaires);
          continue;
        }

        // Vérifiez si l'utilisateur est programmé pour ce jour
        const horaireJour = Object.values(horaires).find((h) => h.jours?.[dayOfWeek]);
        if (!horaireJour) continue;

        // Vérifiez si un pointage existe pour ce jour
        const dailyPointage = pointages.find(
          (p) =>
            p.userID.toString() === user.userID.toString() &&
            new Date(p.date).toDateString() === d.toDateString()
        );

        if (dailyPointage) {
          yearlyStats[month].presences++;
        } else {
          yearlyStats[month].absences++;
        }
      }
    }
  } catch (error) {
    console.error('Erreur lors du calcul des présences et absences annuelles:', error);
  } finally {
    // Fermer la connexion MySQL
    await mysqlConnection.end();
  }

  console.log("Yearly : ", yearlyStats);
  return yearlyStats;
}



async function getPresenceByCohorte(date, cohorteId) {
  const dayOfWeek = new Date(date).toLocaleString('fr-FR', { weekday: 'long' }).toLowerCase();
  const mysqlConnection = await mysql.createConnection(dbConfig);

  // Récupérer les apprenants de la cohorte donnée
  const [apprenants] = await mysqlConnection.query(
    'SELECT a.id, c.horaires, c.nom AS cohorte_nom FROM apprenants a JOIN cohortes c ON a.cohorte_id = c.id WHERE c.id = ?',
    [cohorteId]
  );

  if (apprenants.length === 0) {
    await mysqlConnection.end();
    return []; // Aucun apprenant trouvé dans la cohorte
  }

  // Récupérer les pointages pour ces apprenants à la date donnée
  const apprenantIds = apprenants.map(a => a.id);
  const pointages = await Pointage.find({
    date,
    role: 'apprenant',
    userID: { $in: apprenantIds },
  });

  const groupedResults = {};

  for (const pointage of pointages) {
    const apprenant = apprenants.find(a => a.id === pointage.userID);
    let horaires = JSON.parse(apprenant.horaires || '[]');
    const nomCohorte = apprenant.cohorte_nom;

    const horaireJour = horaires.find(h => h.jours?.[dayOfWeek]);

    // Calcul des retards et du statut
    const retardArrivee = horaireJour
      ? calculateDifference(pointage.heure_arrivee, horaireJour.heure_debut)
      : 'N/A';

    const retardDepart = horaireJour
      ? calculateDifference(pointage.heure_depart, horaireJour.heure_fin)
      : 'N/A';

    const status = horaireJour ? 'Programmé' : 'Non programmé';

    groupedResults[pointage.userID] = {
      userID: pointage.userID,
      nom: pointage.nom,
      prenom: pointage.prenom,
      nomCohorte,
      heure_arrivee: pointage.heure_arrivee || 'N/A',
      retardArrivee,
      heure_depart: pointage.heure_depart || 'N/A',
      retardDepart,
      status,
    };
  }

  await mysqlConnection.end();
  return Object.values(groupedResults); // Renvoie un tableau regroupé par userId
}

async function getPresenceByDepartement(date, departementId) {
  const dayOfWeek = new Date(date).toLocaleString('fr-FR', { weekday: 'long' }).toLowerCase();
  const mysqlConnection = await mysql.createConnection(dbConfig);

  // Récupérer les employés du département donné
  const [employes] = await mysqlConnection.query(
    'SELECT e.id, e.role, d.horaires, d.nom AS departement_nom FROM employes e LEFT JOIN departements d ON e.departement_id = d.id WHERE d.id = ?',
    [departementId]
  );

  if (employes.length === 0) {
    await mysqlConnection.end();
    return []; // Aucun employé trouvé dans le département
  }

  // Récupérer les pointages pour ces employés à la date donnée
  const employeIds = employes.map(e => e.id);
  const pointages = await Pointage.find({
    date,
    role: { $ne: 'apprenant' },
    userID: { $in: employeIds },
  });

  const groupedResults = {};

  for (const pointage of pointages) {
    const employe = employes.find(e => e.id === pointage.userID);
    let horaires;

    // Gestion des horaires spécifiques pour les vigiles
    if (employe.role === 'vigile') {
      horaires = [
        { jours: { lundi: true, mardi: true, mercredi: true, jeudi: true, vendredi: true, samedi: true }, heure_debut: '08:00', heure_fin: '18:00' }
      ];
    } else {
      horaires = employe.horaires || '[]';
    }

    const nomDepartement = employe.departement_nom;

    const horaireJour = horaires.find(h => h.jours?.[dayOfWeek]);

    // Calcul des retards et du statut
    const retardArrivee = horaireJour
      ? calculateDifference(pointage.heure_arrivee, horaireJour.heure_debut)
      : 'N/A';

    const retardDepart = horaireJour
      ? calculateDifference(pointage.heure_depart, horaireJour.heure_fin)
      : 'N/A';

    const status = horaireJour ? 'Programmé' : 'Non programmé';

    groupedResults[pointage.userID] = {
      userID: pointage.userID,
      nom: pointage.nom,
      prenom: pointage.prenom,
      nomDepartement,
      role: employe.role,
      heure_arrivee: pointage.heure_arrivee || 'N/A',
      retardArrivee,
      heure_depart: pointage.heure_depart || 'N/A',
      retardDepart,
      status,
    };
  }

  await mysqlConnection.end();
  return Object.values(groupedResults); // Renvoie un tableau regroupé par userId
}



module.exports = {
  getPresenceByDate,
  getAbsencesAndDelays,
  getWeeklyPresenceAndAbsence,
  getWeeklyPresenceByDepartement,
  getYearlyPresenceAndAbsence,
  getPresenceByCohorte,
  getPresenceByDepartement,
  getWeeklyPresenceByCohorte,
};
