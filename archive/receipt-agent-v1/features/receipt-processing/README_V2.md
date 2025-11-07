# Agent Loop v2 - Multi-Turn Conversation System

## Overview

The Agent Loop v2 is a complete rewrite of the receipt processing system, transforming it from a single-turn fixed workflow into a multi-turn conversational system with adaptive decision-making.

## Architecture

### Key Components

1. **Main Conversation Agent** (`main-agent/`)
   - Analyzes user intent (transaction, general, command)
   - Routes to appropriate sub-agents
   - Manages conversation history
   - Handles commands (help, cancel, status)

2. **Transaction Sub-Agent** (`transaction-agent/`)
   - Processes receipt transactions adaptively
   - Validates transaction fields dynamically
   - Makes intelligent decisions about next actions
   - Handles multi-turn clarification flows

3. **Conversation Orchestrator** (`orchestrator.ts`)
   - Routes user messages to main agent
   - Manages agent invocations
   - Simple request/response pattern

4. **Conversation Manager** (`core/conversation/`)
   - Manages conversation lifecycle
   - Handles conversation expiration (24 hours)
   - Runs cleanup jobs for expired conversations
   - Tracks conversation metadata

5. **PostgreSQL Checkpointer** (`core/checkpointing/`)
   - Persists LangGraph state to Supabase
   - Enables conversation resumption
   - Supports time-travel debugging

## Key Features

### Multi-Turn Conversations
- Users can have ongoing conversations with context preservation
- Conversation history maintained across multiple turns
- Support for incremental information gathering
- Each user message triggers a new agent invocation
- State persisted via LangGraph checkpointing between invocations

### Checkpointing & State Persistence

**How it works:**
1. **New Conversation**: Orchestrator checks for active conversations for the user
   - If none exist, generates unique `conversationId = conv_{userId}_{timestamp}`
   - If active conversation exists, reuses the same `conversationId`
2. **First Invocation**: Main agent invoked with `thread_id: conversationId`
   - LangGraph automatically saves state to checkpoint after execution
   - If `activeSubAgent: 'transaction'` is set, conversation continues
   - Orchestrator only sets current-turn fields, allowing checkpointer to restore sub-agent state
3. **Second Invocation**: User sends another message
   - Orchestrator reuses same `conversationId` (same `thread_id`)
   - LangGraph loads checkpoint from previous turn
   - Main agent sees `activeSubAgent: 'transaction'` and routes to continue transaction
   - Transaction agent loads its state and applies user's new input
   - Multi-turn conversations work correctly ✅

**State Management:**
- Orchestrator only sets fields specific to current turn (`currentUserMessage`, `currentImageData`, etc.)
- Checkpointer restores `activeSubAgent`, `subAgentState`, `subAgentThreadId` from previous turn
- This allows sub-agents to maintain state across multiple user messages

**When Checkpoints Are Cleared:**
- Conversation marked as 'completed' when `activeSubAgent` becomes null
- Conversation cleanup job removes expired conversations (24 hours by default)
- Checkpoints persist in PostgreSQL until conversation is cleaned up

### Adaptive Decision-Making
- LLM-based decision node determines next action dynamically
- No hard-coded conditional logic
- Flexible handling of edge cases
- Agent provides reasoning for each decision (logged for debugging)

### Intelligent Field Validation
- Dynamic validation of merchant, amount, and category
- Prioritizes critical fields (merchant, amount) before optional ones
- Automatic categorization with confidence thresholds
- Loops back through validation after user provides corrections

### Error Handling
- Errors clear the active sub-agent to prevent infinite loops
- Failed transactions don't trigger automatic retries
- User-friendly error messages with recovery suggestions
- Comprehensive error logging for debugging

## Database Schema

### New Tables

- `conversations` - Stores conversation metadata and status
- `conversation_messages` - Stores message history
- `checkpoints` - LangGraph state persistence

### Updated Tables

- `transactions` - Added `conversation_id` and `turn_number` columns

## Configuration

See `.env.example` for all configuration options. Key settings:

```bash
# Conversation management
CONVERSATION_EXPIRATION_HOURS=24
MAX_CONVERSATION_HISTORY=20

# Agent decision-making
CATEGORY_CONFIDENCE_THRESHOLD=0.8
EXTRACTION_CONFIDENCE_THRESHOLD=0.3

# LLM configuration
AGENT_LLM_MODEL=gpt-4o-mini
AGENT_LLM_TEMPERATURE=0.7
```

## Migration from v1

The v1 workflow has been archived to `_archive_v1/` for reference. The v2 system is a complete replacement with:

- No backward compatibility required
- New database tables (migrations applied automatically)
- Updated messaging adapter callbacks
- New orchestrator pattern

## Usage

The system is automatically initialized in `src/index.ts`. The messaging adapters (Telegram, Console) have been updated to use the new `onMessage` callback for multi-turn support.

### Example Flows

#### Happy Path (High Quality Image)
**Invocation 1:**
1. User sends receipt image
2. Main Agent analyzes intent → routes to Transaction Agent
3. Transaction Agent extracts data (high confidence)
4. Agent validates fields → all valid
5. Agent decides to categorize
6. Agent categorizes with high confidence (>0.8)
7. Agent decides to store transaction
8. Transaction stored successfully
9. User receives confirmation with transaction details
10. Agent invocation ends (state saved to checkpoint)

