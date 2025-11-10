# Receipt Tracker Agent

An intelligent receipt and e-wallet transaction tracking agent that processes images sent via Telegram, extracts spending information using vision AI, categorizes expenses, and stores them in Supabase.

## Features

- 📸 Process physical receipt images and e-wallet screenshots
- 🤖 Automatic transaction data extraction using vision AI
- 🏷️ Intelligent expense categorization with confidence scoring
- 💬 Interactive Telegram bot interface with multi-turn conversations
- 🔄 LangGraph-powered adaptive agent workflow (v2)
- 🧠 Supervisor agent pattern with specialized sub-agents
- 💾 Supabase database storage with PostgreSQL checkpointing
- 🔁 Context injection for real-time user input during processing
- 📊 Spending statistics and analytics

## Project Structure

```
receipt-tracker-agent/
├── src/
│   ├── features/                    # Feature modules
│   │   └── receipt-processing/      # Receipt processing feature
│   │       ├── _archive_v1/         # v1 fixed workflow (archived)
│   │       ├── main-agent/          # v2 Main conversation agent
│   │       ├── transaction-agent/   # v2 Transaction sub-agent
│   │       ├── categorizer/         # Transaction categorization
│   │       ├── vision/              # Image processing & OCR
│   │       └── orchestrator.ts      # v2 Conversation orchestrator
│   ├── core/                        # Core infrastructure
│   │   ├── config/                  # Configuration management
│   │   ├── database/                # Database client
│   │   ├── conversation/            # Conversation lifecycle management
│   │   ├── checkpointing/           # PostgreSQL checkpointing
│   │   ├── messaging/               # Messaging adapters (Telegram)
│   │   └── utils/                   # Shared utilities
│   └── index.ts                     # Main entry point
├── supabase/                        # Supabase configuration
│   ├── migrations/                  # Database migrations
│   └── seed.sql                     # Seed data
├── .kiro/                           # Kiro IDE configuration
│   └── specs/                       # Feature specifications
│       └── multi-turn-agent-loop/   # v2 agent loop specs
├── docs/                            # Documentation
│   ├── architecture/                # Architecture diagrams and docs
│   ├── guides/                      # User guides
│   ├── summaries/                   # Feature summaries
│   └── CONVERSATION-LIFECYCLE.md    # Conversation management guide
├── tests/                           # Test scripts and utilities
│   ├── langsmith/                   # LangSmith trace analysis tools
│   │   ├── analyze-trace.ts         # Detailed trace analyzer
│   │   ├── fetch-trace.ts           # Trace fetching utility
│   │   └── trace-summary.ts         # Trace summarization tool
│   ├── test-*.ts                    # Test scripts
│   └── README.md                    # Test documentation
├── .env.example                     # Environment variables template
├── package.json                     # Dependencies
└── tsconfig.json                    # TypeScript configuration
```

See [src/features/receipt-processing/README_V2.md](src/features/receipt-processing/README_V2.md) for v2 architecture details.

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

#### Local Development (Supabase CLI)

1. Install Supabase CLI:
```bash
brew install supabase/tap/supabase
```

2. Start local Supabase:
```bash
supabase start
```

3. Migrations are automatically applied. Check status:
```bash
supabase status
```

#### Production (Remote Supabase)

Migrations in `supabase/migrations/` are automatically applied when you push to your Supabase project:

- `20241021000001_initial_schema.sql` - Base tables (transactions, user_preferences, etc.)
- `20241022000001_agent_loop_v2_schema.sql` - v2 agent loop tables (conversations, checkpoints, messages)

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

Run specific test scripts:

```bash
# Multi-turn clarification test
npx tsx tests/test-multi-turn-clarification.ts

# Orchestrator multi-turn test
npx tsx tests/test-orchestrator-multi-turn.ts

# Agent loop v2 test
npx tsx tests/test-agent-loop-v2.ts
```

See [docs/guides/](./docs/guides/) for testing guides.

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

