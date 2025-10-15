# Workflow Architecture Guide

## Overview

This guide explains the relationship between the three core files that make up the Receipt Tracker Agent's workflow system.

## 🎭 The Theater Analogy

Think of it like a **theater production**:

- **`workflow.ts`** = The **actors** (individual performers)
- **`graph.ts`** = The **director** (orchestrates the actors)
- **`index.ts`** = The **producer** (starts the show and manages everything)

## 📁 File Breakdown

### 1. **`src/workflow/workflow.ts`** - The Node Functions (Actors)

**Purpose**: Defines what each step DOES

```typescript
// These are the individual "actors" - each does one job

export async function receiveImageNode(state: WorkflowState) {
  // Actor 1: Receives the image
  logger.info('Image received');
  return { awaitingUserInput: false };
}

export async function extractDataNode(state: WorkflowState, deps: WorkflowDependencies) {
  // Actor 2: Extracts data from image
  const extractedData = await deps.visionProcessor.extractTransactionData(state.imageData);
  return { extractedData, extractionValid: true };
}

export async function categorizeNode(state: WorkflowState, deps: WorkflowDependencies) {
  // Actor 3: Categorizes the transaction
  const result = await deps.categorizer.categorize(state.extractedData, state.telegramUserId);
  return { category: result.category, confidence: result.confidence };
}

export async function storeTransactionNode(state: WorkflowState, deps: WorkflowDependencies) {
  // Actor 4: Stores in database
  const transactionId = await deps.database.storeTransaction({...});
  return { transactionId };
}
```

**Key Point**: These are just functions. They don't know about each other or the order they run in.

**Responsibilities**:
- ✅ Implement individual workflow steps
- ✅ Take state as input
- ✅ Perform one specific task
- ✅ Return updated state
- ✅ Handle errors for that step
- ❌ Don't know about other nodes
- ❌ Don't control flow

---

### 2. **`src/workflow/graph.ts`** - The Graph Builder (Director)

**Purpose**: Connects the nodes and defines the flow

```typescript
import { StateGraph } from '@langchain/langgraph';
import { receiveImageNode, extractDataNode, categorizeNode, storeTransactionNode } from './workflow';

export function createWorkflowGraph(deps: WorkflowDependencies) {
  // Create the state machine
  const workflow = new StateGraph<WorkflowState>({
    channels: { /* state definition */ }
  });

  // Add the actors to the stage
  workflow.addNode('receive_image', (state) => receiveImageNode(state));
  workflow.addNode('extract_data', (state) => extractDataNode(state, deps));
  workflow.addNode('categorize', (state) => categorizeNode(state, deps));
  workflow.addNode('store_transaction', (state) => storeTransactionNode(state, deps));
  workflow.addNode('send_confirmation', (state) => sendConfirmationNode(state));

  // Define the flow (who goes after whom)
  workflow.addEdge('__start__', 'receive_image');
  workflow.addEdge('receive_image', 'extract_data');
  
  // Conditional routing
  workflow.addConditionalEdges(
    'extract_data',
    isExtractionValid,  // Decision function
    {
      'categorize': 'categorize',  // If valid, go to categorize
      '__end__': '__end__'          // If invalid, end
    }
  );

  workflow.addEdge('categorize', 'store_transaction');
  workflow.addEdge('store_transaction', 'send_confirmation');
  workflow.addEdge('send_confirmation', '__end__');

  // Compile into executable graph
  return workflow.compile();
}
```

**Key Point**: This creates the "script" - the order and connections between nodes.

**Responsibilities**:
- ✅ Define graph structure
- ✅ Add nodes from workflow.ts
- ✅ Define edges (connections)
- ✅ Add conditional routing
- ✅ Compile into executable graph
- ✅ Return compiled workflow
- ❌ Don't implement business logic
- ❌ Don't execute the workflow

---

### 3. **`src/index.ts`** - The Main Application (Producer)

**Purpose**: Initializes everything and runs the workflow

