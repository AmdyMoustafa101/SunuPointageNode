const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { SerialPort } = require('serialport'); // Pour gérer la communication série
const { ReadlineParser } = require('@serialport/parser-readline');
const connectDB = require('./config/db'); // Connexion à MongoDB
const presenceRoutes = require('./routes/presenceRoutes');
const logAccessRoutes = require('./routes/logAccessRoutes');
const pointageRoutes = require('./routes/pointageRoutes');
const historiqueRoutes = require('./routes/historiqueRoutes');
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
app.use('/api', historiqueRoutes);


// Communication avec Arduino via SerialPort
const pointagePort = new SerialPort({
    path: '/dev/ttyUSB0', // Port pour attribution
    baudRate: 9600,
});
// const parser = serialPort.pipe(new ReadlineParser({ delimiter: '\n' }));

// const pointagePort = new SerialPort('/dev/ttyUSB0', { baudRate: 9600 });
const pointageParser = pointagePort.pipe(new ReadlineParser({ delimiter: '\n' }));

pointageParser.on('data', async (data) => {
    const trimmedData = data.trim();
    if (!trimmedData.startsWith('UID:')) {
        console.log(`Donnée inattendue : ${trimmedData}`);
        return;
    }

    const rfidCardId = trimmedData.toUpperCase();
    console.log(`Carte RFID lue : ${rfidCardId}`);
    await handlePointage(rfidCardId);
});

// Fonction pour gérer le pointage
async function handlePointage(rfidCardId) {
    try {
        const response = await axios.get(`http://localhost:8002/api/get-user-by-card/${encodeURIComponent(rfidCardId)}`);
        const userData = response.data;

        if (!userData) {
            console.error('Utilisateur non trouvé');
            pointagePort.write('Utilisateur non trouvé\n');
            return;
        }

        const date = new Date();
        const formattedDate = date.toISOString().split('T')[0];
        const currentTime = date.toTimeString().split(' ')[0].slice(0, 5);

        let pointage = await Pointage.findOne({ userID: userData.id, date: formattedDate });

        if (!pointage) {
            // Premier pointage de la journée
            pointage = new Pointage({
                userID: userData.id,
                nom: userData.nom,
                prenom: userData.prenom,
                matricule: userData.matricule,
                telephone: userData.telephone,
                role: userData.role || 'apprenant',
                date: formattedDate,
                heure_arrivee: currentTime,
                heure_depart: null,
                vigile_nom: 'Pointage automatique',
                vigile_matricule: 'Automatique',
            });
            pointagePort.write('Pointage Arrivee\n');
        } else {
            // Tous les autres scans mettent à jour l'heure de départ
            pointage.heure_depart = currentTime;
            pointagePort.write('Pointage Depart\n');
        }

        await pointage.save();
    } catch (error) {
        console.error('Erreur lors du pointage :', error.response?.data?.message || error.message);
    }
}

function notifyWebSocketClients(data) {
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
}

// Communication avec Arduino via SerialPort
// const loginPort = new SerialPort({
//     path: '/dev/ttyUSB0', // Port pour attribution
//     baudRate: 9600,
// });

// const loginParser = loginPort.pipe(new ReadlineParser({ delimiter: '\n' }));

// let currentMode = null; // null, 'pointage', 'login'

// loginParser.on('data', async (data) => {
//     const trimmedData = data.trim();
//     if (!trimmedData.startsWith('UID:')) {
//         console.log(`Donnée inattendue : ${trimmedData}`);
//         return;
//     }

//     const rfidCardId = trimmedData.toUpperCase();
//     console.log(`Carte RFID lue : ${rfidCardId}`);

//     // Exemple de logique pour choisir entre login et assignation
//     if (currentMode === 'login') {
//         notifyWebSocketClients({
//             type: 'card',
//             cardID: rfidCardId,
//           });
//         await handleLogin(rfidCardId);
//     } else {
//         await handleCardAssignment(rfidCardId);
//     }
// });

// // Fonction pour gérer la connexion
// async function handleLogin(rfidCardId) {
//     try {
//         // Informer les clients WebSocket d'une carte scannée
//         wss.clients.forEach((client) => {
//             if (client.readyState === WebSocket.OPEN) {
//                 client.send(rfidCardId); // Envoyer l'UID au client Angular
//             }
//         });
//         const response = await axios.post('http://localhost:8002/api/login-by-card', { cardID: rfidCardId });
//         if (response.data.message === 'Connexion réussie') {
//             console.log('Connexion réussie');
//             loginPort.write('Login success\n');
//         } else {
//             console.log('Connexion échouée');
//             loginPort.write('Login failed\n');
//         }
//     } catch (error) {
//         console.error('Erreur lors de la connexion :', error.response?.data?.message || error.message);
//         loginPort.write('Login failed\n');
//     }
// }

// // Fonction pour gérer l'attribution de carte
// async function handleCardAssignment(rfidCardId) {
//     try {
//         let selectedUser = null;

//         // Informer les clients WebSocket d'une carte scannée
//         wss.clients.forEach((client) => {
//             if (client.readyState === WebSocket.OPEN) {
//                 client.send(rfidCardId); // Envoyer l'UID au client Angular
//             }
//         });

//         // Si aucun utilisateur n'est sélectionné, ne pas procéder à l'attribution
//         if (!selectedUser) {
//             console.log('Aucun utilisateur sélectionné pour cette carte.');
//             return;
//         }

//         // Payload pour l'API assign-card
//         const payload = {
//             uid: rfidCardId,
//             userType: selectedUser.userType, // ex: 'employes' ou 'apprenants'
//             userId: selectedUser.userId,
//         };

//         // Appel API pour l'attribution
//         const response = await axios.post('http://localhost:8002/api/assign-card', payload);
//         console.log('Carte attribuée avec succès : ${response.data}');
//         console.log('Attribution de la carte...');
//         // Logique de votre attribution de carte ici
//         loginPort.write('Card assigned\n');
//     } catch (error) {
//         console.error('Erreur lors de l\'attribution de la carte :', error.response?.data?.message || error.message);
//     }
// }





// Connecter à MongoDB et démarrer le serveur
connectDB()
    .then(() => {
        console.log('MongoDB connecté. Démarrage du serveur...');
        app.listen(PORT, () => {
            console.log(`Serveur en cours d exécution sur le port ${PORT}`);
        });
    })
    .catch((err) => {
        console.error('Erreur lors de la connexion à MongoDB:', err);
    });