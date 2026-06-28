#!/bin/bash
# FairBuy — build React app and upload to S3
# Usage: ./deploy-frontend.sh <ec2-public-ip> <s3-bucket-name>
#   e.g: ./deploy-frontend.sh 54.123.45.67 fairbuy-frontend
#
# Prerequisites: AWS CLI configured (aws configure)

set -e

EC2_IP="${1:?Usage: $0 <ec2-public-ip> <s3-bucket-name>}"
BUCKET="${2:?Usage: $0 <ec2-public-ip> <s3-bucket-name>}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "=== FairBuy Frontend Deploy ==="
echo "  EC2 backend : http://$EC2_IP"
echo "  S3 bucket   : s3://$BUCKET"
echo ""

# ── Write production env ──────────────────────────────────────────────────────
cat > "$ROOT/client/.env.production" <<EOF
VITE_API_BASE_URL=http://$EC2_IP
EOF
echo ">>> .env.production written"

# ── Install & build ───────────────────────────────────────────────────────────
cd "$ROOT/client"
npm install
npm run build
echo ">>> React build complete (dist/)"

# ── Upload to S3 ─────────────────────────────────────────────────────────────
aws s3 sync dist/ "s3://$BUCKET/" \
  --delete \
  --cache-control "max-age=31536000,public" \
  --exclude "index.html"

# index.html must never be cached so users always get the latest shell
aws s3 cp dist/index.html "s3://$BUCKET/index.html" \
  --cache-control "no-cache,no-store,must-revalidate" \
  --content-type "text/html"

echo ""
echo "=== Deploy complete ==="
echo "  Frontend URL: http://$BUCKET.s3-website-<region>.amazonaws.com"
echo "  (replace <region> with your bucket region, e.g. ap-south-1)"
