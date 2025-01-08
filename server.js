const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { SerialPort } = require('serialport'); // Pour gérer la communication série
const { ReadlineParser } = require('@serialport/parser-readline');
const connectDB = require('./config/db'); // Connexion à MongoDB
const presenceRoutes = require('./routes/presenceRoutes');
const logAccessRoutes = require('./routes/logAccessRoutes');
const pointageRoutes = require('./routes/pointageRoutes');
const Pointage = require('./models/pointage'); // Modèle MongoDB 
const forgot = require('./routes/forgotRoutes');
const historiqueRoutes = require('./routes/historiqueRoutes');
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
// Ajouter la route pour l'historique
app.use('/api', historiqueRoutes);

//Communication avec Arduino via SerialPort
const serialPort = new SerialPort({
    path: '/dev/ttyUSB0', // Remplacez par le bon port série
    baudRate: 9600,
});
const parser = serialPort.pipe(new ReadlineParser({ delimiter: '\n' }));


let isButtonPressed = false; // Indique si le bouton poussoir est pressé
let isLoginMode = false; // Nouveau mode pour la connexion
let currentMode = null; // null, 'pointage', 'login'
// Logique principale pour gérer les cartes RFIDlet currentMode = null; // null, 'pointage', 'login'

// Logique principale pour gérer les cartes RFID
// Communication avec Arduino via SerialPort
// Logique principale pour gérer les cartes RFID
parser.on('data', async (data) => {
    const trimmedData = data.trim();

    // Gestion des boutons poussoirs pour définir le mode
    if (trimmedData === 'POINTAGE_BUTTON_PRESSED') {
        console.log('Mode Pointage activé. Attente de carte...');
        currentMode = 'pointage';
        isButtonPressed = true;

        // Informer les clients WebSocket du changement de mode
        notifyWebSocketClients({ mode: 'pointage', message: 'Mode Pointage activé.' });
        return;
    } else if (trimmedData === 'LOGIN_BUTTON_PRESSED') {
        console.log('Mode Connexion activé. Attente de carte...');
        currentMode = 'login';
        isButtonPressed = true;

        // Informer les clients WebSocket du changement de mode
        notifyWebSocketClients({ mode: 'login', message: 'Mode Connexion activé.' });
        return;
    }

    // Lecture de la carte RFID
    if (!trimmedData.startsWith('UID:')) {
        console.log(`Donnée inattendue :  ${trimmedData}`);
        return;
    }

    const rfidCardId = trimmedData.toUpperCase();
    console.log(`Carte RFID lue : ${rfidCardId}`);

    // Informer Angular via WebSocket de la carte lue
    //notifyWebSocketClients({ cardID: rfidCardId });

    // Gestion en fonction du mode actif
    if (currentMode === 'pointage' && isButtonPressed) {
        await handlePointage(rfidCardId);
    } else if (currentMode === 'login' && isButtonPressed) {
        notifyWebSocketClients({
            type: 'card',
            cardID: rfidCardId,
          });
        await handleLogin(rfidCardId);

    } else if (!isButtonPressed && currentMode === null) {
        await handleCardAssignment(rfidCardId);
    } else {
        console.log('Aucune action correspondante trouvée.');
    }

    // Réinitialiser l'état après utilisation
    isButtonPressed = false;
    currentMode = null;
});



// Fonction pour notifier les clients WebSocket
function notifyWebSocketClients(data) {
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
}


// Fonction pour gérer le pointage
async function handlePointage(rfidCardId) {
    try {
        const response = await axios.get(`http://localhost:8002/api/get-user-by-card/${encodeURIComponent(rfidCardId)}`);
        const userData = response.data;

        if (!userData) {
            console.error('Utilisateur non trouvé');
            serialPort.write('Utilisateur non trouvé\n');
            return;
        }

        const date = new Date();
        const formattedDate = date.toISOString().split('T')[0];
        const currentTime = date.toTimeString().split(' ')[0].slice(0, 5);

        let pointage = await Pointage.findOne({ userID: userData.id, date: formattedDate });

        if (!pointage) {
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
                vigile_nom: 'Pointage par carte',
                vigile_matricule: 'Pointage par carte',
            });
            console.log('Pointage d\'arrivée enregistré.');
            serialPort.write('Pointage Arrivee\n');
        } else if (!pointage.heure_depart) {
            pointage.heure_depart = currentTime;
            console.log('Pointage de départ enregistré.');
            serialPort.write('Pointage Depart\n');
        } else {
            console.log('Pointage déjà complété pour la journée.');
            serialPort.write('Pointage deja complete\n');
        }

        await pointage.save();
    } catch (error) {
        console.error('Erreur lors du pointage :', error.response?.data?.message || error.message);
    }
}

// Fonction pour gérer la connexion
async function handleLogin(rfidCardId) {
    try {
        const response = await axios.post('http://localhost:8002/api/login-by-card', { cardID: rfidCardId });

        if (response.data.message === 'Connexion réussie') {
            console.log('Connexion réussie');
            serialPort.write('Login success\n');
        } else {
            console.log('Connexion échouée');
            serialPort.write('Login failed\n');
        }
    } catch (error) {
        console.error('Erreur lors de la connexion :', error.response?.data?.message || error.message);
        serialPort.write('Login failed\n');
    }
}

// Fonction pour gérer l'attribution de carte
async function handleCardAssignment(rfidCardId) {
    try {
        // Vérifiez si l'utilisateur est pré-sélectionné via un WebSocket ou une autre méthode
        let selectedUser = null;

        // Informer les clients WebSocket d'une carte scannée
        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(rfidCardId); // Envoyer l'UID au client Angular
            }
        });

        // Si aucun utilisateur n'est sélectionné, ne pas procéder à l'attribution
        if (!selectedUser) {
            console.log('Aucun utilisateur sélectionné pour cette carte.');
            return;
        }

        // Payload pour l'API assign-card
        const payload = {
            uid: rfidCardId,
            userType: selectedUser.userType, // ex: 'employes' ou 'apprenants'
            userId: selectedUser.userId,
        };

        // Appel API pour l'attribution
        const response = await axios.post('http://localhost:8002/api/assign-card', payload);
        console.log('Carte attribuée avec succès : ${response.data}');

        // Informer le client WebSocket du succès
        
    } catch (error) {
        console.error('Erreur lors de l\'attribution de la carte :', error.response?.data?.message || error.message);

        // Informer le client WebSocket de l'erreur
        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(
                    JSON.stringify({
                        action: 'error',
                        message: error.response?.data?.message || 'Erreur lors de l\'attribution de la carte.',
                    })
                );
            }
        });
    }
}






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