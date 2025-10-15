# Workflow Module

This module implements the LangGraph-based workflow state machine for processing receipt and e-wallet transaction images.

## Overview

The workflow orchestrates the entire transaction processing pipeline:

1. **Receive Image** - Initialize state with image data
2. **Extract Data** - Use vision AI to extract transaction details
3. **Categorize** - Classify the transaction into spending categories
4. **Request Clarification** (conditional) - Ask user for category if confidence is low
5. **Store Transaction** - Save to Supabase database
6. **Send Confirmation** - Format and return confirmation message

## Components

### WorkflowState

The state interface that tracks processing through all nodes:

```typescript
interface WorkflowState {
  telegramUserId: string;
  chatId: number;
  imageUrl?: string;
  imageData?: Buffer;
  extractedData?: ExtractedTransaction;
  category?: string;
  confidence?: number;
  suggestedCategories?: string[];
  transactionId?: string;
  error?: string;
  errorType?: string;
  awaitingUserInput: boolean;
  needsClarification: boolean;
  extractionValid: boolean;
  confirmationMessage?: string;
}
```

### Node Functions

Each node is a pure function that takes state and dependencies, returns state updates:

- `receiveImageNode` - Validates and initializes image data
- `extractDataNode` - Calls VisionProcessor with retry logic
- `categorizeNode` - Calls TransactionCategorizer with retry logic
- `requestClarificationNode` - Prepares clarification request
- `storeTransactionNode` - Saves to database with retry logic
- `sendConfirmationNode` - Formats confirmation message

### Conditional Routing

Two conditional edge functions control workflow branching:

- `isExtractionValid` - Routes to categorize or END based on extraction validity
- `shouldRequestClarification` - Routes to clarification or storage based on confidence

### Error Handling

The `ErrorHandler` class provides:

- Error classification by type and severity
- Automatic retry logic with exponential backoff
- User-friendly error messages
- Fallback paths for unrecoverable errors

## Usage

### Creating the Workflow

```typescript
import { createWorkflowGraph, WorkflowDependencies } from './workflow';

const deps: WorkflowDependencies = {
  visionProcessor,
  categorizer,
  database,
  confidenceThreshold: 0.8,
  maxRetries: 3,
  retryDelay: 2000,
};

const workflow = createWorkflowGraph(deps);
```

### Running the Workflow

```typescript
const initialState: WorkflowState = {
  telegramUserId: '123456',
  chatId: 789,
  imageData: imageBuffer,
  imageUrl: 'https://...',
  awaitingUserInput: false,
  needsClarification: false,
  extractionValid: false,
};

const result = await workflow.invoke(initialState);

if (result.error) {
  // Handle error
  console.error(result.error);
} else if (result.awaitingUserInput) {
  // Send clarification request to user
  sendCategoryOptions(result);
} else {
  // Send confirmation
  sendMessage(result.confirmationMessage);
}
```

### Resuming After Clarification

When user provides a category, resume with the resumption graph:

```typescript
import { createResumptionGraph } from './workflow';

const resumptionGraph = createResumptionGraph(deps);

const resumeState: WorkflowState = {
  ...previousState,
  category: userSelectedCategory,
  confidence: 1.0, // User-provided category has full confidence
  awaitingUserInput: false,
};

const result = await resumptionGraph.invoke(resumeState);
```

## Error Handling

### Automatic Retries

Network and timeout errors are automatically retried with exponential backoff:

- Extraction failures: Up to 3 retries
- Categorization failures: Up to 3 retries
- Storage failures: Up to 3 retries

### Error Types

- `extraction` - Vision API failed to extract data
- `categorization` - LLM failed to categorize
- `storage` - Database operation failed
- `validation` - Invalid or incomplete data
- `network` - Network connectivity issues
- `timeout` - Request timed out
- `unknown` - Unexpected error

### User-Friendly Messages

All errors are converted to user-friendly messages:

```typescript
const errorHandler = createDefaultErrorHandler();
const workflowError = errorHandler.classifyError(error, state);
console.log(workflowError.userMessage); // "📷 Could not read the receipt clearly..."
```

## State Machine Diagram

```
[Start] → Receive Image → Extract Data
                              ↓
                         Valid? ─No→ [End]
                              ↓ Yes
                         Categorize
                              ↓
                    High Confidence? ─No→ Request Clarification → [End]
                              ↓ Yes
                      Store Transaction
                              ↓
                      Send Confirmation
                              ↓
                           [End]
```

## Testing

Run the workflow test:

```bash
npx ts-node test-workflow.ts
```

This verifies that the workflow graph can be created and all nodes are registered correctly.

## Integration with Telegram Bot

The Telegram bot handler should:

1. Receive photo message
2. Download image data
3. Create initial workflow state
4. Invoke workflow
5. Handle result:
   - If `awaitingUserInput`: Send category selection buttons
   - If `error`: Send error message
   - If `confirmationMessage`: Send confirmation
6. On user category selection:
   - Update state with selected category
   - Invoke resumption graph
   - Send confirmation

See the Telegram bot implementation for complete integration example.
