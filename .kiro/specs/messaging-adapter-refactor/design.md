# Design Document

## Overview

This design document outlines the refactoring of the Receipt Tracker Agent to implement the Adapter Pattern for messaging platform abstraction. The refactoring will decouple the Telegram-specific code from the core workflow logic, making the system flexible enough to support multiple messaging platforms (Telegram, Console, WhatsApp, etc.) without modifying the business logic.

The key architectural change is introducing a `MessagingAdapter` interface that abstracts all platform-specific messaging operations. The workflow orchestrator will depend on this interface rather than concrete implementations, enabling easy platform swapping through dependency injection.

## Architecture

### High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                          index.ts                                │
│                    (Bootstrap & Wiring)                          │
│  - Initialize components                                         │
│  - Wire dependencies                                             │
│  - Handle graceful shutdown                                      │
└──────────────┬──────────────────────────────┬────────────────────┘
               │                              │
               ▼                              ▼
┌──────────────────────────────┐   ┌─────────────────────────────┐
│   WorkflowOrchestrator       │   │   MessagingAdapter          │
│   (Platform-agnostic)        │◄──┤   (Interface)               │
│                              │   │                             │
│  - Handles workflow logic    │   │  - sendMessage()            │
│  - Processes receipts        │   │  - sendOptions()            │
│  - Manages corrections       │   │  - sendConfirmation()       │
│  - Uses adapter interface    │   │  - sendError()              │
└──────────────┬───────────────┘   │  - requestTextInput()       │
               │                   └─────────────────────────────┘
               │                              △
               ▼                              │
┌──────────────────────────────┐             │
│   Workflow Graph             │   ┌─────────┴──────────┐
│   (LangGraph)                │   │                    │
│                              │   │                    │
│  - Extract data              │   │                    │
│  - Categorize                │   │                    │
│  - Store transaction         │   │                    │
└──────────────────────────────┘   │                    │
                              ┌────┴──────┐    ┌────────┴──────┐
                              │ Telegram  │    │   Console     │
                              │  Adapter  │    │   Adapter     │
                              │           │    │               │
                              │ - Telegraf│    │ - readline    │
                              │ - Bot API │    │ - stdout      │
                              └───────────┘    └───────────────┘
```

### Component Responsibilities

1. **index.ts**: Minimal bootstrap code that initializes components and wires dependencies
2. **MessagingAdapter (Interface)**: Defines the contract for all messaging operations
3. **TelegramAdapter**: Implements MessagingAdapter for Telegram platform
4. **ConsoleAdapter**: Implements MessagingAdapter for CLI/testing
5. **WorkflowOrchestrator**: Platform-agnostic orchestrator that uses the adapter interface
6. **Workflow Graph**: Existing LangGraph workflow (minimal changes)

## Components and Interfaces

### 1. Messaging Types (`src/core/messaging/types.ts`)

Platform-agnostic data structures used across all adapters:

```typescript
export interface UserContext {
  userId: string;           // Platform-agnostic user identifier
  sessionId: string;        // Platform-agnostic session identifier
  metadata?: Record<string, any>;  // Platform-specific metadata
}

export interface ImageInput {
  data: Buffer;             // Image binary data
  url?: string;             // Optional image URL
  mimeType?: string;        // Image MIME type
}

export interface TextMessage {
  text: string;             // Message content
  format?: 'plain' | 'markdown' | 'html';  // Text formatting
}

export interface OptionButton {
  id: string;               // Unique option identifier
  label: string;            // Display label
  value: string;            // Option value
}

export interface OptionsMessage {
  text: string;             // Prompt text
  options: OptionButton[];  // Available options
  allowMultiple?: boolean;  // Allow multiple selections
}

export interface TransactionSummary {
  amount: number;
  currency: string;
  merchantName: string;
  category: string;
  dateTime: string;
  paymentMethod?: string;
  transactionReference?: string;
  transactionId?: string;
}

export interface ErrorMessage {
  message: string;
  errorType?: 'extraction' | 'categorization' | 'storage' | 'validation' | 'network' | 'timeout' | 'unknown';
  suggestions?: string[];
}
```

### 2. Messaging Adapter Interface (`src/core/messaging/messaging-adapter.ts`)

```typescript
export interface MessagingAdapter {
  // Lifecycle methods
  start(): Promise<void>;
  stop(signal?: string): Promise<void>;

  // Outbound messaging methods
  sendMessage(context: UserContext, message: TextMessage): Promise<void>;
  sendOptions(context: UserContext, message: OptionsMessage): Promise<void>;
  sendTransactionConfirmation(context: UserContext, transaction: TransactionSummary): Promise<void>;
  sendError(context: UserContext, error: ErrorMessage): Promise<void>;
  requestTextInput(context: UserContext, prompt: string): Promise<void>;
}

