const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const connectDB = require('./src/config/db');
const errorHandler = require('./src/middleware/error');

// Charger les variables d'environnement
dotenv.config();

// Connexion à la base de données
connectDB();

const app = express();

// Configuration CORS
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-requested-with'],
  credentials: true
}));

// Middleware pour parser le JSON et les cookies
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Middleware pour logger les requêtes
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  
  // Rediriger les requêtes mal formées comme /apiuploads vers /uploads
  if (req.url.startsWith('/apiuploads')) {
    const newUrl = req.url.replace('/apiuploads', '/uploads');
    console.log(`Redirection de ${req.url} vers ${newUrl}`);
    req.url = newUrl;
  }
  
  // Rediriger les requêtes avec /api/uploads vers /uploads
  if (req.url.startsWith('/api/uploads')) {
    const newUrl = req.url.replace('/api/uploads', '/uploads');
    console.log(`Redirection de ${req.url} vers ${newUrl}`);
    return res.redirect(newUrl);
  }
  
  next();
});

// Middleware pour servir les fichiers statiques
// Gère les URL commençant par "/uploads"
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  setHeaders: (res, filePath) => {
    setContentType(res, filePath);
  }
}));

// Loguer les chemins statiques configurés
console.log('Dossier uploads servi depuis:', path.join(__dirname, 'uploads'));

// Middleware pour gérer aussi les URL sans slash au début (ex: "uploads/...")
app.use((req, res, next) => {
  if (req.url.startsWith('uploads/')) {
    // Rediriger vers la même URL avec un slash au début
    console.log(`Redirection de ${req.url} vers /${req.url}`);
    return res.redirect(`/${req.url}`);
  }
  next();
});

// Fonction pour définir le type de contenu approprié
function setContentType(res, filePath) {
  if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
    res.setHeader('Content-Type', 'image/jpeg');
  } else if (filePath.endsWith('.png')) {
    res.setHeader('Content-Type', 'image/png');
  } else if (filePath.endsWith('.gif')) {
    res.setHeader('Content-Type', 'image/gif');
  } else if (filePath.endsWith('.webp')) {
    res.setHeader('Content-Type', 'image/webp');
  } else if (filePath.endsWith('.mp4')) {
    res.setHeader('Content-Type', 'video/mp4');
  } else if (filePath.endsWith('.webm')) {
    res.setHeader('Content-Type', 'video/webm');
  } else if (filePath.endsWith('.mp3')) {
    res.setHeader('Content-Type', 'audio/mpeg');
  }
}

// Routes API
app.use('/api', require('./src/routes'));

// Route test simple
app.get('/', (req, res) => {
  res.json({ message: 'API Bookmi en ligne' });
});

// Middleware de gestion des erreurs
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT} en mode ${process.env.NODE_ENV || 'développement'}`);
});