| Variable             | Description                           | Example                     |
| -------------------- | ------------------------------------- | --------------------------- |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token from @BotFather    | `123456:ABC-DEF...`         |
| `OPENAI_API_KEY`     | OpenAI API key or compatible provider | `sk-...`                    |
| `OPENAI_API_BASE`    | API base URL                          | `https://api.openai.com/v1` |
| `SUPABASE_URL`       | Supabase project URL                  | `https://xxx.supabase.co`   |
| `SUPABASE_KEY`       | Supabase anon/service key             | `eyJ...`                    |

Optional environment variables:

| Variable                            | Description                               | Default                |
| ----------------------------------- | ----------------------------------------- | ---------------------- |
| `OPENAI_VISION_MODEL`               | Vision model name                         | `gpt-4-vision-preview` |
| `OPENAI_TEXT_MODEL`                 | Text model name                           | `gpt-4`                |
| `CONFIDENCE_THRESHOLD`              | Categorization confidence threshold (0-1) | `0.8`                  |
| `MAX_RETRIES`                       | Maximum API retry attempts                | `3`                    |
| `RETRY_DELAY`                       | Retry delay in milliseconds               | `2000`                 |
| `LOG_LEVEL`                         | Logging level (error, warn, info, debug)  | `info`                 |
| `NODE_ENV`                          | Environment (development, production)     | `development`          |
| **v2 Agent Loop Configuration:**    |                                           |                        |
| `CONVERSATION_EXPIRATION_HOURS`     | Conversation expiration time              | `24`                   |
| `MAX_CONVERSATION_HISTORY`          | Max messages in conversation history      | `20`                   |
| `CATEGORY_CONFIDENCE_THRESHOLD`     | Category auto-accept threshold            | `0.8`                  |
| `EXTRACTION_CONFIDENCE_THRESHOLD`   | Extraction quality threshold              | `0.3`                  |
| `AGENT_LLM_MODEL`                   | LLM model for agents                      | `gpt-4o-mini`          |
| `AGENT_LLM_TEMPERATURE`             | LLM temperature for agents                | `0.7`                  |
| `AGENT_LLM_MAX_TOKENS`              | Max tokens for agent responses            | `50000`                |
| `LANGCHAIN_TRACING_V2`              | Enable LangSmith tracing                  | `false`                |
| `LANGCHAIN_API_KEY`                 | LangSmith API key                         | -                      |
| `LANGCHAIN_PROJECT`                 | LangSmith project name                    | -                      |

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

## Architecture (v2)

The system uses a **supervisor agent pattern** with multi-turn conversation support:

- **Main Conversation Agent**: Analyzes user intent, manages conversation flow, routes to sub-agents
- **Transaction Sub-Agent**: Processes receipts with adaptive decision-making (no hard-coded logic)
- **Conversation Orchestrator**: Handles message routing and manages conversation lifecycle
- **Conversation Manager**: Tracks active conversations, handles expiration and cleanup
- **PostgreSQL Checkpointing**: Persists conversation state for resumption and debugging

Key features:
- **Multi-turn conversations**: Users can provide information incrementally across multiple messages
- **Conversation persistence**: Same conversation reused until completed or expired (24 hours)
- **Adaptive workflow**: LLM-based decision node determines next action dynamically
- **Intelligent validation**: Prioritizes critical fields (merchant, amount) before optional ones
- **Automatic cleanup**: Expired conversations and checkpoints cleaned up every 6 hours

See [src/features/receipt-processing/README_V2.md](src/features/receipt-processing/README_V2.md) for detailed architecture and [docs/CONVERSATION-LIFECYCLE.md](docs/CONVERSATION-LIFECYCLE.md) for conversation management details.

## Technologies

- **LangChain.js** - LLM application framework
- **LangGraph** - State machine orchestration with checkpointing
- **Telegraf** - Telegram Bot API wrapper
- **Supabase** - PostgreSQL database and storage
- **Sharp** - Image processing
- **TypeScript** - Type-safe development
- **Winston** - Structured logging
- **Docker** - Containerization
- **PM2** - Process management

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

ISC
