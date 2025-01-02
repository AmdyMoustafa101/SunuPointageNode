const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { SerialPort } = require('serialport'); // Pour gérer la communication série
const { ReadlineParser } = require('@serialport/parser-readline');
const connectDB = require('./config/db'); // Connexion à MongoDB
const presenceRoutes = require('./routes/presenceRoutes');
const logAccessRoutes = require('./routes/logAccessRoutes');
const pointageRoutes = require('./routes/pointageRoutes');
const forgot = require('./routes/forgotRoutes');
const Pointage = require('./models/pointage'); // Modèle MongoDB 
const axios = require('axios'); // Ajout de cette ligne pour importer axios

const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 3004 });

const app = express();
const PORT = process.env.PORT || 3005;

// Middleware
app.use(bodyParser.json());
app.use(cors());

// Ajouter les routes
app.use('/api', logAccessRoutes);
app.use('/api', pointageRoutes);
app.use(presenceRoutes);
app.use(forgot);

// Communication avec Arduino via SerialPort
// const serialPort = new SerialPort({
//     path: '/dev/ttyUSB1', // Remplacez par le bon port série
//     baudRate: 9600,
// });
// const parser = serialPort.pipe(new ReadlineParser({ delimiter: '\n' }));


let isButtonPressed = false; // Indique si le bouton poussoir est pressé

// Logique principale pour gérer les cartes RFID
// parser.on('data', async (data) => {
//     const trimmedData = data.trim();
//     if (trimmedData === 'BUTTON_PRESSED') {
//         console.log('Bouton poussoir activé. Mode Pointage.');
//         isButtonPressed = true;
//         return;
//     }

//     const rfidCardId = trimmedData.toUpperCase();
//     console.log(`Carte RFID lue : ${rfidCardId}`);

//     if (isButtonPressed) {
//       // Mode Pointage
//       try {
//           // Appel au serveur Laravel pour récupérer les informations utilisateur
//           const response = await axios.get(`http://localhost:8002/api/get-user-by-card/${encodeURIComponent(rfidCardId)}`);
//           const userData = response.data;
  
//           if (!userData) {
//               console.error('Utilisateur non trouvé');
//               serialPort.write('Utilisateur non trouvé\n'); // Envoi du message à l'Arduino
//               return;
//           }
  
//           const date = new Date();
//           const formattedDate = date.toISOString().split('T')[0]; // Format YYYY-MM-DD
//           const currentTime = date.toTimeString().split(' ')[0].slice(0, 5); // Format HH:MM
  
//           // Détermine le rôle selon le type d'utilisateur
//           let userRole = 'employe'; // Rôle par défaut
//           if (userData.role) {
//               userRole = userData.role; // Si un rôle est défini pour l'employé
//           } else if (userData.cardID) {
//               userRole = 'apprenant'; // Si l'utilisateur est un apprenant, on attribue directement "apprenant"
//           }
  
//           // Vérifiez s'il y a déjà un pointage pour cet utilisateur aujourd'hui
//           let pointage = await Pointage.findOne({ userID: userData.id, date: formattedDate });
  
//           if (!pointage) {
//               // Premier pointage de la journée (Arrivée)
//               pointage = new Pointage({
//                   userID: userData.id,
//                   nom: userData.nom,
//                   prenom: userData.prenom,
//                   matricule: userData.matricule,
//                   telephone: userData.telephone,
//                   role: userRole, // Utilise le rôle corrigé
//                   date: formattedDate,
//                   heure_arrivee: currentTime,
//                   heure_depart: null, // Assigner à null explicitement
//                   vigile_nom: 'Pointage par carte',
//                   vigile_matricule: 'Pointage par carte',
//               });
//               console.log('Pointage d\'arrivée enregistré.');
//               serialPort.write('Pointage Arrivee\n'); // Envoi du message à l'Arduino
//           } else if (!pointage.heure_depart) {
//               // Deuxième pointage de la journée (Départ)
//               pointage.heure_depart = currentTime;
//               console.log('Pointage de départ enregistré.');
//               serialPort.write('Pointage Depart\n'); // Envoi du message à l'Arduino
//           } else {
//               console.log('Pointage déjà complété pour la journée.');
//               serialPort.write('Pointage deja complete\n'); // Envoi du message à l'Arduino
//           }
  
//           // Sauvegarder ou mettre à jour le pointage
//           await pointage.save();
//       } catch (error) {
//           if (error.response) {
//               console.error(`Erreur Laravel : ${error.response.data.message}`);
//           } else {
//               console.error(`Erreur lors du traitement du pointage : ${error.message}`);
//           }
//       }
  
//       isButtonPressed = false; // Réinitialiser le mode
//   } else {
//         // Mode Attribution de Carte
//         // Envoyer à tous les clients connectés
//       wss.clients.forEach((client) => {
//     if (client.readyState === WebSocket.OPEN) {
//       client.send(rfidCardId);
//     }
//   });

//   // Envoyer au serveur Laravel
//   axios.post('http://localhost:8002/api/assign-card', { uid: rfidCardId, userType: 'employes', userId: null })
//     .then((response) => {
//       console.log('Carte attribuée avec succès:', response.data);
//     })
//     .catch((error) => {
//       if (error.response) {
//         console.error('Erreur Laravel:', error.response.data.message);
//       } else {
//         console.error('Erreur lors de la connexion au serveur Laravel:', error.message);
//       }
//     });
//     }
// });

// WebSocket pour transmettre les données aux clients
wss.on('connection', (client) => {
  console.log('Client connecté au WebSocket.');
  client.on('message', (message) => {
      console.log(`Message reçu du client : ${message}`);
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