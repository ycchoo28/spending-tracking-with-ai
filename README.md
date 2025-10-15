# Receipt Tracker Agent

An intelligent receipt and e-wallet transaction tracking agent that processes images sent via Telegram, extracts spending information using vision AI, categorizes expenses, and stores them in Supabase.

## Features

- 📸 Process physical receipt images and e-wallet screenshots
- 🤖 Automatic transaction data extraction using vision AI
- 🏷️ Intelligent expense categorization with confidence scoring
- 💬 Interactive Telegram bot interface
- 🔄 LangGraph-powered workflow orchestration
- 💾 Supabase database storage
- 📊 Spending statistics and analytics

## Project Structure

```
receipt-tracker-agent/
├── src/
│   ├── config/         # Configuration management
│   ├── telegram/       # Telegram bot handlers
│   ├── workflow/       # LangGraph state machine
│   ├── vision/         # Vision API processing
│   ├── categorizer/    # Transaction categorization
│   └── database/       # Supabase client
├── .env.example        # Environment variables template
├── package.json        # Dependencies
└── tsconfig.json       # TypeScript configuration
```

## Setup

### Prerequisites

- Node.js 18+ and npm
- Telegram Bot Token (from [@BotFather](https://t.me/botfather))
- OpenAI API key or compatible API endpoint
- Supabase account and project

### Installation

1. Clone the repository and install dependencies:

```bash
npm install
```

2. Copy `.env.example` to `.env` and configure your environment variables:

```bash
cp .env.example .env
```

3. Edit `.env` with your credentials:

```env
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_API_BASE=https://api.openai.com/v1
SUPABASE_URL=your_supabase_project_url_here
SUPABASE_KEY=your_supabase_anon_key_here
```

### Database Setup

1. Create the required tables in your Supabase project by running the migration scripts:

```bash
# Run the setup script
npm run dev -- setup-database.ts
```

Or manually execute the SQL migrations in `src/database/migrations/` in order:
- `001_create_transactions_table.sql`
- `002_create_user_preferences_table.sql`
- `003_create_category_learning_table.sql`

### Development

Build the project:

```bash
npm run build
```

Run in development mode:

```bash
npm run dev
```

Start the production build:

```bash
npm start
```

Run tests:

```bash
npm test
```

Run end-to-end tests:

```bash
npm run test:e2e
```

See [TESTING-QUICK-START.md](./TESTING-QUICK-START.md) for E2E testing guide.

## Deployment

### Option 1: Docker Deployment (Recommended)

The easiest way to deploy is using Docker:

1. Build the Docker image:

```bash
docker build -t receipt-tracker-agent .
```

2. Run with Docker Compose:

```bash
docker-compose up -d
```

3. View logs:

```bash
docker-compose logs -f receipt-tracker
```

4. Stop the service:

```bash
docker-compose down
```

### Option 2: PM2 Process Manager

For deployment on a VPS or cloud VM:

1. Install PM2 globally:

```bash
npm install -g pm2
```

2. Build the project:

```bash
npm run build
```

3. Start with PM2:

```bash
pm2 start ecosystem.config.js --env production
```

4. Useful PM2 commands:

```bash
# View logs
pm2 logs receipt-tracker-agent

# Monitor
pm2 monit

# Restart
pm2 restart receipt-tracker-agent

# Stop
pm2 stop receipt-tracker-agent

# Save PM2 configuration
pm2 save

# Setup PM2 to start on system boot
pm2 startup
```

### Option 3: Direct Node.js

For simple deployments:

```bash
# Build the project
npm run build

# Start the application
NODE_ENV=production node dist/index.js
```

### Environment Variables

Required environment variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `TELEGRAM_BOT_TOKEN` | Telegram bot token from @BotFather | `123456:ABC-DEF...` |
| `OPENAI_API_KEY` | OpenAI API key or compatible provider | `sk-...` |
| `OPENAI_API_BASE` | API base URL | `https://api.openai.com/v1` |
| `SUPABASE_URL` | Supabase project URL | `https://xxx.supabase.co` |
| `SUPABASE_KEY` | Supabase anon/service key | `eyJ...` |

Optional environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAI_VISION_MODEL` | Vision model name | `gpt-4-vision-preview` |
| `OPENAI_TEXT_MODEL` | Text model name | `gpt-4` |
| `CONFIDENCE_THRESHOLD` | Categorization confidence threshold (0-1) | `0.8` |
| `MAX_RETRIES` | Maximum API retry attempts | `3` |
| `RETRY_DELAY` | Retry delay in milliseconds | `2000` |
| `LOG_LEVEL` | Logging level (error, warn, info, debug) | `info` |
| `NODE_ENV` | Environment (development, production) | `development` |

### Deployment Checklist

- [ ] Set all required environment variables
- [ ] Run database migrations in Supabase
- [ ] Test the bot with `/start` command
- [ ] Send a test receipt image
- [ ] Verify transactions are stored in Supabase
- [ ] Check logs for any errors
- [ ] Set up monitoring and alerts
- [ ] Configure automatic restarts (PM2 or Docker)
- [ ] Set up log rotation
- [ ] Configure firewall rules if needed

### Monitoring and Logs

Logs are stored in the `logs/` directory:
- `error.log` - Error logs only (production)
- `combined.log` - All logs (production)
- Console output with colorized formatting (development)

Log format includes:
- Timestamp
- Log level
- Message
- Structured metadata (user IDs, transaction IDs, performance metrics)

### Troubleshooting

**Bot not responding:**
- Check if the bot token is correct
- Verify the bot is running: `pm2 status` or `docker ps`
- Check logs for errors

**Image processing fails:**
- Verify OpenAI API key is valid
- Check API endpoint is accessible
- Ensure image is clear and readable

**Database errors:**
- Verify Supabase credentials
- Check if migrations have been run
- Ensure network connectivity to Supabase

**High memory usage:**
- Adjust PM2 `max_memory_restart` setting
- Check for memory leaks in logs
- Consider scaling horizontally

## Technologies

- **LangChain.js** - LLM application framework
- **LangGraph** - State machine orchestration
- **Telegraf** - Telegram Bot API wrapper
- **Supabase** - Database and storage
- **Sharp** - Image processing
- **TypeScript** - Type-safe development
- **Winston** - Structured logging
- **Docker** - Containerization
- **PM2** - Process management

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

ISC