```typescript
import { createWorkflowGraph } from './workflow/graph';
import { VisionProcessor } from './vision/vision-processor';
import { TransactionCategorizer } from './categorizer/categorizer';
import { DatabaseClient } from './database/database';

class ReceiptTrackerAgent {
  private workflowGraph: any;
  private visionProcessor: VisionProcessor;
  private categorizer: TransactionCategorizer;
  private database: DatabaseClient;

  async initialize() {
    // 1. Create all the dependencies (props, costumes, etc.)
    this.visionProcessor = new VisionProcessor({...});
    this.categorizer = new TransactionCategorizer({...});
    this.database = new DatabaseClient({...});

    // 2. Create the workflow graph (hire the director)
    this.workflowGraph = createWorkflowGraph({
      visionProcessor: this.visionProcessor,
      categorizer: this.categorizer,
      database: this.database,
      confidenceThreshold: 0.8
    });

    // 3. Set up Telegram bot to trigger workflows
    this.telegramBot = new TelegramBotHandler({
      onPhotoReceived: this.handlePhotoReceived.bind(this)
    });
  }

  private async handlePhotoReceived(state: WorkflowState) {
    // 4. Execute the workflow (start the show!)
    const result = await this.workflowGraph.invoke(state);
    
    // 5. Handle the result
    if (result.error) {
      // Show failed
      await this.telegramBot.sendErrorMessage(...);
    } else {
      // Show succeeded
      await this.telegramBot.sendConfirmation(...);
    }
  }
}
```

**Key Point**: This is the "producer" that brings everything together and makes it run.

**Responsibilities**:
- ✅ Initialize all components
- ✅ Create workflow graph
- ✅ Handle Telegram events
- ✅ Invoke workflow execution
- ✅ Process workflow results
- ✅ Send responses to users
- ❌ Don't implement workflow logic
- ❌ Don't define workflow structure

---

## 🔄 The Complete Flow

Here's what happens when a user sends a photo:

```
1. User sends photo to Telegram
   ↓
2. index.ts receives it via TelegramBotHandler
   ↓
3. index.ts calls: workflowGraph.invoke(state)
   ↓
4. graph.ts orchestrates the execution:
   ├── Runs receiveImageNode (from workflow.ts)
   ├── Runs extractDataNode (from workflow.ts)
   ├── Checks if extraction valid (conditional edge)
   ├── Runs categorizeNode (from workflow.ts)
   ├── Runs storeTransactionNode (from workflow.ts)
   └── Runs sendConfirmationNode (from workflow.ts)
   ↓
5. graph.ts returns final state to index.ts
   ↓
6. index.ts sends response to user via Telegram
```

## 📊 Visual Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        index.ts                              │
│                    (Main Application)                        │
│                                                              │
│  • Initializes all components                               │
│  • Creates workflow graph                                   │
│  • Handles Telegram events                                  │
│  • Invokes workflow: workflowGraph.invoke(state)           │
│  • Processes results                                        │
└────────────────────┬────────────────────────────────────────┘
                     │ creates & invokes
                     ↓
┌─────────────────────────────────────────────────────────────┐
│                       graph.ts                               │
│                   (Workflow Director)                        │
│                                                              │
│  • Defines graph structure                                  │
│  • Adds nodes from workflow.ts                             │
│  • Defines edges (flow)                                     │
│  • Adds conditional routing                                 │
│  • Compiles into executable graph                          │
│  • Returns: compiled workflow                               │
└────────────────────┬────────────────────────────────────────┘
                     │ uses functions from
                     ↓
