# Receipt Tracker Agent - System Architecture

## Overview

The Receipt Tracker Agent is a multi-turn conversational AI system that processes receipt images and e-wallet transactions via Telegram. It uses a supervisor agent pattern with LangGraph for adaptive workflow orchestration and PostgreSQL for state persistence.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         User Interface Layer                         │
│                                                                       │
│  ┌──────────────┐                                                    │
│  │   Telegram   │  User sends receipt image or text message          │
│  │     Bot      │  ──────────────────────────────────────────►       │
│  └──────────────┘                                                    │
└───────────────────────────────────┬─────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Messaging Adapter Layer                         │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────┐       │
│  │           TelegramAdapter (telegram-adapter.ts)          │       │
│  │  • Handles Telegram Bot API                              │       │
│  │  • Converts messages to UserContext                      │       │
│  │  • Routes to onMessage callback                          │       │
│  └──────────────────────────────────────────────────────────┘       │
└───────────────────────────────────┬─────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Orchestration Layer (v2)                          │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────┐       │
│  │      ConversationOrchestrator (orchestrator.ts)          │       │
│  │  • Routes messages to Main Agent                         │       │
│  │  • Manages conversation lifecycle                        │       │
│  │  • Handles agent invocations                             │       │
│  │  • Tracks active sub-agents                              │       │
│  └──────────────────────────────────────────────────────────┘       │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────┐       │
│  │    ConversationManager (conversation-manager.ts)         │       │
│  │  • Creates/retrieves conversations                       │       │
│  │  • Tracks conversation status & activity                 │       │
│  │  • Expires inactive conversations (24h)                  │       │
│  │  • Cleanup job (every 6 hours)                           │       │
│  └──────────────────────────────────────────────────────────┘       │
└───────────────────────────────────┬─────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Agent Layer (LangGraph)                         │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────┐       │
│  │         Main Conversation Agent (main-agent.ts)          │       │
│  │                                                           │       │
│  │  Nodes:                                                   │       │
│  │  1. analyze_intent      → Classify user intent           │       │
│  │  2. handle_command      → Process system commands        │       │
│  │  3. handle_general      → General conversation           │       │
│  │  4. route_to_transaction → Prepare transaction state     │       │
│  │  5. invoke_transaction_agent → Call sub-agent            │       │
│  │  6. update_history      → Update conversation log        │       │
│  │                                                           │       │
│  │  Flow:                                                    │       │
│  │  START → analyze_intent → [intent routing]               │       │
│  │           ├─ transaction → route_to_transaction          │       │
│  │           ├─ general → handle_general                    │       │
│  │           └─ command → handle_command                    │       │
│  │                                                           │       │
│  │  If activeSubAgent='transaction':                        │       │
│  │    → invoke_transaction_agent (continue existing flow)   │       │
│  └──────────────────────────────────────────────────────────┘       │
│                                    │                                 │
│                                    ▼                                 │
│  ┌──────────────────────────────────────────────────────────┐       │
│  │      Transaction Sub-Agent (transaction-agent.ts)        │       │
│  │                                                           │       │
│  │  Nodes:                                                   │       │
│  │  1. extract_if_needed    → Extract from image (once)     │       │
│  │  2. apply_user_context   → Apply user corrections        │       │
│  │  3. validate_fields      → Check merchant/amount/category│       │
│  │  4. agent_decide_action  → Decide next step              │       │
│  │  5. request_merchant     → Ask for merchant              │       │
│  │  6. request_amount       → Ask for amount                │       │
│  │  7. request_category     → Ask for category              │       │
│  │  8. categorize           → Auto-categorize               │       │
│  │  9. store_transaction    → Save to database              │       │
│  │  10. request_better_image → Ask for clearer photo        │       │
│  │                                                           │       │
│  │  Flow:                                                    │       │
│  │  START → extract_if_needed → apply_user_context          │       │
│  │       → validate_fields → agent_decide_action            │       │
│  │                                                           │       │
│  │  Decision routing (deterministic):                       │       │
│  │  • Low confidence + multiple missing → request_better_image│     │
│  │  • Merchant missing/invalid → request_merchant           │       │
│  │  • Amount missing/invalid → request_amount               │       │
│  │  • Category missing → categorize                         │       │
│  │  • Category needs confirmation → request_category        │       │
│  │  • All valid → store_transaction                         │       │
│  └──────────────────────────────────────────────────────────┘       │
└───────────────────────────────────┬─────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Processing Layer                                │
│                                                                       │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │ VisionProcessor  │  │TransactionCategorizer│ │ DatabaseClient │  │
│  │                  │  │                  │  │                  │  │
│  │ • Extract data   │  │ • Auto-categorize│  │ • Store txn      │  │
│  │   from images    │  │ • Confidence     │  │ • User prefs     │  │
│  │ • OCR + Vision   │  │   scoring        │  │ • History        │  │
│  │   LLM            │  │ • Suggestions    │  │                  │  │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘  │
└───────────────────────────────────┬─────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Persistence Layer                               │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────┐       │
│  │              Supabase (PostgreSQL)                       │       │
│  │                                                           │       │
│  │  Tables:                                                  │       │
│  │  • conversations       → Conversation metadata           │       │
│  │  • conversation_messages → Message history               │       │
│  │  • checkpoints         → LangGraph state (MemorySaver)   │       │
│  │  • transactions        → Transaction records             │       │
│  │  • user_preferences    → User settings & categories      │       │
│  │  • category_history    → Category learning data          │       │
│  └──────────────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────────────┘
```

## System Flow

### 1. Message Reception Flow

```
User sends message/image
    ↓
