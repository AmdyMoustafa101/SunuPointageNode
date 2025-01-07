const mongoose = require('mongoose');

// Connexion à MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect('mongodb://localhost:27017/sunupointagenode', {
    
    });
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('Connection error:', error);
    process.exit(1); // Quitte le processus si la connexion échoue
  }
};

module.exports = connectDB;
