# FairBuy — AWS Deployment Guide

**Architecture**
- **Backend** → EC2 t2.micro (Ubuntu 22.04) — Node.js + Playwright behind nginx
- **Frontend** → S3 static website hosting — React (Vite) build
- **Database** → MongoDB Atlas (unchanged)

---

## Part 1 — EC2 Backend

### 1.1 Launch EC2 Instance

1. Go to **EC2 → Launch Instance**
2. Settings:
   - Name: `fairbuy-server`
   - AMI: **Ubuntu Server 22.04 LTS** (Free tier eligible)
   - Instance type: **t2.micro**
   - Key pair: create or select one (download the `.pem` file)
3. **Security Group** — add these inbound rules:

   | Type  | Port | Source    |
   |-------|------|-----------|
   | SSH   | 22   | My IP     |
   | HTTP  | 80   | 0.0.0.0/0 |
   | HTTPS | 443  | 0.0.0.0/0 |

4. Storage: 20 GB gp2 (free tier allows up to 30 GB)
5. Launch — note the **Public IPv4 address**

### 1.2 SSH In

```bash
chmod 400 your-key.pem
ssh -i your-key.pem ubuntu@<EC2_PUBLIC_IP>
```

### 1.3 Upload Project Files

From your **local machine** (not inside SSH):

```bash
# Option A — zip and scp
cd C:\IOMP
zip -r fairbuy.zip fairbuy --exclude "fairbuy/node_modules/*" --exclude "fairbuy/server/node_modules/*" --exclude "fairbuy/client/node_modules/*" --exclude "fairbuy/client/dist/*"
scp -i your-key.pem fairbuy.zip ubuntu@<EC2_PUBLIC_IP>:/home/ubuntu/

# Option B — git (if you have a repo)
# Set REPO_URL=https://github.com/yourname/fairbuy.git before running setup
```

### 1.4 Run Setup Script

```bash
# Inside SSH session
cd /home/ubuntu
unzip fairbuy.zip          # if you used scp

# Run the setup script
chmod +x fairbuy/deploy/setup-ec2.sh
./fairbuy/deploy/setup-ec2.sh
```

This installs Node 20, PM2, nginx, Playwright Chromium, swap space, and firewall rules (~5 min).

### 1.5 Create .env File

```bash
nano /home/ubuntu/fairbuy/.env
```

Paste your environment variables (replace all placeholder values):

```env
NODE_ENV=production
PORT=4000

MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/fairbuy

JWT_SECRET=replace_with_long_random_string_min_32_chars

EMAIL_USER=your@gmail.com
EMAIL_PASS=your_gmail_app_password

# Set this AFTER you create the S3 bucket in Part 2
CLIENT_URL=http://your-bucket-name.s3-website-ap-south-1.amazonaws.com

FIRECRAWL_API_KEY=fc-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Save: `Ctrl+O`, `Enter`, `Ctrl+X`

### 1.6 Install Server Dependencies + Playwright Browser

```bash
cd /home/ubuntu/fairbuy/server
npm install --omit=dev
npx playwright install chromium
mkdir -p /home/ubuntu/logs
```

### 1.7 Configure nginx

```bash
sudo cp /home/ubuntu/fairbuy/deploy/nginx.conf /etc/nginx/sites-available/fairbuy
sudo ln -s /etc/nginx/sites-available/fairbuy /etc/nginx/sites-enabled/fairbuy
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t          # should print "syntax is ok"
sudo systemctl reload nginx
```

### 1.8 Start the Backend with PM2

```bash
cd /home/ubuntu/fairbuy/server
pm2 start ../deploy/ecosystem.config.cjs --env production
pm2 save
pm2 startup            # copy+paste the command it outputs, then run it
```

Verify it's running:
```bash
pm2 status
curl http://localhost:4000/api/health
# should return {"status":"ok",...}
```

Test from outside:
```
http://<EC2_PUBLIC_IP>/api/health
```

---

## Part 2 — S3 Frontend

### 2.1 Create S3 Bucket

1. Go to **S3 → Create bucket**
2. Settings:
   - Bucket name: `fairbuy-frontend` (must be globally unique)
   - Region: same as EC2 (e.g. `ap-south-1`)
   - **Uncheck** "Block all public access" → confirm
3. After creation → **Properties** tab → scroll to **Static website hosting**
   - Enable it
   - Index document: `index.html`
   - Error document: `index.html` (for React Router)
   - Save — note the **Bucket website endpoint** URL

4. **Permissions** tab → **Bucket policy** → paste:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::fairbuy-frontend/*"
    }
  ]
}
```

### 2.2 Update CLIENT_URL in EC2 .env

```bash
# SSH into EC2, update the CLIENT_URL line:
nano /home/ubuntu/fairbuy/.env
# CLIENT_URL=http://fairbuy-frontend.s3-website-ap-south-1.amazonaws.com

pm2 restart fairbuy-server
```

### 2.3 Build & Upload Frontend

Install AWS CLI on your **local machine** if not already:
```bash
# Windows: download installer from https://aws.amazon.com/cli/
# Then run:
aws configure     # enter Access Key, Secret Key, region (ap-south-1), output (json)
```

Then deploy:
```bash
cd C:\IOMP\fairbuy\deploy
# Windows users: run these commands manually (the .sh is for WSL/Git Bash)

# Or in Git Bash / WSL:
chmod +x deploy-frontend.sh
./deploy-frontend.sh <EC2_PUBLIC_IP> fairbuy-frontend
```

**Manual equivalent (PowerShell):**
```powershell
# In C:\IOMP\fairbuy\client:
"VITE_API_BASE_URL=http://<EC2_PUBLIC_IP>" | Out-File .env.production -Encoding utf8
npm install
npm run build
aws s3 sync dist/ s3://fairbuy-frontend/ --delete `
  --cache-control "max-age=31536000,public" `
  --exclude "index.html"
aws s3 cp dist/index.html s3://fairbuy-frontend/index.html `
  --cache-control "no-cache,no-store,must-revalidate" `
  --content-type "text/html"
```

### 2.4 Test

Open the S3 website endpoint in your browser:
```
http://fairbuy-frontend.s3-website-ap-south-1.amazonaws.com
```

Search for "milk" — all stores should appear.

---

## Ongoing Operations

### Redeploy backend after code changes
```bash
# SSH into EC2
cd /home/ubuntu/fairbuy
git pull         # or re-upload files via scp
cd server
npm install --omit=dev
pm2 restart fairbuy-server
```

### Redeploy frontend after code changes
```bash
# Local machine
./deploy/deploy-frontend.sh <EC2_IP> fairbuy-frontend
```

### View logs
```bash
pm2 logs fairbuy-server          # live tail
pm2 logs fairbuy-server --lines 200   # last 200 lines
```

### Monitor memory (important on t2.micro)
```bash
pm2 monit
free -h
```

---

## Free Tier Limits to Watch

| Service | Free tier | Notes |
|---------|-----------|-------|
| EC2 t2.micro | 750 hrs/month for 12 months | ~1 instance running 24/7 |
| S3 storage | 5 GB | Build folder is ~2 MB |
| S3 requests | 20k GET / 2k PUT per month | Fine for low traffic |
| Data transfer out | 1 GB/month | Scraper results are small JSON |

Playwright Chromium uses ~300–500 MB RAM per search. The 1 GB swap added by `setup-ec2.sh` prevents OOM crashes. Watch `pm2 monit` — if memory stays above 700 MB between searches, uncomment `max_memory_restart` in `ecosystem.config.cjs`.
