const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { SerialPort } = require('serialport'); // Pour gérer la communication série
const { ReadlineParser } = require('@serialport/parser-readline');
const connectDB = require('./config/db'); // Connexion à MongoDB
const presenceRoutes = require('./routes/presenceRoutes');
const logAccessRoutes = require('./routes/logAccessRoutes');
const pointageRoutes = require('./routes/pointageRoutes');
const axios = require('axios'); // Ajout de cette ligne pour importer axios

const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 3003 });

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(bodyParser.json());
app.use(cors());

// Ajouter les routes
app.use('/api', logAccessRoutes);
app.use('/api', pointageRoutes);
app.use(presenceRoutes);

// Communication avec Arduino via SerialPort
const serialPort = new SerialPort({
    path: '/dev/ttyUSB0', // Remplacez par le bon port série
    baudRate: 9600,
});
const parser = serialPort.pipe(new ReadlineParser({ delimiter: '\n' }));

// Lorsqu'une carte RFID est lue
parser.on('data', (data) => {
  const rfidCardId = data.trim();
  console.log(`Carte RFID lue : ${rfidCardId}`);

  // Envoyer à tous les clients connectés
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(rfidCardId);
    }
  });

  // Envoyer au serveur Laravel
  axios.post('http://localhost:8002/api/assign-card', { uid: rfidCardId, userType: 'employes', userId: null })
    .then((response) => {
      console.log('Carte attribuée avec succès:', response.data);
    })
    .catch((error) => {
      if (error.response) {
        console.error('Erreur Laravel:', error.response.data.message);
      } else {
        console.error('Erreur lors de la connexion au serveur Laravel:', error.message);
      }
    });
});


// Connecter à MongoDB et démarrer le serveur
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
