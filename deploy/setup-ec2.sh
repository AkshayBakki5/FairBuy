#!/bin/bash
# FairBuy — EC2 Ubuntu 22.04 setup script
# Run once as ubuntu user after SSH-ing in:
#   chmod +x setup-ec2.sh && ./setup-ec2.sh
set -e

echo "=== FairBuy EC2 Setup ==="

# ── 1. System update ──────────────────────────────────────────────────────────
sudo apt-get update -y && sudo apt-get upgrade -y

# ── 2. Swap space (1 GB) — critical for Playwright on t2.micro ───────────────
if [ ! -f /swapfile ]; then
  echo ">>> Adding 1 GB swap..."
  sudo fallocate -l 1G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
fi

# ── 3. Node.js 20 LTS via nvm ────────────────────────────────────────────────
echo ">>> Installing Node.js 20..."
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
export NVM_DIR="$HOME/.nvm"
source "$NVM_DIR/nvm.sh"
nvm install 20
nvm use 20
nvm alias default 20

# Make node/npm available system-wide for PM2/nginx
NODE_PATH=$(which node)
NPM_PATH=$(which npm)
sudo ln -sf "$NODE_PATH" /usr/local/bin/node
sudo ln -sf "$NPM_PATH"  /usr/local/bin/npm

# ── 4. PM2 ───────────────────────────────────────────────────────────────────
echo ">>> Installing PM2..."
npm install -g pm2

# ── 5. nginx ─────────────────────────────────────────────────────────────────
echo ">>> Installing nginx..."
sudo apt-get install -y nginx
sudo systemctl enable nginx

# ── 6. Playwright system dependencies (Chromium) ─────────────────────────────
echo ">>> Installing Playwright Chromium system deps..."
sudo apt-get install -y \
  libglib2.0-0 libnss3 libnspr4 libdbus-1-3 libatk1.0-0 libatk-bridge2.0-0 \
  libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 \
  libxrandr2 libgbm1 libasound2 libpango-1.0-0 libcairo2 libatspi2.0-0 \
  libwayland-client0 fonts-liberation ca-certificates wget curl unzip git

# ── 7. Clone repo ─────────────────────────────────────────────────────────────
# Replace YOUR_GITHUB_URL with your repo URL, or use the scp method in DEPLOY.md
REPO_URL="${REPO_URL:-}"
if [ -n "$REPO_URL" ]; then
  echo ">>> Cloning $REPO_URL..."
  cd /home/ubuntu
  git clone "$REPO_URL" fairbuy
fi

# ── 8. Install server deps + Playwright browser ───────────────────────────────
if [ -d /home/ubuntu/fairbuy/server ]; then
  echo ">>> Installing server dependencies..."
  cd /home/ubuntu/fairbuy/server
  npm install --omit=dev
  echo ">>> Installing Playwright Chromium browser..."
  npx playwright install chromium
fi

# ── 9. UFW firewall ───────────────────────────────────────────────────────────
echo ">>> Configuring firewall..."
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw --force enable

echo ""
echo "=== Setup complete! ==="
echo "Next steps:"
echo "  1. Copy .env to /home/ubuntu/fairbuy/.env"
echo "  2. Copy nginx config:  sudo cp /home/ubuntu/fairbuy/deploy/nginx.conf /etc/nginx/sites-available/fairbuy"
echo "  3. Enable nginx site:  sudo ln -s /etc/nginx/sites-available/fairbuy /etc/nginx/sites-enabled/"
echo "  4. Remove default:     sudo rm -f /etc/nginx/sites-enabled/default"
echo "  5. Test nginx:         sudo nginx -t"
echo "  6. Start server:       cd /home/ubuntu/fairbuy/server && pm2 start ../deploy/ecosystem.config.cjs"
echo "  7. Save PM2:           pm2 save && pm2 startup"
