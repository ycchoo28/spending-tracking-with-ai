#!/bin/bash

# Receipt Tracker Agent - Secure Deployment Script
# Uses PM2 environment variables instead of .env file for better security

set -e

# Configuration
INSTANCE_NAME="free-tier-vm"
ZONE="us-central1-a"
APP_NAME="receipt-tracker-agent"
APP_PORT="3000"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=================================================="
echo "Receipt Tracker Agent - Secure GCP Deployment"
echo "Using PM2 environment variables (no .env file)"
echo -e "==================================================${NC}"
echo ""

# Check if .env file exists
if [ ! -f "../.env" ]; then
    echo -e "${RED}❌ Error: .env file not found in parent directory${NC}"
    exit 1
fi

# Read environment variables from .env file
echo -e "${YELLOW}[1/8] Reading environment variables from .env file...${NC}"
source "../.env"

# Use PROD variables if available, otherwise fall back to regular ones
DEPLOY_TELEGRAM_TOKEN="${TELEGRAM_BOT_TOKEN_PROD:-${TELEGRAM_BOT_TOKEN}}"
DEPLOY_SUPABASE_URL="${SUPABASE_URL_PROD:-${SUPABASE_URL}}"
DEPLOY_SUPABASE_KEY="${SUPABASE_KEY_PROD:-${SUPABASE_KEY}}"

# Validate required variables
if [ -z "$DEPLOY_TELEGRAM_TOKEN" ] || [ -z "$MODELSCOPE_API_KEY" ] || [ -z "$DEPLOY_SUPABASE_URL" ] || [ -z "$DEPLOY_SUPABASE_KEY" ]; then
    echo -e "${RED}❌ Error: Missing required environment variables in .env file${NC}"
    echo "Required: TELEGRAM_BOT_TOKEN (or TELEGRAM_BOT_TOKEN_PROD), MODELSCOPE_API_KEY, SUPABASE_URL (or SUPABASE_URL_PROD), SUPABASE_KEY (or SUPABASE_KEY_PROD)"
    exit 1
fi

echo -e "${GREEN}✅ Environment variables loaded${NC}"
echo "  Telegram Bot: ${DEPLOY_TELEGRAM_TOKEN:0:10}..."
echo "  ModelScope API: ${MODELSCOPE_API_KEY:0:10}..."
echo "  Supabase URL: $DEPLOY_SUPABASE_URL"

# Check if gcloud is available
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}❌ Error: gcloud CLI is not installed${NC}"
    exit 1
fi

# Check if git is available and we're in a git repo
if ! command -v git &> /dev/null; then
    echo -e "${RED}❌ Error: git is not installed${NC}"
    exit 1
fi

if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo -e "${RED}❌ Error: Not in a git repository${NC}"
    echo "Please initialize git or use the repository root directory"
    exit 1
fi

# Check if instance exists and is running
echo -e "${YELLOW}[2/8] Checking instance status...${NC}"
STATUS=$(gcloud compute instances describe "$INSTANCE_NAME" --zone="$ZONE" --format="value(status)" 2>/dev/null || echo "NOT_FOUND")

if [ "$STATUS" = "NOT_FOUND" ]; then
    echo -e "${RED}❌ Instance '$INSTANCE_NAME' not found${NC}"
    echo "Please run ./setup-gcp-free-tier.sh first"
    exit 1
fi

if [ "$STATUS" != "RUNNING" ]; then
    echo -e "${YELLOW}Starting instance...${NC}"
    gcloud compute instances start "$INSTANCE_NAME" --zone="$ZONE"
    echo -e "${GREEN}✅ Instance started${NC}"
    sleep 10
fi

# Get external IP
EXTERNAL_IP=$(gcloud compute instances describe "$INSTANCE_NAME" --zone="$ZONE" --format="value(networkInterfaces[0].accessConfigs[0].natIP)")
echo -e "Instance IP: ${GREEN}$EXTERNAL_IP${NC}"

# Create firewall rule for the app port
echo -e "${YELLOW}[3/8] Setting up firewall rules...${NC}"
gcloud compute firewall-rules create allow-receipt-tracker \
    --allow=tcp:$APP_PORT \
    --source-ranges=0.0.0.0/0 \
    --target-tags=receipt-tracker \
    --description="Allow access to Receipt Tracker Agent" \
    2>/dev/null || echo "Firewall rule already exists"

