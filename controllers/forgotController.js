require('dotenv').config();
const nodemailer = require('nodemailer');
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');

// Configuration de la base de données à partir du fichier .env
const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
};

// Fonction pour envoyer un email
exports.sendEmail = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'L\'adresse email est requise.' });
  }

  try {
    const connection = await mysql.createConnection(dbConfig);

    // Vérifier si l'utilisateur existe avec le rôle "admin" ou "vigile"
    const [rows] = await connection.execute(
      'SELECT * FROM employes WHERE email = ? AND (role = ? OR role = ?)',
      [email, 'administrateur', 'vigile']
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Aucun utilisateur trouvé avec cet email et rôle.' });
    }

    // Configurer le transporteur nodemailer avec les informations du fichier .env
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER, // Email dans .env
        pass: process.env.EMAIL_PASS, // Mot de passe dans .env
      },
    });

    // Générer un JWT
    const token = jwt.sign(
      { email: email, role: rows[0].role }, // Les données à inclure
      process.env.JWT_SECRET, // Clé secrète dans .env
      { expiresIn: '1h' } // Expire dans 1 heure
    );

    // Génération du lien vers le formulaire de réinitialisation
    const changePasswordForm = `${process.env.FRONTEND_URL}?sirlou=${token}`;

    // Options de l'email
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Bienvenue sur notre plateforme !',
      html: `
        <p>Bonjour,</p>
        <p>Nous avons reçu une demande de réinitialisation de votre mot de passe.</p>
        <p>Si vous êtes à l'origine de cette demande, veuillez cliquer sur le lien ci-dessous pour changer votre mot de passe :</p>
        <a href="${changePasswordForm}" style="color: #4CAF50; text-decoration: none; font-weight: bold;">
          Réinitialiser mon mot de passe
        </a>
        <p>Si vous n'avez pas demandé de changement de mot de passe, ignorez cet email.</p>
        <p>Merci,</p>
        <p>L'équipe Support</p>
      `,
    };

    // Envoyer l'email
    const info = await transporter.sendMail(mailOptions);
    console.log('Email envoyé :', info.response);
    res.status(200).json({ message: 'Email envoyé avec succès' });
  } catch (error) {
    console.error('Erreur lors de l\'envoi de l\'email :', error);
    res.status(500).json({ error: 'Erreur lors de l\'envoi de l\'email' });
  }
};
