# Implementation Plan

- [x] 1. Set up project structure and dependencies

  - Initialize Node.js/TypeScript project with package.json
  - Install core dependencies: LangChain.js, LangGraph.js, telegraf, @supabase/supabase-js, sharp
  - Configure TypeScript with tsconfig.json
  - Set up project directory structure (src/config, src/telegram, src/workflow, src/vision, src/categorizer, src/database)
  - Create .env.example file with required environment variables
  - _Requirements: 7.1, 7.2_

- [-] 2. Implement configuration management

  - [x] 2.1 Create config.ts with typed configuration interface
    - Define Config interface with all required settings (Telegram, OpenAI, Supabase, application settings)
    - Implement configuration loader that reads from environment variables
    - Add validation for required configuration values
    - Set sensible defaults for optional values (confidence threshold, retry settings)
    - _Requirements: 7.1, 7.2_

- [x] 3. Set up Supabase database schema and client

  - [x] 3.1 Create database migration scripts

    - Write SQL migration for transactions table with all required columns
    - Write SQL migration for user_preferences table
    - Write SQL migration for category_learning table
    - Add indexes for performance optimization
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 3.2 Implement DatabaseClient class

    - Create database.ts with SupabaseClient initialization
    - Implement storeTransaction method with error handling
    - Implement getUserTransactions method with pagination
    - Implement getSimilarTransactions method for learning
    - Implement updateTransactionCategory method
    - Implement getSpendingStats method for /stats command
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [ ]\* 3.3 Write unit tests for database operations
    - Test CRUD operations with mock Supabase client
    - Test error handling for connection failures
    - Test query methods with various parameters
    - _Requirements: 3.1, 3.2, 3.3_

- [-] 4. Implement vision processing for receipt extraction

  - [x] 4.1 Create VisionProcessor class

    - Implement constructor with API configuration
    - Create buildVisionPrompt method with detailed extraction instructions
    - Implement extractTransactionData method that calls OpenAI-compatible vision API
    - Implement parseResponse method to structure extracted data into ExtractedTransaction interface
    - Add image preprocessing with sharp (resize, compress if needed)
    - Implement retry logic with exponential backoff for API failures
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 6.1, 6.2, 6.4_

  - [ ]\* 4.2 Write unit tests for vision processor
    - Mock API responses for various receipt formats
    - Test extraction accuracy with sample data
    - Test error handling for invalid images
    - Test retry logic for API failures
    - _Requirements: 1.1, 1.2, 1.3, 1.5_

- [-] 5. Implement transaction categorization engine

  - [x] 5.1 Create TransactionCategorizer class

    - Define CATEGORIES constant array with all spending categories
    - Implement constructor with LLM client and database client
    - Create buildCategorizationPrompt method that includes transaction details and historical context
    - Implement categorize method that returns category and confidence score
    - Implement getSimilarTransactions method to fetch user's transaction history
    - Implement suggestCategories method for low-confidence scenarios
    - Add logic to learn from user corrections by updating category_learning table
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 6.3_

  - [ ]\* 5.2 Write unit tests for categorization engine
    - Test category assignment with known merchants
    - Test confidence scoring with various scenarios
    - Test learning mechanism with user corrections
    - Test suggestion generation for ambiguous transactions
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

- [x] 6. Build LangGraph workflow state machine

  - [x] 6.1 Define workflow state and node functions

    - Create workflow.ts with WorkflowState interface
    - Implement receiveImageNode to initialize state with image data
    - Implement extractDataNode that calls VisionProcessor
    - Implement categorizeNode that calls TransactionCategorizer
    - Implement requestClarificationNode that prepares clarification message
    - Implement storeTransactionNode that saves to database
    - Implement sendConfirmationNode that formats confirmation message
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 6.2 Configure LangGraph state machine with conditional routing

    - Define conditional edge function isExtractionValid for validation check
    - Define conditional edge function shouldRequestClarification based on confidence threshold
    - Build StateGraph with all nodes and edges
    - Configure state channels for proper data flow
    - Compile the graph for execution
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [x] 6.3 Implement error handling and recovery

    - Create ErrorHandler class for workflow errors
    - Add error handling in each node function
    - Implement retry logic for transient failures
    - Add fallback paths for unrecoverable errors
    - _Requirements: 5.6, 6.5_

  - [ ]\* 6.4 Write integration tests for workflow
    - Test complete happy path from image to confirmation
    - Test clarification flow with low confidence
    - Test error recovery scenarios
    - Test state persistence across interruptions
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