gcloud compute instances add-tags "$INSTANCE_NAME" \
    --zone="$ZONE" \
    --tags=receipt-tracker 2>/dev/null || true

echo -e "${GREEN}✅ Firewall configured for port $APP_PORT${NC}"

# Pull latest code from git
echo -e "${YELLOW}[4/8] Pulling latest code from git...${NC}"

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")
COMMIT_HASH=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")

gcloud compute ssh "$INSTANCE_NAME" --zone="$ZONE" --command="
    cd ~/receipt-tracker
    git stash
    git fetch origin
    git pull origin $CURRENT_BRANCH
    git stash pop 2>/dev/null || true
    echo 'Code updated to latest version'
"

echo -e "${GREEN}✅ Code pulled from git (branch: $CURRENT_BRANCH, commit: $COMMIT_HASH)${NC}"

# Install dependencies
echo -e "${YELLOW}[5/8] Installing dependencies on instance...${NC}"
gcloud compute ssh "$INSTANCE_NAME" --zone="$ZONE" --command="
    cd ~/receipt-tracker
    
    # Update system
    sudo apt-get update -y
    
    # Install Node.js 20 if not present
    if ! command -v node &> /dev/null || [[ \$(node -v | cut -d'.' -f1 | cut -d'v' -f2) -lt 20 ]]; then
        echo 'Installing Node.js 20...'
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt-get install -y nodejs
    fi
    
    # Install PM2 globally if not present
    if ! command -v pm2 &> /dev/null; then
        echo 'Installing PM2...'
        sudo npm install -g pm2
    fi
    
    # Install project dependencies
    echo 'Installing project dependencies...'
    npm ci --only=production
    
    echo 'Dependencies installed successfully'
"

echo -e "${GREEN}✅ Dependencies installed${NC}"

# Build the application
echo -e "${YELLOW}[6/8] Building application...${NC}"
gcloud compute ssh "$INSTANCE_NAME" --zone="$ZONE" --command="
    cd ~/receipt-tracker
    
    # Install dev dependencies for building
    npm install
    
    # Build TypeScript
    npm run build
    
    # Remove dev dependencies
    npm prune --production
    
    echo 'Application built successfully'
"

echo -e "${GREEN}✅ Application built${NC}"

# Setup PM2 ecosystem file with environment variables
echo -e "${YELLOW}[7/8] Configuring PM2 with environment variables...${NC}"

# Escape special characters for bash heredoc
ESCAPED_TELEGRAM_TOKEN=$(printf '%s' "$DEPLOY_TELEGRAM_TOKEN" | sed "s/'/'\\\\''/g")
ESCAPED_MODELSCOPE_KEY=$(printf '%s' "$MODELSCOPE_API_KEY" | sed "s/'/'\\\\''/g")
ESCAPED_SUPABASE_URL=$(printf '%s' "$DEPLOY_SUPABASE_URL" | sed "s/'/'\\\\''/g")
ESCAPED_SUPABASE_KEY=$(printf '%s' "$DEPLOY_SUPABASE_KEY" | sed "s/'/'\\\\''/g")

gcloud compute ssh "$INSTANCE_NAME" --zone="$ZONE" --command="
    cd ~/receipt-tracker
    cat > ecosystem.config.js << 'EOFCONFIG'
