#!/bin/bash

# Health Check Setup Script
# Adds a simple health check endpoint to the receipt tracker application

set -e

INSTANCE_NAME="free-tier-vm"
ZONE="us-central1-a"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Setting up health check endpoint...${NC}"

# Create a simple health check server file
gcloud compute ssh "$INSTANCE_NAME" --zone="$ZONE" --command="
    cd ~/receipt-tracker
    
    # Create a simple health check script
    cat > health-check.js << 'EOF'
const http = require('http');
const fs = require('fs');

const server = http.createServer((req, res) => {
  if (req.url === '/health' || req.url === '/') {
    // Check if main application is running
    const pm2Status = require('child_process').execSync('pm2 jlist', { encoding: 'utf8' });
    const processes = JSON.parse(pm2Status);
    const receiptTracker = processes.find(p => p.name === 'receipt-tracker-agent');
    
    if (receiptTracker && receiptTracker.pm2_env.status === 'online') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        application: {
          name: 'receipt-tracker-agent',
          status: receiptTracker.pm2_env.status,
          uptime: receiptTracker.pm2_env.pm_uptime,
          restarts: receiptTracker.pm2_env.restart_time
        }
      }));
    } else {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Receipt tracker application is not running'
      }));
    }
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

const PORT = process.env.HEALTH_CHECK_PORT || 3000;
server.listen(PORT, () => {
  console.log(\`Health check server running on port \${PORT}\`);
});
EOF

    # Update PM2 ecosystem to include health check
    cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
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
    },
    {
      name: 'health-check',
      script: 'health-check.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        HEALTH_CHECK_PORT: 3000
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: '~/.pm2/logs/health-check-error.log',
      out_file: '~/.pm2/logs/health-check-out.log',
      time: true,
      autorestart: true,
      max_restarts: 5,
      min_uptime: '5s'
    }
  ]
};
EOF

    # Restart PM2 with new configuration
    pm2 delete all 2>/dev/null || true
    pm2 start ecosystem.config.js
    pm2 save
    
    echo 'Health check endpoint configured'
"

echo -e "${GREEN}✅ Health check endpoint setup complete${NC}"
echo ""
echo "Health check available at:"
echo "  http://\$(gcloud compute instances describe $INSTANCE_NAME --zone=$ZONE --format='value(networkInterfaces[0].accessConfigs[0].natIP)'):3000/health"
echo ""
echo "Test the health check:"
echo "  curl http://\$(gcloud compute instances describe $INSTANCE_NAME --zone=$ZONE --format='value(networkInterfaces[0].accessConfigs[0].natIP)'):3000/health"
echo ""