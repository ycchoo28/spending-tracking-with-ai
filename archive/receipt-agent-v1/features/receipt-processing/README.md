# Receipt Processing Feature

This feature handles the complete receipt processing workflow, from image extraction to transaction categorization and storage.

## Components

### Vision (`vision/`)
Extracts transaction data from receipt images and e-wallet screenshots using vision AI.

**Key Files:**
- `vision-processor.ts` - Main vision processing logic
- `index.ts` - Exports

**Responsibilities:**
- Image preprocessing (resize, compress)
- OCR and data extraction via vision API
- Response parsing and validation
- Retry logic for transient failures

### Categorizer (`categorizer/`)
Categorizes transactions into spending categories using LLM-based classification.

**Key Files:**
- `categorizer.ts` - Main categorization logic
- `index.ts` - Exports

**Responsibilities:**
- Transaction categorization
- Historical learning (uses past transactions)
- Confidence scoring
- Category suggestions for low-confidence cases
- Learning from user corrections

### Workflow (`workflow/`)
Orchestrates the receipt processing workflow using LangGraph.

**Key Files:**
- `types.ts` - Workflow state and dependencies
- `graph.ts` - LangGraph workflow definition
- `nodes/` - Individual workflow nodes
- `error-handler.ts` - Error handling utilities

**Workflow Steps:**
1. **Receive Image** - Validate input
2. **Extract Data** - Extract transaction from image
3. **Categorize** - Classify the transaction
4. **Request Clarification** - Ask user if confidence is low
5. **Store Transaction** - Save to database
6. **Send Confirmation** - Notify user

## Data Flow

```
Image → Vision Processor → Extracted Data
                              ↓
                         Categorizer → Category + Confidence
                              ↓
                    [High Confidence] → Store Transaction
                              ↓
                    [Low Confidence] → Request Clarification
                              ↓
                         User Selection
                              ↓
                      Store Transaction
                              ↓
                      Send Confirmation
```

## Usage

```typescript
import { 
  VisionProcessor, 
  TransactionCategorizer,
  createWorkflowGraph 
} from './features/receipt-processing';

// Initialize components
const visionProcessor = new VisionProcessor(config);
const categorizer = new TransactionCategorizer(config, database);

// Create workflow
const workflow = createWorkflowGraph({
  visionProcessor,
  categorizer,
  database,
  confidenceThreshold: 0.7,
});

// Execute workflow
const result = await workflow.invoke({
  telegramUserId: '123',
  chatId: 456,
  imageData: buffer,
});
```

## Configuration

Environment variables:
- `OPENAI_API_KEY` - OpenAI API key
- `OPENAI_API_BASE` - API base URL
- `VISION_MODEL` - Vision model name
- `CATEGORIZER_MODEL` - Text model name
- `CONFIDENCE_THRESHOLD` - Categorization confidence threshold (0-1)
- `MAX_RETRIES` - Max retry attempts for API calls
- `RETRY_DELAY` - Delay between retries (ms)

## Error Handling

The workflow includes comprehensive error handling:
- **Extraction errors** - Invalid image, API failures
- **Categorization errors** - LLM failures, parsing errors
- **Storage errors** - Database failures
- **Validation errors** - Missing or invalid data

All errors are logged and reported to the user via Telegram.

## Testing

```bash
# Unit tests
npm test tests/unit/vision
npm test tests/unit/categorizer
npm test tests/unit/workflow

# Integration tests
npm test tests/integration/receipt-processing
```

## Extending

To add new workflow nodes:

1. Create a new file in `workflow/nodes/`
2. Implement the node function
3. Export from `workflow/nodes/index.ts`
4. Add to graph in `workflow/graph.ts`
5. Update workflow state types if needed

To add new categories:

1. Update `CATEGORIES` in `prompts/receipt/categorization.ts`
2. Update categorization prompt guidelines
3. Test with sample transactions