module.exports = {
  apps: [{
    name: 'receipt-tracker-agent',
    script: 'dist/index.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      
      // Telegram Configuration
      TELEGRAM_BOT_TOKEN: '$ESCAPED_TELEGRAM_TOKEN',
      TELEGRAM_BOT_TOKEN_PROD: '$ESCAPED_TELEGRAM_TOKEN',
      
      // ModelScope API Configuration
      MODELSCOPE_API_KEY: '$ESCAPED_MODELSCOPE_KEY',
      MODELSCOPE_API_BASE: '${MODELSCOPE_API_BASE:-https://api-inference.modelscope.cn/v1}',
      MODELSCOPE_VISION_MODEL: '${MODELSCOPE_VISION_MODEL:-Qwen/Qwen3-VL-235B-A22B-Instruct}',
      MODELSCOPE_TEXT_MODEL_PROFILE: '${MODELSCOPE_TEXT_MODEL_PROFILE:-glm4}',
      MODELSCOPE_TEXT_MODEL_GLM4: '${MODELSCOPE_TEXT_MODEL_GLM4:-ZhipuAI/GLM-4.6}',
      MODELSCOPE_TEXT_MODEL_QWEN_CODER: '${MODELSCOPE_TEXT_MODEL_QWEN_CODER:-Qwen/Qwen3-Coder-480B-A35B-Instruct}',
      
      // Supabase Configuration
      SUPABASE_URL: '$ESCAPED_SUPABASE_URL',
      SUPABASE_KEY: '$ESCAPED_SUPABASE_KEY',
      SUPABASE_URL_PROD: '$ESCAPED_SUPABASE_URL',
      SUPABASE_KEY_PROD: '$ESCAPED_SUPABASE_KEY',
      
      // Application Settings
      CONFIDENCE_THRESHOLD: '${CONFIDENCE_THRESHOLD:-0.8}',
      MAX_RETRIES: '${MAX_RETRIES:-3}',
      RETRY_DELAY: '${RETRY_DELAY:-2000}',
      LOG_LEVEL: 'info',
      
      // Memory Monitoring
      MEMORY_MONITOR_INTERVAL_MS: '${MEMORY_MONITOR_INTERVAL_MS:-30000}',
      
      // LangSmith (Optional)
      LANGCHAIN_TRACING_V2: '${LANGCHAIN_TRACING_V2:-false}',
      LANGCHAIN_API_KEY: '${LANGCHAIN_API_KEY:-}',
      LANGCHAIN_PROJECT: '${LANGCHAIN_PROJECT:-}',
      LANGCHAIN_ENDPOINT: '${LANGCHAIN_ENDPOINT:-}'
    },
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    error_file: '~/.pm2/logs/receipt-tracker-error.log',
    out_file: '~/.pm2/logs/receipt-tracker-out.log',
    log_file: '~/.pm2/logs/receipt-tracker-combined.log',
    time: true,
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    max_memory_restart: '500M'
  }]
};
EOFCONFIG
    
    # Remove .env file if it exists (we're using PM2 env vars now)
    if [ -f .env ]; then
        echo 'Removing .env file (using PM2 environment variables instead)'
        rm .env
    fi
    
    echo 'PM2 ecosystem configured with environment variables'
"

echo -e "${GREEN}✅ PM2 configured securely${NC}"

# Start application
echo -e "${YELLOW}[8/8] Starting application...${NC}"
gcloud compute ssh "$INSTANCE_NAME" --zone="$ZONE" --command="
    cd ~/receipt-tracker
    
    # Stop any existing PM2 processes
    pm2 delete receipt-tracker-agent 2>/dev/null || true
    
    # Start the application
    pm2 start ecosystem.config.js
    
    # Save PM2 configuration
    pm2 save
    
    # Setup PM2 to start on boot
    pm2 startup | grep -E '^sudo' | bash || true
    
    echo 'Application started with PM2'
"

echo -e "${GREEN}✅ Application deployed and started${NC}"

echo ""
echo -e "${BLUE}=================================================="
echo "Secure Deployment Complete!"
echo -e "==================================================${NC}"
echo ""
echo -e "🚀 Your Receipt Tracker Agent is now running on GCP!"
echo -e "🔒 Secrets are stored in PM2 environment variables (not in .env file)"
echo ""
echo -e "📱 ${GREEN}Bot URL:${NC} Start chatting with your Telegram bot"
echo -e "🌐 ${GREEN}Instance IP:${NC} $EXTERNAL_IP"
echo ""
echo -e "${YELLOW}Management Commands:${NC}"
echo "  View logs:     gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --command='pm2 logs'"
echo "  Check status:  gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --command='pm2 status'"
echo "  Restart app:   gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --command='pm2 restart receipt-tracker-agent'"
echo "  View env vars: gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --command='pm2 env 0'"
echo ""
echo -e "${YELLOW}SSH into instance:${NC}"
echo "  ./manage-instance.sh ssh"
echo ""
echo -e "💡 ${BLUE}Security Note:${NC} Environment variables are stored in PM2's process memory"
echo "   and in the ecosystem.config.js file. The .env file has been removed."
echo ""
