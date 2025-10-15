# Requirements Document

## Introduction

This feature implements an intelligent receipt and e-wallet transaction tracking agent that processes images sent via Telegram, extracts spending information using vision AI, categorizes expenses, and stores them in Supabase. The agent uses LangChain and LangGraph for orchestration and can interact with users through Telegram when it needs clarification on transaction categories.

## Requirements

### Requirement 1: Image Processing and Data Extraction

**User Story:** As a user, I want to send physical receipt images and e-wallet transaction screenshots to a Telegram bot, so that my spending is automatically recorded without manual data entry.

#### Acceptance Criteria

1. WHEN a user sends an image to the Telegram bot THEN the system SHALL receive and process the image
2. WHEN the system receives an image THEN it SHALL use OpenAI-compatible vision API to extract transaction details including amount, date/time, and payment method
3. WHEN processing e-wallet screenshots THEN the system SHALL handle multiple e-wallet formats (DuitNow, GrabPay, and other common Malaysian e-wallets)
5. IF the image quality is too poor or text is unreadable THEN the system SHALL notify the user via Telegram and request a clearer image

### Requirement 2: Intelligent Categorization

**User Story:** As a user, I want my transactions to be automatically categorized, so that I can track spending by category without manual effort.

#### Acceptance Criteria

1. WHEN transaction details are extracted THEN the system SHALL attempt to categorize the spending using LLM-based classification
2. WHEN categorizing THEN the system SHALL use merchant name, transaction type, and extracted details as context
3. WHEN the system has high confidence in a category THEN it SHALL automatically assign the category without user input
4. IF the system cannot confidently determine a category THEN it SHALL ask the user for clarification via Telegram
5. WHEN asking for clarification THEN the system SHALL provide suggested categories based on partial matches or similar past transactions
6. WHEN the user provides a category THEN the system SHALL learn from this input for future similar transactions
7. The system SHALL support common spending categories including: Food & Dining, Transportation, Shopping, Entertainment, Bills & Utilities, Healthcare, Groceries, Personal Care, Education, Travel & Vacation, Tech Gadgets, Subscriptions, and Others

### Requirement 3: Supabase Data Storage

**User Story:** As a user, I want my transaction data stored securely in Supabase, so that I can access and analyze my spending history.

#### Acceptance Criteria

1. WHEN a transaction is successfully processed and categorized THEN the system SHALL store it in Supabase
2. The stored transaction SHALL include: amount, currency, merchant name, category, date/time, payment method, transaction reference (if available), and image URL
3. WHEN storing data THEN the system SHALL associate transactions with the user's Telegram ID
4. IF the Supabase connection fails THEN the system SHALL retry with exponential backoff and notify the user if storage ultimately fails
5. The system SHALL maintain data integrity and prevent duplicate entries for the same transaction

### Requirement 4: Telegram Bot Interface

**User Story:** As a user, I want to interact with the agent through Telegram, so that I can easily submit receipts and respond to categorization questions.

#### Acceptance Criteria

1. WHEN the bot starts THEN it SHALL authenticate with Telegram API and be ready to receive messages
2. WHEN a user sends a photo message THEN the system SHALL acknowledge receipt and begin processing
3. WHEN processing is complete THEN the system SHALL send a confirmation message with extracted details and assigned category
4. WHEN the system needs clarification THEN it SHALL send an interactive message with category options
5. WHEN the user responds to a clarification request THEN the system SHALL update the transaction and confirm the action
6. The system SHALL support basic commands: /start (introduction), /help (usage instructions), /stats (spending summary)
7. IF an error occurs THEN the system SHALL send a user-friendly error message via Telegram

### Requirement 5: LangGraph Workflow Orchestration

**User Story:** As a developer, I want the agent logic implemented using LangGraph, so that the workflow is maintainable and can handle complex decision paths.

#### Acceptance Criteria

1. The system SHALL implement a LangGraph state machine with the following nodes: receive_image, extract_data, categorize, request_clarification, store_transaction, send_confirmation
2. WHEN an image is received THEN the workflow SHALL progress through the state machine based on processing results
3. IF categorization confidence is low THEN the workflow SHALL branch to the request_clarification node
4. WHEN user provides clarification THEN the workflow SHALL resume from the appropriate state
5. The system SHALL maintain conversation state across multiple user interactions
6. The workflow SHALL handle errors gracefully and allow recovery or user notification

### Requirement 6: OpenAI-Compatible API Integration

**User Story:** As a developer, I want to use a third-party OpenAI-compatible API, so that I have flexibility in choosing LLM providers.

#### Acceptance Criteria

1. The system SHALL accept configuration for custom API endpoints and API keys
2. WHEN making vision API calls THEN the system SHALL use the configured endpoint with OpenAI-compatible request format
3. WHEN making text completion calls for categorization THEN the system SHALL use the configured endpoint
4. The system SHALL handle API rate limits and errors appropriately
5. IF the API is unavailable THEN the system SHALL queue the transaction for retry and notify the user

### Requirement 7: Configuration and Deployment

**User Story:** As a developer, I want clear configuration management, so that I can easily deploy and maintain the system.

#### Acceptance Criteria

1. The system SHALL use environment variables for sensitive configuration: Telegram bot token, Supabase URL and key, OpenAI API endpoint and key
2. The system SHALL provide a configuration file for non-sensitive settings: category list, confidence thresholds, retry policies
3. The system SHALL include setup instructions in a README file
4. The system SHALL log important events and errors for debugging
5. WHEN deployed THEN the system SHALL run continuously and handle Telegram webhook or polling