┌─────────────────────────────────────────────────────────────┐
│                     workflow.ts                              │
│                   (Node Functions)                           │
│                                                              │
│  • receiveImageNode()      - Receives image                │
│  • extractDataNode()       - Extracts data                 │
│  • categorizeNode()        - Categorizes                   │
│  • storeTransactionNode()  - Stores in DB                  │
│  • sendConfirmationNode()  - Sends confirmation            │
│                                                              │
│  Each function:                                             │
│  • Takes state as input                                     │
│  • Does one specific job                                    │
│  • Returns updated state                                    │
└─────────────────────────────────────────────────────────────┘
```

## 🎯 Responsibility Matrix

| File | Role | Analogy | Responsibilities |
|------|------|---------|------------------|
| **workflow.ts** | Node Functions | **Actors** | • Implement individual tasks<br>• Extract data<br>• Categorize<br>• Store in database<br>• Handle step-specific errors |
| **graph.ts** | Graph Builder | **Director** | • Define workflow structure<br>• Connect nodes<br>• Add conditional routing<br>• Compile graph<br>• Return executable workflow |
| **index.ts** | Main App | **Producer** | • Initialize components<br>• Create workflow<br>• Handle events<br>• Execute workflow<br>• Process results<br>• Send responses |

## 🔍 Code Example: Complete Flow

### Step 1: workflow.ts defines the actors

```typescript
// workflow.ts
export async function extractDataNode(state: WorkflowState, deps: WorkflowDependencies) {
  logger.info('👁️ Extract data node started');
  
  const extractedData = await deps.visionProcessor.extractTransactionData(state.imageData);
  
  logger.info('Extract data node completed', {
    merchant: extractedData.merchantName,
    amount: extractedData.amount
  });
  
  return { 
    extractedData, 
    extractionValid: true 
  };
}
```

### Step 2: graph.ts connects them

```typescript
// graph.ts
export function createWorkflowGraph(deps: WorkflowDependencies) {
  const workflow = new StateGraph<WorkflowState>({
    channels: {
      telegramUserId: null,
      chatId: null,
      imageData: null,
      extractedData: null,
      category: null,
      transactionId: null,
      error: null,
      // ... other state fields
    }
  });

  // Add nodes
  workflow.addNode('receive_image', (state) => receiveImageNode(state));
  workflow.addNode('extract_data', (state) => extractDataNode(state, deps));
  workflow.addNode('categorize', (state) => categorizeNode(state, deps));
  workflow.addNode('store_transaction', (state) => storeTransactionNode(state, deps));

  // Define flow
  workflow.addEdge('__start__', 'receive_image');
  workflow.addEdge('receive_image', 'extract_data');
  
  // Conditional routing based on extraction validity
  workflow.addConditionalEdges(
    'extract_data',
    (state) => state.extractionValid ? 'categorize' : '__end__',
    {
      'categorize': 'categorize',
      '__end__': '__end__'
    }
  );

  workflow.addEdge('categorize', 'store_transaction');
  workflow.addEdge('store_transaction', '__end__');

  return workflow.compile();
}
```

### Step 3: index.ts runs it

```typescript
// index.ts
class ReceiptTrackerAgent {
  private workflowGraph: any;
  private visionProcessor: VisionProcessor;
  private categorizer: TransactionCategorizer;
  private database: DatabaseClient;

  async initialize() {
    logger.info('🚀 Initializing Receipt Tracker Agent...');

    // Initialize dependencies
    this.visionProcessor = new VisionProcessor({...});
    this.categorizer = new TransactionCategorizer({...});
    this.database = new DatabaseClient({...});

    // Create workflow graph
    this.workflowGraph = createWorkflowGraph({
      visionProcessor: this.visionProcessor,
      categorizer: this.categorizer,
      database: this.database,
      confidenceThreshold: 0.8,
      maxRetries: 3,
      retryDelay: 2000
    });

    logger.info('✅ Workflow graph initialized');
  }