- [x] 7. Implement Telegram bot interface

  - [x] 7.1 Create TelegramBotHandler class with basic commands

    - Initialize telegraf bot with token from config
    - Implement /start command with welcome message
    - Implement /help command with usage instructions
    - Implement /stats command that fetches and displays spending summary
    - Add error handling for bot initialization
    - _Requirements: 4.1, 4.7_

  - [x] 7.2 Implement photo message handling

    - Create handlePhoto method that receives photo messages
    - Download photo from Telegram servers
    - Send acknowledgment message to user
    - Trigger LangGraph workflow with image data
    - Store conversation state for async workflow continuation
    - _Requirements: 4.1, 4.2_

  - [x] 7.3 Implement interactive clarification messages

    - Create sendCategoryOptions method with inline keyboard
    - Format category options as interactive buttons
    - Include transaction details in clarification message
    - Implement handleCallbackQuery to process user's category selection
    - Resume workflow after receiving user input
    - _Requirements: 4.4, 4.5_

  - [x] 7.4 Implement confirmation and error messages

    - Create sendConfirmation method with formatted transaction details
    - Display amount, merchant, category, date/time in user-friendly format
    - Implement error message formatting for various error types
    - Add user-friendly explanations for common issues
    - _Requirements: 4.3, 4.7_

  - [ ]\* 7.5 Write tests for Telegram bot handlers
    - Mock Telegram context objects
    - Test command handlers with various inputs
    - Test photo message processing
    - Test callback query handling
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 8. Integrate all components and implement main entry point

  - [x] 8.1 Create main application entry point

    - Create index.ts that initializes all components
    - Load configuration and validate required settings
    - Initialize DatabaseClient with Supabase credentials
    - Initialize VisionProcessor with OpenAI API config
    - Initialize TransactionCategorizer with LLM client and database
    - Initialize LangGraph workflow
    - Initialize and launch TelegramBotHandler
    - Add graceful shutdown handling
    - _Requirements: 7.5_

  - [x] 8.2 Implement logging and monitoring

    - Set up structured logging with winston or pino
    - Add log statements for key events (image received, extraction complete, categorization, storage)
    - Log errors with full context for debugging
    - Add performance metrics tracking (processing time, API calls)
    - _Requirements: 7.4_

  - [x] 8.3 Add deployment configuration
    - Create Dockerfile for containerized deployment
    - Create docker-compose.yml for local development
    - Add PM2 ecosystem config for process management
    - Create deployment documentation in README
    - _Requirements: 7.3, 7.5_

- [x] 9. End-to-end testing and validation

  - Test with real e-wallet screenshots (DuitNow, GrabPay, Touch 'n Go)
  - Test with physical receipt images
  - Test edge cases (blurry images, partial receipts, foreign currency)
  - Validate /stats command accuracy
  - Test concurrent user handling
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 4.1, 4.2, 4.3_

- [ ] 10. Documentation and setup instructions

  - [ ] 10.1 Create comprehensive README

    - Document system overview and features
    - Provide step-by-step setup instructions
    - List all required environment variables with descriptions
    - Include Supabase setup instructions with migration steps
    - Add usage examples and screenshots
    - Document troubleshooting common issues
    - _Requirements: 7.3_

  - [ ] 10.2 Add inline code documentation
    - Add JSDoc comments to all public methods
    - Document complex logic and algorithms
    - Add type annotations for better IDE support
    - Include usage examples in comments
    - _Requirements: 7.3_
