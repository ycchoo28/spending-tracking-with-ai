# Deployment Guide

This guide provides detailed instructions for deploying the Receipt Tracker Agent in various environments.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Deployment Options](#deployment-options)
  - [Docker Deployment](#docker-deployment)
  - [PM2 Deployment](#pm2-deployment)
  - [Cloud Platform Deployment](#cloud-platform-deployment)
- [Post-Deployment](#post-deployment)
- [Monitoring and Maintenance](#monitoring-and-maintenance)
- [Scaling](#scaling)
- [Security Best Practices](#security-best-practices)

## Prerequisites

Before deploying, ensure you have:

1. **Telegram Bot Token**
   - Create a bot via [@BotFather](https://t.me/botfather)
   - Save the bot token

2. **OpenAI API Access**
   - Sign up for OpenAI API or compatible provider
   - Obtain API key and endpoint URL

3. **Supabase Project**
   - Create a project at [supabase.com](https://supabase.com)
   - Note your project URL and anon/service key
   - Run database migrations (see Database Setup below)

4. **Server/Hosting**
   - VPS (DigitalOcean, AWS EC2, etc.) with Node.js 18+
   - Or Docker-compatible hosting
   - Minimum 512MB RAM, 1 CPU core

## Database Setup

Before deploying, set up your Supabase database:

1. Navigate to your Supabase project's SQL Editor

2. Run the migrations in order:

```sql
-- 001_create_transactions_table.sql
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    telegram_user_id TEXT NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'MYR',
    merchant_name TEXT NOT NULL,
    category TEXT NOT NULL,
    date_time TIMESTAMP WITH TIME ZONE NOT NULL,
    payment_method TEXT,
    transaction_reference TEXT,
    image_url TEXT,
    raw_extracted_data JSONB,
    confidence_score DECIMAL(3, 2),
    user_corrected BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_telegram_user_id ON transactions(telegram_user_id);
CREATE INDEX idx_transactions_merchant_name ON transactions(merchant_name);
CREATE INDEX idx_transactions_category ON transactions(category);
CREATE INDEX idx_transactions_date_time ON transactions(date_time DESC);

-- 002_create_user_preferences_table.sql
CREATE TABLE user_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    telegram_user_id TEXT UNIQUE NOT NULL,
    default_currency TEXT DEFAULT 'MYR',
    timezone TEXT DEFAULT 'Asia/Kuala_Lumpur',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 003_create_category_learning_table.sql
CREATE TABLE category_learning (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    merchant_name TEXT NOT NULL,
    category TEXT NOT NULL,
    frequency INT DEFAULT 1,
    last_used TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, merchant_name, category)
);

CREATE INDEX idx_category_learning_user_merchant ON category_learning(user_id, merchant_name);
```

## Deployment Options

### Docker Deployment

**Best for:** Production environments, easy scaling, consistent deployments

#### Step 1: Prepare Environment

Create a `.env` file with your configuration:

```bash
TELEGRAM_BOT_TOKEN=your_bot_token
OPENAI_API_KEY=your_api_key
OPENAI_API_BASE=https://api.openai.com/v1
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_supabase_key
NODE_ENV=production
LOG_LEVEL=info
```

#### Step 2: Build and Run

```bash
# Build the image
docker build -t receipt-tracker-agent .

# Run with docker-compose (recommended)
docker-compose up -d

# Or run directly
docker run -d \
  --name receipt-tracker \
  --env-file .env \
  -v $(pwd)/logs:/app/logs \
  --restart unless-stopped \
  receipt-tracker-agent
```

#### Step 3: Verify Deployment

```bash
# Check container status
docker ps

# View logs
docker logs -f receipt-tracker

# Or with docker-compose
docker-compose logs -f
```

#### Step 4: Manage the Container

```bash
# Stop
docker-compose down

# Restart
docker-compose restart

# Update (rebuild and restart)
docker-compose up -d --build

# View resource usage
docker stats receipt-tracker
```

### PM2 Deployment

**Best for:** VPS deployments, traditional server setups

#### Step 1: Install Dependencies

```bash
# Install Node.js 18+ (if not already installed)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 globally
sudo npm install -g pm2

# Clone and setup project
git clone <your-repo-url>
cd receipt-tracker-agent
npm install
```

#### Step 2: Configure Environment

```bash
# Create .env file
cp .env.example .env
nano .env  # Edit with your credentials
```

#### Step 3: Build and Start

```bash
# Build the project
npm run build

# Start with PM2
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
# Follow the instructions printed by the command
```

#### Step 4: Verify and Monitor

```bash
# Check status
pm2 status

# View logs
pm2 logs receipt-tracker-agent

# Monitor in real-time
pm2 monit

# View detailed info
pm2 info receipt-tracker-agent
```

#### Step 5: Manage the Process

```bash
# Restart
pm2 restart receipt-tracker-agent

# Stop
pm2 stop receipt-tracker-agent

# Delete from PM2
pm2 delete receipt-tracker-agent

# Reload (zero-downtime restart)
pm2 reload receipt-tracker-agent
```

### Cloud Platform Deployment

#### AWS EC2

1. Launch an EC2 instance (t3.micro or larger)
2. Install Node.js and PM2
3. Follow PM2 deployment steps above
4. Configure security group to allow outbound HTTPS
5. Set up CloudWatch for monitoring

#### DigitalOcean Droplet

1. Create a Droplet (Basic plan, 1GB RAM)
2. SSH into the droplet
3. Follow PM2 deployment steps above
4. Set up DigitalOcean monitoring

#### Google Cloud Run (Docker)

1. Build and push Docker image to Google Container Registry
2. Deploy to Cloud Run
3. Set environment variables in Cloud Run console
4. Configure to allow all traffic

#### Heroku

1. Create a new Heroku app
2. Add buildpack: `heroku/nodejs`
3. Set environment variables via Heroku dashboard
4. Deploy via Git:

```bash
git push heroku main
```

## Post-Deployment

### 1. Test the Bot

```bash
# Send /start command to your bot
# Send a test receipt image
# Verify transaction is stored in Supabase
```

### 2. Configure Logging

```bash
# Create logs directory
mkdir -p logs

# Set up log rotation (Linux)
sudo nano /etc/logrotate.d/receipt-tracker
```

Add:
```
/path/to/receipt-tracker-agent/logs/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 0644 nodejs nodejs
}
```

### 3. Set Up Monitoring

**PM2 Monitoring:**
```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

**Docker Monitoring:**
- Use Docker stats: `docker stats`
- Set up Prometheus + Grafana
- Use cloud provider monitoring tools

### 4. Configure Alerts

Set up alerts for:
- High error rates
- Memory usage > 80%
- Process crashes
- API failures

## Monitoring and Maintenance

### Health Checks

The application logs key events:
- Image received
- Extraction complete
- Categorization
- Storage
- Errors

Monitor these in your logs.

### Performance Metrics

Track:
- Processing time per image
- API call duration
- Success/failure rates
- Memory usage
- CPU usage

### Regular Maintenance

**Daily:**
- Check error logs
- Monitor resource usage

**Weekly:**
- Review performance metrics
- Check for failed transactions
- Update dependencies if needed

**Monthly:**
- Rotate logs
- Review and optimize database queries
- Update Node.js and dependencies
- Review API usage and costs

### Backup Strategy

**Database:**
- Supabase provides automatic backups
- Consider additional backups for critical data

**Configuration:**
- Keep `.env` file backed up securely
- Version control your code

## Scaling

### Vertical Scaling

Increase server resources:
- More RAM (if memory usage is high)
- More CPU cores (if processing is slow)

### Horizontal Scaling

For high traffic:
1. Run multiple instances behind a load balancer
2. Use Redis for shared state (if needed)
3. Consider serverless options for burst traffic

### Database Optimization

- Add indexes for frequently queried columns
- Use connection pooling
- Consider read replicas for analytics

## Security Best Practices

### 1. Environment Variables

- Never commit `.env` to version control
- Use secrets management (AWS Secrets Manager, etc.)
- Rotate API keys regularly

### 2. Network Security

- Use HTTPS for all API calls
- Configure firewall rules
- Limit SSH access
- Use VPN for sensitive operations

### 3. Application Security

- Keep dependencies updated
- Run security audits: `npm audit`
- Use Supabase Row Level Security (RLS)
- Validate all user inputs
- Rate limit API calls

### 4. Access Control

- Use least privilege principle
- Separate development and production environments
- Use different API keys for each environment
- Implement proper logging and auditing

### 5. Monitoring

- Set up intrusion detection
- Monitor for unusual API usage
- Track failed authentication attempts
- Alert on suspicious patterns

## Troubleshooting

### Bot Not Starting

```bash
# Check logs
pm2 logs receipt-tracker-agent --lines 100

# Or for Docker
docker logs receipt-tracker --tail 100

# Common issues:
# - Missing environment variables
# - Invalid API keys
# - Network connectivity issues
```

### High Memory Usage

```bash
# Check memory usage
pm2 monit

# Restart if needed
pm2 restart receipt-tracker-agent

# Adjust max memory in ecosystem.config.js
# max_memory_restart: '500M'
```

### Database Connection Issues

- Verify Supabase credentials
- Check network connectivity
- Ensure migrations have been run
- Check Supabase service status

### API Rate Limits

- Monitor API usage in logs
- Adjust retry settings
- Consider upgrading API plan
- Implement request queuing

## Support

For issues and questions:
- Check logs first
- Review this deployment guide
- Check GitHub issues
- Contact support

## Changelog

Track deployment versions and changes:
- Document configuration changes
- Note dependency updates
- Record migration history
- Keep deployment notes