#### Clarification Path (Missing Merchant) - ✅ Working
**Invocation 1:**
1. User sends receipt image
2. Main Agent analyzes intent → routes to Transaction Agent
3. Transaction Agent extracts data (merchant unclear)
4. Agent validates fields → merchant missing
5. Agent decides to request merchant
6. User receives: "🏪 I couldn't identify the merchant name clearly. Could you tell me the merchant name?"
7. Agent invocation ends (state saved to checkpoint with `activeSubAgent: 'transaction'`)
   - Checkpoint saved with `thread_id: conv_user123_1730000000000`
   - Conversation remains 'active' in database

**Invocation 2:**
8. User replies: "Starbucks"
9. Orchestrator finds active conversation → reuses same `conversationId: conv_user123_1730000000000`
10. Main Agent invoked with same `thread_id` → checkpoint loaded
11. Orchestrator only sets `currentUserMessage: "Starbucks"`, checkpointer restores `activeSubAgent: 'transaction'`
12. Main Agent sees `activeSubAgent: 'transaction'` → routes to continue transaction
13. Transaction Agent loads its checkpoint → applies user context → merchant = "Starbucks"
14. Agent validates again → all valid
15. Agent categorizes and stores
16. User receives confirmation
17. `activeSubAgent` cleared → conversation marked 'completed'

#### Error Handling (Database Connection Failed)
**Invocation 1:**
1. User sends receipt image
2. Transaction Agent extracts and validates successfully
3. Agent decides to store transaction
4. Database connection times out
5. Store transaction node returns error
6. `invokeTransactionAgentNode` sees error → clears `activeSubAgent`
7. Main Agent updates history and ends invocation
8. User receives: "❌ Failed to save transaction. Please try again."
9. No infinite loop - conversation ends cleanly (no active sub-agent to resume)

## Development

### Running Locally

1. Start local Supabase:
```bash
supabase start
```

2. Run the application:
```bash
npm run dev
```

### Testing

```bash
npm test
```

### Debugging

#### LangSmith Tracing
Enable LangSmith tracing in `.env` to view detailed execution traces:

```bash
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=lsv2_pt_your_key_here
LANGCHAIN_PROJECT=receipt-tracker-agent
LANGCHAIN_ENDPOINT=https://api.smith.langchain.com
```

View traces at: https://smith.langchain.com/

#### Common Issues

**Infinite Loop (Fixed in v2.1)**
- **Symptom**: Agent keeps retrying after transaction storage fails
- **Cause**: `activeSubAgent` wasn't cleared on errors
- **Fix**: `invokeTransactionAgentNode` now clears `activeSubAgent` when `result.error` exists
- **Code**: `const shouldKeepActive = !result.completed && !result.error;`

**Database Connection Timeout**
- **Symptom**: "Failed to save transaction" after 300+ seconds
- **Cause**: Local Supabase not running
- **Fix**: Run `supabase start` before starting the app
- **Check**: `curl http://127.0.0.1:54321/rest/v1/`

**User Corrections Not Applied (Fixed in v2.3.1)**
- **Symptom**: User corrections ignored in multi-turn flow
- **Cause**: Orchestrator was overwriting `activeSubAgent` and `subAgentState` with null values
- **Fix**: Orchestrator now only sets current-turn fields, allowing checkpointer to restore sub-agent state
- **Verify**: Check logs for `[Orchestrator] Reusing existing conversation` and `Active sub-agent: transaction`

## Monitoring

The system includes comprehensive logging:

- `[Orchestrator]` - Message routing and execution
- `[MainAgent]` - Intent analysis and routing decisions
- `[TransactionAgent]` - Field validation and decisions
- `[ConversationManager]` - Lifecycle management

## Performance

Target latencies:
- Intent analysis: < 2 seconds
- Transaction extraction: < 5 seconds
- Agent decision: < 2 seconds
- End-to-end transaction: < 15 seconds

## Known Issues & Limitations

### Current Limitations
- ⚠️ **MemorySaver only**: Checkpoints stored in memory, lost on restart (PostgresSaver pending dependency upgrade)
- Conversation cleanup job runs every 6 hours (configurable)
- Maximum 20 messages in conversation history (older messages truncated)
- No conversation summarization for very long conversations
- Single language support (English) only
- No internal agent loops - each user message requires a new invocation

### Fixed Issues
- ✅ **v2.3.1**: Fixed state persistence - orchestrator no longer overwrites sub-agent state from checkpoints
- ✅ **v2.3.0**: Fixed multi-turn conversations - orchestrator now reuses conversationId across messages
- ✅ **v2.2**: Removed unused context injection and continuation features
- ✅ **v2.1**: Fixed infinite loop when transaction storage fails (clears `activeSubAgent` on error)
- ✅ **v2.0**: Replaced fixed workflow with adaptive agent loop
- ✅ **v2.0**: Added PostgreSQL checkpointing for conversation persistence

## Future Enhancements

- Additional sub-agents (analytics, reports, budget tracking)
- Conversation summarization for long histories
- Multi-language support (Chinese, Malay, etc.)
- Voice input support
- Batch transaction processing
- Conversation export/import
- Advanced analytics and spending insights
- Budget alerts and notifications
