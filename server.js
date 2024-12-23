const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const connectDB = require('./config/db'); // Import de la connexion MongoDB
const logAccessRoutes = require('./routes/logAccessRoutes');
const pointageRoutes = require('./routes/pointageRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(cors());


// Ajouter les routes
app.use('/api', logAccessRoutes);
app.use('/api', pointageRoutes);


// Connecter à MongoDB
connectDB()
  .then(() => {
    console.log('MongoDB connecté. Démarrage du serveur...');
    app.listen(PORT, () => {
      console.log(`Serveur en cours d'exécution sur le port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Erreur lors de la connexion à MongoDB:', err);
  });
