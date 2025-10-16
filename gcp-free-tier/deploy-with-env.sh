#!/bin/bash

# Receipt Tracker Agent Deployment Script with .env file
# This script deploys using credentials from the .env file

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
echo "Receipt Tracker Agent - GCP Deployment (with .env)"
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

# Validate required variables
if [ -z "$TELEGRAM_BOT_TOKEN" ] || [ -z "$OPENAI_API_KEY" ] || [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_KEY" ]; then
    echo -e "${RED}❌ Error: Missing required environment variables in .env file${NC}"
    echo "Required: TELEGRAM_BOT_TOKEN, OPENAI_API_KEY, SUPABASE_URL, SUPABASE_KEY"
    exit 1
fi

echo -e "${GREEN}✅ Environment variables loaded${NC}"
echo "  Telegram Bot: ${TELEGRAM_BOT_TOKEN:0:10}..."
echo "  OpenAI API: ${OPENAI_API_KEY:0:10}..."
echo "  Supabase URL: $SUPABASE_URL"

# Check if gcloud is available
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}❌ Error: gcloud CLI is not installed${NC}"
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
    sleep 10  # Wait for instance to fully start
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

# Add tag to instance
gcloud compute instances add-tags "$INSTANCE_NAME" \
    --zone="$ZONE" \
    --tags=receipt-tracker 2>/dev/null || true

echo -e "${GREEN}✅ Firewall configured for port $APP_PORT${NC}"

# Copy project files to instance
echo -e "${YELLOW}[4/8] Copying project files...${NC}"

# Create a temporary directory with only necessary files
TEMP_DIR=$(mktemp -d)
echo "Using temporary directory: $TEMP_DIR"

# Copy essential files
cp -r ../src "$TEMP_DIR/"
cp ../package*.json "$TEMP_DIR/"
cp ../tsconfig.json "$TEMP_DIR/"
cp ../Dockerfile "$TEMP_DIR/"
cp ../docker-compose.yml "$TEMP_DIR/"

# Create deployment directory structure
mkdir -p "$TEMP_DIR/scripts"
cp -r ../scripts/* "$TEMP_DIR/scripts/" 2>/dev/null || true

# Copy to instance
gcloud compute scp --recurse "$TEMP_DIR" "$INSTANCE_NAME":~/receipt-tracker --zone="$ZONE"

# Clean up temp directory
rm -rf "$TEMP_DIR"

echo -e "${GREEN}✅ Project files copied${NC}"

# Install dependencies and setup on instance
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

# Setup environment file on instance
echo -e "${YELLOW}[6/8] Setting up environment configuration...${NC}"

# Create .env file on instance with the loaded variables
gcloud compute ssh "$INSTANCE_NAME" --zone="$ZONE" --command="
    cd ~/receipt-tracker
    cat > .env << EOF
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=$TELEGRAM_BOT_TOKEN

# OpenAI Configuration
OPENAI_API_KEY=$OPENAI_API_KEY
OPENAI_API_BASE=$OPENAI_API_BASE
OPENAI_VISION_MODEL=$OPENAI_VISION_MODEL
OPENAI_TEXT_MODEL=$OPENAI_TEXT_MODEL

# Supabase Configuration
SUPABASE_URL=$SUPABASE_URL
SUPABASE_KEY=$SUPABASE_KEY

# Application Settings
CONFIDENCE_THRESHOLD=${CONFIDENCE_THRESHOLD:-0.8}
MAX_RETRIES=${MAX_RETRIES:-3}
RETRY_DELAY=${RETRY_DELAY:-2000}
LOG_LEVEL=info
NODE_ENV=production
MEMORY_MONITOR_INTERVAL_MS=${MEMORY_MONITOR_INTERVAL_MS:-30000}

# LangSmith Tracing (Optional)
LANGCHAIN_TRACING_V2=${LANGCHAIN_TRACING_V2:-false}
LANGCHAIN_API_KEY=$LANGCHAIN_API_KEY
LANGCHAIN_PROJECT=$LANGCHAIN_PROJECT
LANGCHAIN_ENDPOINT=$LANGCHAIN_ENDPOINT
EOF
    echo 'Environment file created'
"

echo -e "${GREEN}✅ Environment configured${NC}"

# Build the application
echo -e "${YELLOW}[7/8] Building application...${NC}"
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

# Setup PM2 ecosystem file and start application
echo -e "${YELLOW}[8/8] Starting application...${NC}"
gcloud compute ssh "$INSTANCE_NAME" --zone="$ZONE" --command="
    cd ~/receipt-tracker
    cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'receipt-tracker-agent',
    script: 'dist/index.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production'
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
EOF
    
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

# Update instance details file
echo -e "${YELLOW}Updating instance details...${NC}"
./update-instance-details.sh

echo ""
echo -e "${BLUE}=================================================="
echo "Deployment Complete!"
echo -e "==================================================${NC}"
echo ""
echo -e "🚀 Your Receipt Tracker Agent is now running on GCP!"
echo ""
echo -e "📱 ${GREEN}Bot URL:${NC} Start chatting with your Telegram bot"
echo -e "🌐 ${GREEN}Instance IP:${NC} $EXTERNAL_IP"
echo -e "🔗 ${GREEN}Health Check:${NC} http://$EXTERNAL_IP:$APP_PORT (if health endpoint is enabled)"
echo ""
echo -e "${YELLOW}Management Commands:${NC}"
echo "  View logs:     gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --command='pm2 logs'"
echo "  Check status:  gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --command='pm2 status'"
echo "  Restart app:   gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --command='pm2 restart receipt-tracker-agent'"
echo "  Stop app:      gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --command='pm2 stop receipt-tracker-agent'"
echo ""
echo -e "${YELLOW}SSH into instance:${NC}"
echo "  ./manage-instance.sh ssh"
echo ""
echo -e "${YELLOW}Setup logging (optional):${NC}"
echo "  ./setup-logging.sh"
echo ""
echo -e "💡 ${BLUE}Remember:${NC} Monitor your GCP usage to stay within free tier limits!"
echo ""