# Implementation Plan

- [x] 1. Rename workflow files for better clarity

  - Rename `src/features/receipt-processing/workflow/graph.ts` to `workflow.ts`
  - Update all imports of `graph.ts` to `workflow.ts` across the codebase
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2. Create messaging abstraction layer

  - Create `src/core/messaging/` directory structure
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 2.1 Create platform-agnostic messaging types

  - Create `src/core/messaging/types.ts` with UserContext, ImageInput, TextMessage, OptionsMessage, TransactionSummary, ErrorMessage interfaces
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 2.2 Create MessagingAdapter interface

  - Create `src/core/messaging/messaging-adapter.ts` with MessagingAdapter and MessagingAdapterCallbacks interfaces
  - Define all required methods: start, stop, sendMessage, sendOptions, sendTransactionConfirmation, sendError, requestTextInput
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 3. Implement Console Adapter for testing

  - Create `src/core/messaging/console-adapter.ts` implementing MessagingAdapter
  - Implement readline interface for user input
  - Support commands: image <path>, text <msg>, exit
  - _Requirements: 1.3_

- [x] 4. Implement Telegram Adapter

  - Create `src/core/messaging/telegram-adapter.ts` implementing MessagingAdapter
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

- [x] 4.1 Set up Telegram adapter structure and initialization

  - Create TelegramAdapter class with constructor accepting config and callbacks
  - Initialize Telegraf bot and WorkflowStateManager
  - Implement start() and stop() lifecycle methods
  - _Requirements: 2.1, 2.6_

- [x] 4.2 Implement Telegram event handlers

  - Register photo handler that downloads images and invokes onImageReceived callback
  - Register text handler that invokes onTextReceived callback
  - Register callback_query handler for button selections that invokes onOptionSelected callback
  - Register command handlers (/start, /help, /cancel)
  - _Requirements: 2.2, 2.3, 2.4_

- [x] 4.3 Implement Telegram outbound messaging methods

  - Implement sendMessage() to send text messages via Telegram API
  - Implement sendOptions() to create inline keyboards with buttons
  - Implement sendTransactionConfirmation() to format and send transaction details
  - Implement sendError() to send error messages with suggestions
  - Implement requestTextInput() to prompt user for text input
  - _Requirements: 2.5_

- [x] 4.4 Implement helper methods for Telegram adapter

  - Create createUserContext() to convert Telegram context to UserContext
  - Create getChatId() to extract chat ID from UserContext
  - _Requirements: 2.1, 2.5_

- [x] 5. Create Workflow Orchestrator

  - Create `src/features/receipt-processing/workflow/workflow-orchestrator.ts`
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 5.1 Set up orchestrator structure and dependencies

  - Create WorkflowOrchestrator class with constructor accepting adapter, workflow graph, database, categorizer, and config
  - Initialize pendingWorkflows Map for tracking user corrections
  - _Requirements: 3.1_

- [x] 5.2 Implement main workflow handlers

  - Implement handleImageReceived() to process images through workflow graph
  - Implement handleTextReceived() to route text input to appropriate correction handler
  - Implement handleOptionSelected() to handle category selection
  - _Requirements: 3.2, 3.3, 3.4_

- [x] 5.3 Implement workflow result handling

  - Handle successful extraction and categorization results
  - Send transaction confirmations via adapter
  - Handle clarification requests by sending options via adapter
  - Handle errors by sending error messages via adapter
  - _Requirements: 3.3, 3.4, 3.5_

- [x] 5.4 Implement correction workflow handlers

  - Implement handleMerchantCorrection() to update merchant name and re-categorize
  - Implement handleAmountCorrection() to parse and update amount, then re-categorize
  - Implement handleRetryExtraction() to handle manual data entry
  - Manage pending workflows state for multi-step corrections
  - _Requirements: 3.6_

- [x] 5.5 Implement category selection handler

  - Handle category selection from user
  - Update transaction category via categorizer.learnFromCorrection()
  - Send confirmation via adapter
  - _Requirements: 3.3, 3.4_

- [x] 6. Refactor index.ts to bootstrap only

  - Simplify ReceiptTrackerAgent class to only initialize and wire components
  - Remove all workflow logic and message handling from index.ts
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 6.1 Update ReceiptTrackerAgent initialization

  - Keep initialization of database, visionProcessor, categorizer, workflowGraph, memoryMonitor
  - Create WorkflowOrchestrator instance
  - Create TelegramAdapter with orchestrator callbacks
  - Wire adapter into orchestrator
  - _Requirements: 4.1, 4.2_

- [x] 6.2 Simplify start() and stop() methods

  - Update start() to only call memoryMonitor.start() and messagingAdapter.start()
  - Update stop() to only call memoryMonitor.stop() and messagingAdapter.stop()
  - _Requirements: 4.4_

- [x] 6.3 Remove workflow logic from index.ts

  - Delete handlePhotoReceived() method (moved to orchestrator)
  - Delete handleCategorySelected() method (moved to orchestrator)
  - Delete handleUserTextInput() method (moved to orchestrator)
  - Delete handleMerchantCorrection() method (moved to orchestrator)
  - Delete handleAmountCorrection() method (moved to orchestrator)
  - Delete handleRetryExtraction() method (moved to orchestrator)
  - _Requirements: 4.3_

- [x] 7. Update imports and exports

  - Update all files that import from `graph.ts` to import from `workflow.ts`
  - Export messaging types and adapters from `src/core/messaging/index.ts`
  - Export WorkflowOrchestrator from workflow module
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 8. Verify existing functionality

  - Test photo upload and extraction
  - Test categorization with high confidence (auto-save)
  - Test categorization with low confidence (clarification request)
  - Test category selection
  - Test merchant correction workflow
  - Test amount correction workflow
  - Test error handling
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

- [x] 9. Test with Console Adapter

  - Create test script using ConsoleAdapter
  - Test image processing via console
  - Test text input handling
  - Test option selection
  - _Requirements: 1.3_

- [x] 10. Cleanup and documentation
  - Remove deprecated telegram-bot.ts if no longer needed
  - Update README with new architecture
  - Add code comments explaining adapter pattern
  - _Requirements: 4.3_
