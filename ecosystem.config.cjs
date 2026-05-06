// PM2 process configuration.
// All environment variables are loaded from .env via dotenv at runtime —
// do NOT put secrets here. This file is committed to git.
module.exports = {
  apps: [{
    name:          'confession-bot',
    script:        'index.js',
    cwd:           __dirname,
    watch:         false,
    restart_delay: 3000,
    max_restarts:  10,
    autorestart:   true,
  }],
};