export interface MessagingAdapterCallbacks {
  onImageReceived: (context: UserContext, image: ImageInput) => Promise<void>;
  onTextReceived: (context: UserContext, text: string) => Promise<void>;
  onOptionSelected: (context: UserContext, optionId: string, optionValue: string) => Promise<void>;
  onCommand?: (context: UserContext, command: string, args: string[]) => Promise<void>;
}
```

### 3. Telegram Adapter (`src/core/messaging/telegram-adapter.ts`)

Implements `MessagingAdapter` for Telegram:

**Key Responsibilities:**
- Initialize Telegraf bot
- Register Telegram-specific handlers (photo, text, callback_query, commands)
- Translate platform-agnostic messages to Telegram API calls
- Translate Telegram events to adapter callbacks
- Manage Telegram-specific state (WorkflowStateManager)

**Implementation Details:**
- Uses Telegraf library for Telegram Bot API
- Converts Telegram user IDs to UserContext
- Downloads photos and converts to ImageInput
- Creates inline keyboards for OptionsMessage
- Formats messages with Telegram markdown/HTML

### 4. Console Adapter (`src/core/messaging/console-adapter.ts`)

Implements `MessagingAdapter` for CLI/testing:

**Key Responsibilities:**
- Provide readline interface for user input
- Display messages to console
- Accept commands: `image <path>`, `text <msg>`, `exit`
- Simulate user interactions for testing

**Implementation Details:**
- Uses Node.js readline module
- Reads image files from filesystem
- Displays numbered options for selection
- Provides simple text-based UI

### 5. Workflow Orchestrator (`src/features/receipt-processing/workflow/workflow-orchestrator.ts`)

Platform-agnostic orchestrator that manages the receipt processing workflow:

```typescript
export class WorkflowOrchestrator {
  private workflowGraph: ReturnType<typeof createWorkflowGraph>;
  private messagingAdapter: MessagingAdapter;
  private database: DatabaseClient;
  private categorizer: TransactionCategorizer;
  private config: any;
  private pendingWorkflows: Map<string, PendingWorkflowContext>;

  constructor(
    messagingAdapter: MessagingAdapter,
    workflowGraph: ReturnType<typeof createWorkflowGraph>,
    database: DatabaseClient,
    categorizer: TransactionCategorizer,
    config: any
  ) {
    this.messagingAdapter = messagingAdapter;
    this.workflowGraph = workflowGraph;
    this.database = database;
    this.categorizer = categorizer;
    this.config = config;
    this.pendingWorkflows = new Map();
  }

  // Main workflow handlers
  async handleImageReceived(context: UserContext, image: ImageInput): Promise<void>;
  async handleTextReceived(context: UserContext, text: string): Promise<void>;
  async handleOptionSelected(context: UserContext, optionId: string, optionValue: string): Promise<void>;

  // Correction handlers
  private async handleMerchantCorrection(context: UserContext, merchantName: string): Promise<void>;
  private async handleAmountCorrection(context: UserContext, amountText: string): Promise<void>;
  private async handleRetryExtraction(context: UserContext, text: string): Promise<void>;
}
```

Note: The orchestrator imports `createWorkflowGraph` from `workflow.ts` (renamed from `graph.ts`).
```

**Key Responsibilities:**
- Execute workflow graph for image processing
- Handle workflow results and send appropriate responses via adapter
- Manage pending workflows (corrections, clarifications)
- Handle user corrections (merchant, amount)
- Handle category selection
- Send confirmations and errors via adapter

### 6. Refactored index.ts

Minimal bootstrap code:

```typescript
class ReceiptTrackerAgent {
  private database: DatabaseClient;
  private visionProcessor: VisionProcessor;
  private categorizer: TransactionCategorizer;
  private messagingAdapter: MessagingAdapter;
  private orchestrator: WorkflowOrchestrator;
  private workflowGraph: ReturnType<typeof createWorkflowGraph>;
  private memoryMonitor: MemoryMonitor;

  async initialize(): Promise<void> {
    // Initialize core components
    this.database = new DatabaseClient(...);
    this.visionProcessor = new VisionProcessor(...);
    this.categorizer = new TransactionCategorizer(...);
    this.workflowGraph = createWorkflowGraph(...);

    // Create orchestrator
    this.orchestrator = new WorkflowOrchestrator(
      null, // Adapter injected later
      this.workflowGraph,
      this.database,
      this.categorizer,
      config
    );

    // Create messaging adapter with callbacks
    this.messagingAdapter = new TelegramAdapter({
      botToken: config.telegram.botToken,
      callbacks: {
        onImageReceived: this.orchestrator.handleImageReceived.bind(this.orchestrator),
        onTextReceived: this.orchestrator.handleTextReceived.bind(this.orchestrator),
        onOptionSelected: this.orchestrator.handleOptionSelected.bind(this.orchestrator),
      }
    });

    // Inject adapter into orchestrator
    this.orchestrator.setAdapter(this.messagingAdapter);

    this.memoryMonitor = new MemoryMonitor(...);
  }

  async start(): Promise<void> {
    this.memoryMonitor.start();
    await this.messagingAdapter.start();
  }

  async stop(signal?: string): Promise<void> {
    this.memoryMonitor.stop();
    await this.messagingAdapter.stop(signal);
  }
}
```