TelegramAdapter receives update
    ↓
Creates UserContext (userId, chatId, metadata)
    ↓
Calls onMessage callback
    ↓
ConversationOrchestrator.handleMessage()
```

### 2. Conversation Management Flow

```
Orchestrator receives message
    ↓
Check for active conversations (ConversationManager)
    ├─ Active conversation exists → Reuse conversationId
    └─ No active conversation → Create new conversationId
    ↓
Update conversation activity timestamp
    ↓
Increment turn count
    ↓
Prepare initial state with conversationId
```

### 3. Main Agent Execution Flow

```
Main Agent invoked with thread_id = conversationId
    ↓
analyze_intent node
    ├─ Analyzes user message + conversation history
    ├─ Classifies intent: transaction | general | command
    └─ Returns intent
    ↓
Conditional routing based on intent & activeSubAgent
    ├─ activeSubAgent='transaction' → invoke_transaction_agent
    ├─ intent='transaction' → route_to_transaction
    ├─ intent='general' → handle_general
    └─ intent='command' → handle_command
    ↓
update_history node
    ├─ Adds user message to history
    ├─ Adds assistant response to history
    └─ Limits to 20 most recent messages
    ↓
END (state saved to checkpoint)
```

### 4. Transaction Sub-Agent Flow

#### First Invocation (New Receipt)

```
route_to_transaction node
    ├─ Extracts image data from state
    ├─ Creates subAgentThreadId
    └─ Initializes subAgentState
    ↓
invoke_transaction_agent node
    ↓
Transaction Agent START
    ↓
extract_if_needed
    ├─ Checks if extraction already done
    ├─ If image present & not extracted → VisionProcessor.extractTransactionData()
    └─ Returns extractedData
    ↓
apply_user_context
    ├─ If user provided text → LLM extracts updates
    └─ Merges updates into extractedData
    ↓
validate_fields
    ├─ Checks merchant: missing | invalid | valid
    ├─ Checks amount: missing | invalid | valid
    └─ Checks category: missing | valid
    ↓
agent_decide_action (deterministic logic)
    ├─ Low confidence + multiple missing → request_better_image
    ├─ Merchant invalid → request_merchant
    ├─ Amount invalid → request_amount
    ├─ Category missing → categorize
    └─ All valid → store_transaction
    ↓
[Action node executes]
    ├─ request_* nodes → Set responseMessage, completed=false
    ├─ categorize → TransactionCategorizer.categorize()
    │   ├─ High confidence (>0.8) → Accept category
    │   └─ Low confidence → Set nextAction='request_category'
    └─ store_transaction → DatabaseClient.storeTransaction()
        ├─ Success → Set transactionId, completed=true
        └─ Error → Set error, completed=false
    ↓
