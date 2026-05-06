#!/bin/bash
set -e

echo ""
echo "=== Confession Bot - Setup VPS ==="
echo ""

# Install Node.js 20
if ! command -v node &> /dev/null; then
  echo "[1/5] Installing Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt install -y nodejs
else
  echo "[1/5] Node.js already installed: $(node --version)"
fi

# Install PM2
if ! command -v pm2 &> /dev/null; then
  echo "[2/5] Installing PM2..."
  npm install -g pm2
else
  echo "[2/5] PM2 already installed: $(pm2 --version)"
fi

# Clone or update the repo
echo "[3/5] Cloning repository..."
if [ -d "/root/confession-bot" ]; then
  cd /root/confession-bot && git pull
else
  git clone https://github.com/Zarivox/confession-bot.git /root/confession-bot
  cd /root/confession-bot
fi

# Install dependencies
echo "[4/5] Installing dependencies..."
npm install --omit=dev

# Create .env if it doesn't exist
if [ ! -f "/root/confession-bot/.env" ]; then
  echo ""
  echo "[5/5] Creating .env file..."
  echo "Fill in the values below (press Enter to skip optional fields):"
  echo ""

  read -rp "BOT_TOKEN: " BOT_TOKEN
  read -rp "CLIENT_ID: " CLIENT_ID
  read -rp "GUILD_ID: " GUILD_ID
  read -rp "CONFESSION_CHANNEL_ID: " CONFESSION_CHANNEL_ID
  read -rp "ADMIN_ID: " ADMIN_ID

  cat > /root/confession-bot/.env <<EOF
BOT_TOKEN=$BOT_TOKEN
CLIENT_ID=$CLIENT_ID
GUILD_ID=$GUILD_ID
CONFESSION_CHANNEL_ID=$CONFESSION_CHANNEL_ID
ADMIN_ID=$ADMIN_ID
LANG=en
EOF

  echo ".env created."
else
  echo "[5/5] .env already exists, skipping."
fi

# Deploy slash commands
echo ""
echo "Deploying slash commands..."
node /root/confession-bot/deploy-commands.js

# Start with PM2
echo "Starting bot with PM2..."
pm2 delete confession-bot 2>/dev/null || true
pm2 start /root/confession-bot/index.js --name confession-bot
pm2 save

# Enable PM2 on boot
pm2 startup systemd -u root --hp /root | tail -1 | bash

echo ""
echo "=== Setup complete! Bot is running. ==="
pm2 status