  private async handlePhotoReceived(state: WorkflowState) {
    logger.info('📸 Processing photo for user', { userId: state.telegramUserId });

    // Execute the workflow
    const result = await this.workflowGraph.invoke(state);

    // Handle result
    if (result.error) {
      logger.error('❌ Workflow error', { error: result.error });
      await this.telegramBot.sendErrorMessage(state.chatId, result.error);
    } else {
      logger.info('✅ Transaction stored', { transactionId: result.transactionId });
      await this.telegramBot.sendConfirmation(state.chatId, result);
    }
  }
}
```

## 🔄 State Flow Example

Here's how state evolves through the workflow:

### Initial State (from index.ts)
```typescript
{
  telegramUserId: "1737917584",
  chatId: 123456789,
  imageData: <Buffer>,
  awaitingUserInput: false,
  needsClarification: false,
  extractionValid: false
}
```

### After receiveImageNode (workflow.ts)
```typescript
{
  telegramUserId: "1737917584",
  chatId: 123456789,
  imageData: <Buffer>,
  awaitingUserInput: false,  // Set by node
  needsClarification: false,
  extractionValid: false
}
```

### After extractDataNode (workflow.ts)
```typescript
{
  telegramUserId: "1737917584",
  chatId: 123456789,
  imageData: <Buffer>,
  extractedData: {           // Added by node
    amount: 15.50,
    currency: "MYR",
    merchantName: "Starbucks",
    confidence: 0.95
  },
  extractionValid: true,     // Set by node
  awaitingUserInput: false,
  needsClarification: false
}
```

### After categorizeNode (workflow.ts)
```typescript
{
  telegramUserId: "1737917584",
  chatId: 123456789,
  imageData: <Buffer>,
  extractedData: {...},
  category: "Food & Dining",  // Added by node
  confidence: 0.92,           // Added by node
  needsClarification: false,  // Set by node
  extractionValid: true,
  awaitingUserInput: false
}
```

### After storeTransactionNode (workflow.ts)
```typescript
{
  telegramUserId: "1737917584",
  chatId: 123456789,
  imageData: <Buffer>,
  extractedData: {...},
  category: "Food & Dining",
  confidence: 0.92,
  transactionId: "abc-123-def",  // Added by node
  needsClarification: false,
  extractionValid: true,
  awaitingUserInput: false
}
```

### Final State (returned to index.ts)
```typescript
{
  telegramUserId: "1737917584",
  chatId: 123456789,
  imageData: <Buffer>,
  extractedData: {...},
  category: "Food & Dining",
  confidence: 0.92,
  transactionId: "abc-123-def",
  confirmationMessage: "Transaction saved!",  // Added by final node
  needsClarification: false,
  extractionValid: true,
  awaitingUserInput: false
}
```

## 🎬 Execution Timeline

```
Time  | File       | Action
------|------------|--------------------------------------------------
0ms   | index.ts   | User sends photo, creates initial state
10ms  | index.ts   | Calls workflowGraph.invoke(state)
10ms  | graph.ts   | Starts workflow execution
15ms  | workflow.ts| receiveImageNode() executes
20ms  | graph.ts   | Routes to extract_data
25ms  | workflow.ts| extractDataNode() starts
2.3s  | workflow.ts| Vision API call completes
2.3s  | workflow.ts| extractDataNode() returns
2.3s  | graph.ts   | Checks isExtractionValid()
2.3s  | graph.ts   | Routes to categorize
2.3s  | workflow.ts| categorizeNode() starts
3.5s  | workflow.ts| Categorization completes
3.5s  | workflow.ts| categorizeNode() returns
3.5s  | graph.ts   | Routes to store_transaction
3.5s  | workflow.ts| storeTransactionNode() starts
3.7s  | workflow.ts| Database insert completes
3.7s  | workflow.ts| storeTransactionNode() returns
3.7s  | graph.ts   | Routes to __end__
3.7s  | graph.ts   | Returns final state
3.7s  | index.ts   | Receives result
3.8s  | index.ts   | Sends confirmation to user
```

## 💡 Key Takeaways

### Separation of Concerns

1. **workflow.ts** (What to do)
   - Pure business logic
   - Individual operations
   - No knowledge of flow
   - Testable in isolation

2. **graph.ts** (How to connect)
   - Workflow orchestration
   - Flow control
   - Conditional routing
   - No business logic

3. **index.ts** (When to run)
   - Application lifecycle
   - Event handling
   - Dependency injection
   - Result processing

### Benefits of This Architecture

✅ **Modularity**: Each file has a single responsibility  
✅ **Testability**: Nodes can be tested independently  
✅ **Maintainability**: Easy to modify flow without changing logic  
✅ **Reusability**: Nodes can be reused in different workflows  
✅ **Visibility**: LangSmith can trace the entire flow  
✅ **Debugging**: Clear separation makes issues easier to find  

### When to Modify Each File

**Modify workflow.ts when:**
- Adding new processing steps
- Changing business logic
- Updating API calls
- Modifying data transformations

**Modify graph.ts when:**
- Changing workflow order
- Adding conditional routing
- Modifying flow structure
- Adding/removing nodes

**Modify index.ts when:**
- Adding new event handlers
- Changing initialization
- Modifying result handling
- Adding new integrations

## 🔗 Related Documentation

- **[src/workflow/README.md](./src/workflow/README.md)** - Workflow implementation details
- **[LANGSMITH-GUIDE.md](./LANGSMITH-GUIDE.md)** - How LangSmith traces workflows
- **[DEBUGGING-COMPLETE-GUIDE.md](./DEBUGGING-COMPLETE-GUIDE.md)** - Debugging workflows
- **[LOGGING-ENHANCEMENTS.md](./LOGGING-ENHANCEMENTS.md)** - Logging in workflows

---

**Understanding this architecture will help you debug issues, add features, and maintain the codebase effectively!** 🎯
