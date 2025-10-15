# Transaction Categorizer Module

This module provides intelligent categorization of transactions using LLM-based classification with historical learning capabilities.

## Features

- **Intelligent Categorization**: Uses LLM to analyze merchant names, transaction details, and items to assign appropriate categories
- **Historical Learning**: Learns from user's past transactions and corrections to improve accuracy
- **Confidence Scoring**: Provides confidence scores (0-1) for each categorization
- **Suggested Categories**: Offers alternative category suggestions for low-confidence scenarios
- **User Corrections**: Updates learning data when users manually correct categories

## Supported Categories

- Food & Dining
- Transportation
- Shopping
- Entertainment
- Bills & Utilities
- Healthcare
- Groceries
- Personal Care
- Education
- Travel & Vacation
- Tech Gadgets
- Subscriptions
- Others

## Usage

### Basic Categorization

```typescript
import { TransactionCategorizer } from './categorizer';
import { DatabaseClient } from '../database';
import { ExtractedTransaction } from '../vision';

// Initialize database client
const db = new DatabaseClient(supabaseUrl, supabaseKey);

// Initialize categorizer
const categorizer = new TransactionCategorizer(
  {
    apiKey: 'your-api-key',
    apiBase: 'https://api.openai.com/v1',
    model: 'gpt-4',
    confidenceThreshold: 0.8,
  },
  db
);

// Categorize a transaction
const transaction: ExtractedTransaction = {
  amount: 45.50,
  currency: 'MYR',
  merchantName: 'Nando\'s Restaurant',
  dateTime: new Date().toISOString(),
  paymentMethod: 'Credit Card',
  items: [
    { name: 'Peri-Peri Chicken', price: 28.00, quantity: 1 },
  ],
  confidence: 0.95,
};

const result = await categorizer.categorize(transaction, 'user_123');

console.log(`Category: ${result.category}`);
console.log(`Confidence: ${result.confidence}`);

if (result.suggestedCategories) {
  console.log(`Suggestions: ${result.suggestedCategories.join(', ')}`);
}
```

### Learning from User Corrections

```typescript
// When user corrects a category
await categorizer.learnFromCorrection(
  transactionId,
  'Food & Dining'
);
```

### Getting Similar Transactions

```typescript
// Fetch similar transactions for context
const similar = await categorizer.getSimilarTransactions(
  'Nando\'s',
  'user_123'
);
```

## Confidence Thresholds

- **High confidence (≥0.8)**: Automatically assign category without user input
- **Medium confidence (0.5-0.8)**: Suggest category with alternatives
- **Low confidence (<0.5)**: Request user clarification with all categories

## How It Works

1. **Context Gathering**: Fetches similar transactions from user's history
2. **Prompt Building**: Constructs a detailed prompt with transaction details and historical context
3. **LLM Classification**: Calls the LLM to categorize the transaction
4. **Confidence Evaluation**: Evaluates confidence and provides suggestions if needed
5. **Learning**: Updates category learning data when users make corrections

## Error Handling

The module includes comprehensive error handling:

- `CategorizationError`: Thrown when categorization fails
- Graceful degradation: Falls back to default suggestions if API calls fail
- Logging: Errors are logged but don't break the workflow

## Requirements Satisfied

This implementation satisfies the following requirements:

- **2.1**: Attempts to categorize spending using LLM-based classification
- **2.2**: Uses merchant name, transaction type, and extracted details as context
- **2.3**: Automatically assigns category when confidence is high
- **2.4**: Provides mechanism for requesting clarification (via confidence scores)
- **2.5**: Provides suggested categories based on similar past transactions
- **2.6**: Learns from user input via `learnFromCorrection` method
- **2.7**: Supports all required spending categories
- **6.3**: Uses OpenAI-compatible API for text completion

## Testing

Run the test script to verify functionality:

```bash
npx tsx test-categorizer.ts
```
