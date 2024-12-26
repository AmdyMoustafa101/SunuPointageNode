const { Sequelize } = require('sequelize');

// Configurez la connexion MySQL en utilisant les mêmes informations que Laravel
const sequelize = new Sequelize('sunupointagelaravel', 'root', '', {
  host: 'localhost', // Ou l'adresse de votre serveur MySQL
  dialect: 'mysql',
});

const connectMySQL = async () => {
  try {
    await sequelize.authenticate();
    console.log('Connecté à la base MySQL utilisée par Laravel');
  } catch (error) {
    console.error('Erreur de connexion à MySQL :', error);
    process.exit(1);
  }
};

module.exports = { sequelize, connectMySQL };
