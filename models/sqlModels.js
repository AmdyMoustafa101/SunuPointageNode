const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/mysql');

// Modèle Cohorte
const Cohorte = sequelize.define('Cohorte', {
  nom: { type: DataTypes.STRING, unique: true },
  description: DataTypes.TEXT,
  horaires: DataTypes.JSON,
  annee: DataTypes.INTEGER,
});

// Modèle Département
const Departement = sequelize.define('Departement', {
  nom: { type: DataTypes.STRING, unique: true },
  description: DataTypes.TEXT,
  horaires: DataTypes.JSON,
});

// Modèle Apprenant
const Apprenant = sequelize.define('Apprenant', {
  nom: DataTypes.STRING,
  prenom: DataTypes.STRING,
  adresse: DataTypes.TEXT,
  telephone: DataTypes.STRING,
  photo: DataTypes.STRING,
  cardID: DataTypes.STRING,
  matricule: { type: DataTypes.STRING, unique: true },
  archivage: DataTypes.BOOLEAN,
  cohorte_id: { type: DataTypes.INTEGER, references: { model: Cohorte, key: 'id' } },
});

// Modèle Employé
const Employe = sequelize.define('Employe', {
  nom: DataTypes.STRING,
  prenom: DataTypes.STRING,
  adresse: DataTypes.TEXT,
  telephone: DataTypes.STRING,
  cardID: DataTypes.STRING,
  matricule: { type: DataTypes.STRING, unique: true },
  role: DataTypes.STRING,
  departement_id: { type: DataTypes.INTEGER, references: { model: Departement, key: 'id' } },
});

module.exports = { Cohorte, Departement, Apprenant, Employe };
