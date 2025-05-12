// Script pour définir les variables d'environnement et démarrer le serveur
process.env.JWT_SECRET = 'bookmi_secret_key_for_jwt_tokens';
process.env.REFRESH_TOKEN_SECRET = 'bookmi_secret_key_for_refresh_tokens';
process.env.JWT_EXPIRE = '1h';
process.env.REFRESH_TOKEN_EXPIRE = '7d';

// Démarrer le serveur
require('./server.js'); 