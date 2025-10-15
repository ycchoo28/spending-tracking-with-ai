# Interactive Error Recovery Implementation

## Overview

Implemented interactive error recovery system that allows the bot to communicate with users when errors occur and collect feedback to retry/fix the process.

## Changes Made

### 1. Workflow State Manager (`src/features/telegram-bot/workflow-state-manager.ts`)

- **New file** that manages pending workflows waiting for user input
- Tracks workflow type (merchant_correction, amount_correction, retry_extraction)
- Stores workflow state and extracted data
- Automatic cleanup of old pending workflows (>1 hour)

### 2. Telegram Bot Handler Updates (`src/features/telegram-bot/telegram-bot.ts`)

- Added `WorkflowStateManager` to track pending user interactions
- Added `/cancel` command to cancel pending operations
- Added text message handler to process user corrections
- Added three new methods for requesting user input:
  - `requestMerchantCorrection()` - Ask user for correct merchant name
  - `requestAmountCorrection()` - Ask user for correct amount
  - `requestRetryWithGuidance()` - Guide user to retry with better photo or manual input

### 3. Main Application Updates (`src/index.ts`)

- Added `onUserTextInput` callback to handle user text responses
- Implemented three handler methods:
  - `handleUserTextInput()` - Routes to appropriate handler based on workflow type
  - `handleMerchantCorrection()` - Processes merchant name corrections
  - `handleAmountCorrection()` - Processes amount corrections
  - `handleRetryExtraction()` - Handles manual data entry flow
- Updated error handling in `handlePhotoReceived()` to use interactive recovery:
  - Validation errors → Request specific field correction
  - Extraction errors → Request retry with guidance

## User Experience Flow

### Scenario 1: Unknown Merchant

1. User sends receipt
2. Bot extracts data but merchant is "Unknown Merchant"
3. Bot asks: "I couldn't identify the merchant name. Please reply with the correct merchant name."
4. User replies: "TONG PEI LU"
5. Bot updates merchant name and continues with categorization

### Scenario 2: Invalid Amount

1. User sends receipt
2. Bot can't extract amount or gets 0
3. Bot asks: "I couldn't extract the amount. Please reply with the correct amount (e.g., '16.50')."
4. User replies: "16"
5. Bot updates amount and continues with categorization

### Scenario 3: Extraction Failure

1. User sends blurry receipt
2. Bot fails to extract any data
3. Bot asks: "What would you like to do? 1) Send clearer photo 2) Type details manually 3) /cancel"
4. User replies with merchant name
5. Bot asks for amount
6. User replies with amount
7. Bot continues with categorization

## Benefits

1. **Better User Experience**: Users can fix issues without resending photos
2. **Higher Success Rate**: Recovers from extraction failures gracefully
3. **Learning Opportunity**: User corrections help improve future extractions
4. **Transparency**: Users understand what went wrong and how to fix it
5. **Flexibility**: Multiple recovery paths based on error type

## Commands

- `/start` - Welcome message
- `/help` - Usage instructions
- `/stats` - Spending summary
- `/cancel` - Cancel pending operation (NEW)

## Technical Details

### Pending Workflow Types

```typescript
type PendingWorkflowType =
  | "merchant_correction"
  | "amount_correction"
  | "category_selection"
  | "retry_extraction";
```

### State Management

- Workflows stored in memory (Map)
- Keyed by user ID
- Automatic cleanup every 30 minutes
- Cleared after successful processing or /cancel

### Error Type Mapping

- `validation` + Unknown Merchant → Request merchant correction
- `validation` + Zero amount → Request amount correction
- `extraction` → Request retry with guidance
- Other errors → Standard error message

## Future Enhancements

1. Add date/time correction flow
2. Support editing already-stored transactions
3. Add confirmation before storing corrected data
4. Persist pending workflows to database for crash recovery
5. Add timeout notifications for abandoned workflows
6. Support voice input for corrections
