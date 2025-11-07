# Telegram Bot Handler

This module provides the Telegram bot interface for the Receipt Tracker Agent. It handles all user interactions through Telegram, including commands, photo messages, and interactive category selection.

## Features

- **Command Handlers**: `/start`, `/help`, `/stats`
- **Photo Processing**: Receives and downloads receipt images
- **Interactive Categorization**: Inline keyboard for category selection
- **Confirmation Messages**: Formatted transaction confirmations
- **Error Handling**: Context-aware error messages with helpful tips

## Usage

### Basic Initialization

```typescript
import { TelegramBotHandler } from './telegram';
import { DatabaseClient } from '../database/database';

const database = new DatabaseClient(supabaseUrl, supabaseKey);

const botHandler = new TelegramBotHandler({
  botToken: 'YOUR_TELEGRAM_BOT_TOKEN',
  database,
  onPhotoReceived: async (state) => {
    // Handle photo workflow
    console.log('Photo received from user:', state.telegramUserId);
  },
  onCategorySelected: async (userId, transactionId, category) => {
    // Handle category selection
    console.log('User selected category:', category);
  },
});

// Launch the bot
await botHandler.launch();
```

### Sending Messages

#### Confirmation Message

```typescript
await botHandler.sendConfirmation(
  chatId,
  extractedTransaction,
  'Food & Dining',
  transactionId
);
```

#### Category Selection

```typescript
await botHandler.sendCategoryOptions(
  chatId,
  extractedTransaction,
  ['Food & Dining', 'Shopping', 'Entertainment'], // suggested categories
  transactionId
);
```

#### Error Messages

```typescript
// With error type for context-specific help
await botHandler.sendErrorMessage(
  chatId,
  'Failed to extract transaction details',
  'extraction'
);

// Simple error message
await botHandler.sendSimpleError(
  chatId,
  'Something went wrong'
);
```

## Commands

### /start
Displays welcome message with bot introduction and usage instructions.

### /help
Shows detailed help guide including:
- Supported image types
- Available spending categories
- How the bot works
- Tips for best results

### /stats
Displays spending statistics:
- Current month summary
- Current year summary
- Breakdown by category with visual progress bars
- Average spending per month

## Photo Handling

When a user sends a photo:

1. Bot acknowledges receipt
2. Downloads the highest quality version
3. Creates workflow state with image data
4. Triggers `onPhotoReceived` callback
5. Sends processing status message

## Category Selection

When categorization confidence is low:

1. Bot sends transaction details
2. Displays suggested categories as inline buttons
3. User selects a category
4. Bot confirms selection
5. Triggers `onCategorySelected` callback

Users can also request to see all categories if the suggested ones don't match.

## Error Types

The bot provides context-specific error messages for:

- **extraction**: Image quality or readability issues
- **categorization**: LLM categorization failures
- **storage**: Database save failures
- **validation**: Incomplete or invalid data
- **network**: Connection issues
- **timeout**: Request timeout
- **unknown**: Generic errors

Each error type includes helpful tips for the user to resolve the issue.

## Configuration

Required configuration:

```typescript
interface TelegramBotConfig {
  botToken: string;                    // Telegram bot token from BotFather
  database: DatabaseClient;            // Database client instance
  onPhotoReceived?: (state: WorkflowState) => Promise<void>;
  onCategorySelected?: (userId: string, transactionId: string, category: string) => Promise<void>;
}
```

## Graceful Shutdown

The bot automatically handles graceful shutdown on SIGINT and SIGTERM signals:

```typescript
// Manual stop
await botHandler.stop();
```

## Testing

Run the test file to verify the bot handler:

```bash
npm run dev test-telegram-bot.ts
```

## Dependencies

- `telegraf`: Telegram Bot API framework
- `@supabase/supabase-js`: Database operations
- `../database`: Database client
- `../workflow`: Workflow state types
- `../vision`: Transaction extraction types
- `../categorizer`: Category definitions

## Error Handling

All methods include comprehensive error handling:
- Errors are logged to console
- User-friendly messages are sent to the chat
- Fallback messages ensure users always get feedback
- Bot continues running even if individual operations fail

## Security Considerations

- Bot token is stored securely in environment variables
- User IDs are validated before processing
- Callback data is parsed and validated
- All user inputs are sanitized

## Future Enhancements

- Multi-language support
- Custom category management
- Transaction editing
- Bulk receipt processing
- Voice message support
- Web app integration
