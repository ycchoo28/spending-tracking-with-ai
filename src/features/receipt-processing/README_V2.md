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
   - Manages message routing
   - Handles context injection during processing
   - Tracks agent execution state
   - Coordinates between main agent and sub-agents

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

### Adaptive Decision-Making
- LLM-based decision node determines next action dynamically
- No hard-coded conditional logic
- Flexible handling of edge cases

### Context Injection
- Messages sent during processing are injected into agent state
- No message buffering or artificial delays
- Immediate incorporation of user input

### Intelligent Field Validation
- Dynamic validation of merchant, amount, and category
- Prioritizes critical fields (merchant, amount) before optional ones
- Automatic categorization with confidence thresholds

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

### Example Flow

1. User sends receipt image
2. Main Agent analyzes intent → routes to Transaction Agent
3. Transaction Agent extracts data, validates fields
4. Agent decides next action (e.g., request merchant name)
5. User provides merchant name
6. Agent validates again, decides to categorize
7. Agent categorizes with high confidence
8. Agent stores transaction
9. User receives confirmation

## Development

### Running Locally

```bash
npm run dev
```

### Testing

```bash
npm test
```

### Debugging

Enable LangSmith tracing in `.env`:

```bash
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=your_key
LANGCHAIN_PROJECT=receipt-tracker-v2
```

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

## Future Enhancements

- Additional sub-agents (analytics, reports)
- Conversation summarization for long histories
- Multi-language support
- Voice input support
- Batch transaction processing