END (returns result to Main Agent)
```

#### Subsequent Invocations (User Provides Info)

```
User sends: "Starbucks"
    ↓
Main Agent analyze_intent
    ├─ Sees activeSubAgent='transaction'
    └─ Routes to invoke_transaction_agent
    ↓
Transaction Agent invoked with same subAgentThreadId
    ↓
extract_if_needed
    └─ Skips (already extracted)
    ↓
apply_user_context
    ├─ LLM extracts: {"merchantName": "Starbucks"}
    └─ Updates extractedData.merchantName = "Starbucks"
    ↓
validate_fields
    └─ merchant: valid, amount: valid, category: missing
    ↓
agent_decide_action
    └─ Decision: categorize
    ↓
categorize
    ├─ TransactionCategorizer.categorize()
    └─ Returns category with confidence
    ↓
validate_fields (loop back)
    └─ All fields valid
    ↓
agent_decide_action
    └─ Decision: store_transaction
    ↓
store_transaction
    ├─ Saves to database
    └─ Returns success, completed=true
    ↓
Main Agent invoke_transaction_agent node
    ├─ Sees result.completed=true
    └─ Clears activeSubAgent (conversation ends)
```

### 5. Error Handling Flow

```
Error occurs in any node
    ↓
Node returns { error: "message", completed: false }
    ↓
invoke_transaction_agent node
    ├─ Detects result.error exists
    ├─ Clears activeSubAgent (prevents infinite loop)
    └─ Returns error message to user
    ↓
Conversation ends cleanly
```

### 6. Conversation Cleanup Flow

```
ConversationManager.startCleanupJob() (every 6 hours)
    ↓
expireInactiveConversations()
    ├─ Finds conversations with last_activity_at > 24 hours
    └─ Updates status to 'expired'
    ↓
cleanupExpiredCheckpoints()
    ├─ Finds checkpoints with created_at > 24 hours
    └─ Deletes from database