## Data Models

### PendingWorkflowContext

Tracks pending workflows that require user input:

```typescript
interface PendingWorkflowContext {
  type: 'merchant_correction' | 'amount_correction' | 'retry_extraction' | 'category_selection';
  timestamp: number;
  extractedData?: ExtractedTransaction;
  transactionId?: string;
  suggestedCategories?: string[];
  originalState?: WorkflowState;
}
```

### WorkflowState (Existing)

No changes to the existing WorkflowState interface. The orchestrator will translate between WorkflowState and platform-agnostic types.

## Error Handling

### Error Flow

1. **Workflow errors**: Caught by orchestrator, translated to ErrorMessage, sent via adapter
2. **Adapter errors**: Logged and handled within adapter, fallback messages sent to user
3. **Network errors**: Retry logic in adapters, timeout handling
4. **Validation errors**: Interactive recovery via adapter (request corrections)

### Error Types

All errors use the standardized `ErrorMessage` type with appropriate `errorType` and `suggestions`.

## Testing Strategy

### Unit Tests

1. **MessagingAdapter Interface**: Test that all adapters implement the interface correctly
2. **TelegramAdapter**: Mock Telegraf, test message translation and callback invocation
3. **ConsoleAdapter**: Test readline interactions and command parsing
4. **WorkflowOrchestrator**: Mock adapter, test workflow logic and response handling

### Integration Tests

1. **End-to-end with ConsoleAdapter**: Test full workflow using console adapter
2. **Telegram Integration**: Test with real Telegram bot (manual or staging environment)
3. **Adapter Swapping**: Verify that swapping adapters doesn't break functionality

### Testing Approach

- Use ConsoleAdapter for automated testing (no external dependencies)
- Mock MessagingAdapter interface for orchestrator tests
- Test workflow logic independently of messaging platform
- Verify that all existing functionality works after refactoring

## Migration Strategy

### Phase 1: Rename Workflow Files
- Rename `graph.ts` to `workflow.ts` for better clarity
- Update all imports across the codebase

### Phase 2: Create Abstraction Layer
- Create messaging types
- Create MessagingAdapter interface
- Create ConsoleAdapter for testing

### Phase 3: Implement Telegram Adapter
- Extract Telegram code from index.ts
- Implement TelegramAdapter
- Test with existing functionality

### Phase 4: Create Workflow Orchestrator
- Extract workflow logic from index.ts
- Create WorkflowOrchestrator class
- Wire orchestrator with adapter

### Phase 5: Refactor index.ts
- Simplify to bootstrap only
- Wire components together
- Test end-to-end

### Phase 6: Cleanup
- Remove old Telegram bot handler (if separate)
- Update documentation
- Verify all tests pass

## Performance Considerations

- **No performance impact**: Adapter pattern adds minimal overhead (single interface call)
- **Memory**: Orchestrator maintains pending workflows map (same as before)
- **Network**: No changes to network calls, just abstracted behind interface

## Security Considerations

- **Token management**: Bot tokens remain in config, passed to adapters
- **User data**: UserContext abstracts user IDs, metadata kept in platform-specific format
- **Input validation**: Orchestrator validates all user input before processing
- **Error messages**: Avoid leaking sensitive information in error messages

## Future Extensibility

### Adding New Platforms

To add a new messaging platform (e.g., WhatsApp):

1. Create `WhatsAppAdapter` implementing `MessagingAdapter`
2. Implement platform-specific message translation
3. Register platform-specific event handlers
4. Inject into orchestrator in index.ts

No changes needed to:
- WorkflowOrchestrator
- Workflow Graph
- Core business logic

### Adding New Features

New messaging features (e.g., voice messages, location sharing):

1. Add methods to `MessagingAdapter` interface
2. Implement in all adapters (or make optional)
3. Use in orchestrator as needed

## Dependencies

### New Dependencies
- None (uses existing Telegraf, readline is built-in)

### Modified Files
- `src/index.ts` - Simplified to bootstrap only
- `src/features/telegram-bot/telegram-bot.ts` - May be deprecated or refactored

### New Files
- `src/core/messaging/types.ts`
- `src/core/messaging/messaging-adapter.ts`
- `src/core/messaging/telegram-adapter.ts`
- `src/core/messaging/console-adapter.ts`
- `src/features/receipt-processing/workflow/workflow-orchestrator.ts`

### Renamed Files (for better clarity)
- `src/features/receipt-processing/workflow/graph.ts` → `src/features/receipt-processing/workflow/workflow.ts`
  - Rationale: "workflow.ts" better describes that this file creates and configures the LangGraph workflow

Note: The existing `nodes.ts` file already has the correct name and doesn't need renaming.