```

## Key Components

### 1. Main Entry Point (`src/index.ts`)

**Responsibilities:**
- Initializes all system components
- Sets up graceful shutdown handlers
- Starts memory monitoring
- Launches messaging adapter

**Initialization Order:**
1. DatabaseClient
2. VisionProcessor
3. TransactionCategorizer
4. LLM (ChatOpenAI)
5. PostgreSQL Checkpointer
6. Transaction Sub-Agent
7. Main Conversation Agent
8. ConversationManager
9. ConversationOrchestrator
10. TelegramAdapter

### 2. Conversation Orchestrator (`orchestrator.ts`)

**Responsibilities:**
- Routes user messages to Main Agent
- Manages conversation ID lifecycle
- Updates conversation activity
- Tracks active sub-agents
- Handles agent invocation errors

**Key Methods:**
- `handleMessage()` - Main entry point for user messages
- `executeAgent()` - Invokes Main Agent with state
- `getOrCreateConversation()` - Retrieves or creates conversation

### 3. Conversation Manager (`conversation-manager.ts`)

**Responsibilities:**
- CRUD operations for conversations
- Tracks conversation status (active, completed, expired, cancelled)
- Manages conversation expiration (24 hours)
- Runs cleanup jobs (every 6 hours)
- Updates turn counts and activity timestamps

**Database Tables:**
- `conversations` - Conversation metadata
- `conversation_messages` - Message history (not currently used)
- `checkpoints` - LangGraph state persistence

### 4. Main Conversation Agent (`main-agent/`)

**State Schema:**
```typescript
{
  conversationId: string
  userId: string
  chatId: number
  createdAt: string
  lastActivityAt: string
  conversationHistory: Message[]
  currentUserMessage: string
  currentImageData: Buffer | null
  currentIntent: 'transaction' | 'general' | 'command' | null
  activeSubAgent: 'transaction' | null
  subAgentState: any
  subAgentThreadId: string | null
  responseMessage: string
}
```

**Nodes:**
1. `analyze_intent` - LLM classifies user intent
2. `handle_command` - Processes help, cancel, status commands
3. `handle_general` - General conversation with LLM
4. `route_to_transaction` - Prepares transaction sub-agent state
5. `invoke_transaction_agent` - Invokes sub-agent, handles result
6. `update_history` - Adds messages to conversation history

### 5. Transaction Sub-Agent (`transaction-agent/`)

**State Schema:**
```typescript
{
  conversationId: string
  userId: string
  chatId: number
  imageData: Buffer | null
  userProvidedContext: string
  extractedData: {
    merchantName: string
    amount: number
    currency: string
    dateTime: string
    paymentMethod: string
    transactionReference: string
    category: string
    confidence: number
  }
  validationStatus: {
    merchant: 'missing' | 'invalid' | 'valid'
    amount: 'missing' | 'invalid' | 'valid'
    category: 'missing' | 'valid'
  }
  nextAction: string
  agentReasoning: string
  suggestedCategories: string[]
  categoryConfidence: number
  responseMessage: string
  transactionId: string | null
  completed: boolean
  error: string | null
  retryCount: number
}
```

**Nodes:**
1. `extract_if_needed` - Extracts data from image (once only)
2. `apply_user_context` - LLM extracts updates from user text
3. `validate_fields` - Validates merchant, amount, category
4. `agent_decide_action` - Deterministic decision logic
5. `request_merchant` - Asks user for merchant name
6. `request_amount` - Asks user for amount
7. `request_category` - Asks user to select category
8. `categorize` - Auto-categorizes with confidence scoring
9. `store_transaction` - Saves to database
10. `request_better_image` - Asks for clearer photo

**Decision Priority:**
1. Image quality check (confidence < 0.3 + multiple missing)
2. Merchant validation (critical)
3. Amount validation (critical)
4. Category validation (optional, auto-categorize)
5. Store transaction (all valid)

### 6. Vision Processor (`vision/vision-processor.ts`)

**Responsibilities:**
- Extracts transaction data from receipt images
- Uses OpenAI Vision API (gpt-4-vision-preview)
- Returns structured transaction data with confidence score

**Output:**
```typescript
{
  merchantName: string
  amount: number
  currency: string
  dateTime: string
  paymentMethod: string
  transactionReference: string
  category: string
  confidence: number
}
```

### 7. Transaction Categorizer (`categorizer/categorizer.ts`)

**Responsibilities:**
- Auto-categorizes transactions using LLM
- Learns from user's category history
- Provides confidence scores
- Suggests alternative categories

**Process:**
1. Fetch user's category history from database
2. Build prompt with transaction details + history
3. LLM predicts category with confidence
4. Return category, confidence, suggestions

### 8. Database Client (`core/database/database.ts`)

**Responsibilities:**
- Supabase client wrapper
- Transaction CRUD operations
- User preferences management
- Category history tracking

**Key Methods:**
- `storeTransaction()` - Saves transaction record
- `getUserCategoryHistory()` - Retrieves user's past categories
- `updateUserPreferences()` - Updates user settings

## State Management

### Checkpointing Strategy

**Current Implementation (v2):**
- Uses `MemorySaver` (in-memory only)
- State lost on application restart
- Checkpoints saved after each node execution
- Thread ID = `conversationId` for Main Agent
- Thread ID = `subAgentThreadId` for Transaction Agent

**Known Limitation:**
- Multi-turn conversations currently broken
- New `conversationId` generated each invocation (different timestamp)
- Checkpoints never reused across invocations
- Works within single invocation only

**Future Fix:**
- Track `conversationId` per user (not generate new each time)
- Reuse same `thread_id` for subsequent messages
- Implement conversation session management
- Migrate to PostgreSQL checkpointer (pending dependency upgrade)

### Conversation Lifecycle

**States:**
- `active` - Currently in progress
- `completed` - Successfully finished
- `expired` - Inactive for 24+ hours
- `cancelled` - User cancelled

**Transitions:**
```
active → completed (transaction stored, no active sub-agent)
active → expired (24 hours of inactivity)
active → cancelled (user sends /cancel command)
```

## Configuration

### Environment Variables

**Required:**
- `TELEGRAM_BOT_TOKEN` - Telegram bot token
- `OPENAI_API_KEY` - OpenAI API key
- `OPENAI_API_BASE` - API base URL
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_KEY` - Supabase anon/service key

**Agent Loop (v2):**
- `CONVERSATION_EXPIRATION_HOURS` - Default: 24
- `MAX_CONVERSATION_HISTORY` - Default: 20
- `CATEGORY_CONFIDENCE_THRESHOLD` - Default: 0.8
- `EXTRACTION_CONFIDENCE_THRESHOLD` - Default: 0.3
- `AGENT_LLM_MODEL` - Default: gpt-4o-mini
- `AGENT_LLM_TEMPERATURE` - Default: 0.7
- `AGENT_LLM_MAX_TOKENS` - Default: 50000

**Tracing:**
- `LANGCHAIN_TRACING_V2` - Enable LangSmith tracing
- `LANGCHAIN_API_KEY` - LangSmith API key
- `LANGCHAIN_PROJECT` - LangSmith project name

## Performance Characteristics

### Target Latencies
- Intent analysis: < 2 seconds
- Transaction extraction: < 5 seconds
- Agent decision: < 2 seconds
- End-to-end transaction: < 15 seconds

### Resource Usage
- Memory: ~200-300 MB baseline
- Memory monitoring: Every 30 seconds (configurable)
- Conversation cleanup: Every 6 hours
- Checkpoint cleanup: Every 6 hours

## Known Issues & Limitations

### Current Limitations
1. **Multi-turn conversations broken**: New `conversationId` generated each invocation
2. **MemorySaver only**: Checkpoints stored in memory, lost on restart
3. **Single language**: English only
4. **No conversation summarization**: Long conversations truncated to 20 messages
5. **No internal agent loops**: Each user message requires new invocation

### Fixed Issues
- ✅ v2.2: Removed unused context injection and continuation features
- ✅ v2.1: Fixed infinite loop when transaction storage fails
- ✅ v2.0: Replaced fixed workflow with adaptive agent loop

## Future Enhancements

1. **Fix multi-turn conversations**: Implement proper conversation session management
2. **PostgreSQL checkpointer**: Migrate from MemorySaver to PostgresSaver
3. **Additional sub-agents**: Analytics, reports, budget tracking
4. **Conversation summarization**: For long conversation histories
5. **Multi-language support**: Chinese, Malay, etc.
6. **Voice input**: Speech-to-text integration
7. **Batch processing**: Multiple receipts at once
8. **Advanced analytics**: Spending insights, trends, predictions
9. **Budget alerts**: Notifications when approaching limits

## Testing

### Test Scripts
- `tests/test-multi-turn-clarification.ts` - Multi-turn flow testing
- `tests/test-orchestrator-multi-turn.ts` - Orchestrator testing
- `tests/test-agent-loop-v2.ts` - Agent loop testing
- `tests/analyze-trace.ts` - LangSmith trace analyzer
- `tests/fetch-trace.ts` - Trace fetching utility

### Debugging
- Enable LangSmith tracing for detailed execution traces
- Check logs for node execution and decision reasoning
- Use `[NodeName]` prefixes in logs for easy filtering
- Monitor memory usage with MemoryMonitor

## Deployment

### Options
1. **Docker** (Recommended) - `docker-compose up -d`
2. **PM2** - `pm2 start ecosystem.config.js`
3. **Direct Node.js** - `node dist/index.js`

### Monitoring
- Logs: `logs/error.log`, `logs/combined.log`
- PM2: `pm2 logs`, `pm2 monit`
- Docker: `docker-compose logs -f`

### Health Checks
- Bot responds to `/start` command
- Receipt processing completes successfully
- Transactions stored in Supabase
- No errors in logs

## References

- [README.md](../../README.md) - Project overview and setup
- [README_V2.md](../../src/features/receipt-processing/README_V2.md) - v2 architecture details
- [conversation-flow-diagram.md](./conversation/conversation-flow-diagram.md) - Conversation flow visualization
- [LangGraph Documentation](https://langchain-ai.github.io/langgraph/) - State machine framework
- [Supabase Documentation](https://supabase.com/docs) - Database and storage
