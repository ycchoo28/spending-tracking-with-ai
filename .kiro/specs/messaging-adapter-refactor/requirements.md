# Requirements Document

## Introduction

This feature refactors the Receipt Tracker Agent to decouple the messaging platform (Telegram) from the core workflow logic. Currently, all Telegram-specific logic is tightly coupled with the workflow orchestration in `index.ts`, making it difficult to support other messaging platforms or test the workflow independently. By implementing the Adapter Pattern, we will create a platform-agnostic messaging abstraction layer that allows the workflow to communicate with any platform without knowing platform-specific details.

## Requirements

### Requirement 1: Create Messaging Abstraction Layer

**User Story:** As a developer, I want a platform-agnostic messaging interface, so that I can easily swap between different messaging platforms (Telegram, Console, WhatsApp, etc.) without changing the core workflow logic.

#### Acceptance Criteria

1. WHEN the system is initialized THEN it SHALL provide a `MessagingAdapter` interface that defines all messaging operations
2. WHEN a messaging operation is needed THEN the system SHALL use the adapter interface methods without knowing the underlying platform
3. IF a new messaging platform needs to be added THEN the system SHALL only require implementing the `MessagingAdapter` interface
4. WHEN the adapter interface is defined THEN it SHALL include methods for: sending messages, sending options/buttons, sending transaction confirmations, sending errors, and requesting user input

### Requirement 2: Implement Telegram Adapter

**User Story:** As a developer, I want the existing Telegram functionality encapsulated in a dedicated adapter, so that all Telegram-specific code is isolated and the workflow remains platform-agnostic.

#### Acceptance Criteria

1. WHEN the Telegram adapter is created THEN it SHALL implement the `MessagingAdapter` interface
2. WHEN a photo is received via Telegram THEN the adapter SHALL download the image and invoke the `onImageReceived` callback
3. WHEN text is received via Telegram THEN the adapter SHALL invoke the `onTextReceived` callback
4. WHEN a button/option is selected via Telegram THEN the adapter SHALL invoke the `onOptionSelected` callback
5. WHEN the adapter needs to send a message THEN it SHALL translate the platform-agnostic message format to Telegram-specific API calls
6. WHEN the adapter is stopped THEN it SHALL gracefully shut down the Telegram bot

### Requirement 3: Create Workflow Orchestrator

**User Story:** As a developer, I want a platform-agnostic workflow orchestrator, so that the business logic for processing receipts is completely independent of the messaging platform.

#### Acceptance Criteria

1. WHEN the orchestrator is initialized THEN it SHALL accept a `MessagingAdapter` via dependency injection
2. WHEN an image is received THEN the orchestrator SHALL process it through the workflow graph without knowing the source platform
3. WHEN workflow processing completes THEN the orchestrator SHALL send responses via the injected adapter
4. WHEN categorization clarification is needed THEN the orchestrator SHALL request user input via the adapter
5. WHEN an error occurs THEN the orchestrator SHALL send error messages via the adapter
6. WHEN user corrections are needed THEN the orchestrator SHALL handle the correction workflow via the adapter

### Requirement 4: Refactor Index.ts to Bootstrap Only

**User Story:** As a developer, I want `index.ts` to only handle application initialization and wiring, so that it's clear, maintainable, and focused on bootstrapping the application.

#### Acceptance Criteria

1. WHEN the application starts THEN `index.ts` SHALL only initialize components and wire them together
2. WHEN components are initialized THEN `index.ts` SHALL inject dependencies (adapter into orchestrator)
3. WHEN the application is running THEN `index.ts` SHALL NOT contain any workflow logic or message handling logic
4. WHEN the application stops THEN `index.ts` SHALL coordinate graceful shutdown of all components

### Requirement 5: Maintain Existing Functionality

**User Story:** As a user, I want all existing features to work exactly as before, so that the refactoring doesn't break any current functionality.

#### Acceptance Criteria

1. WHEN a user sends a receipt photo THEN the system SHALL extract transaction details as before
2. WHEN extraction completes THEN the system SHALL categorize the transaction as before
3. WHEN categorization confidence is low THEN the system SHALL request user confirmation as before
4. WHEN a user selects a category THEN the system SHALL store the transaction as before
5. WHEN a transaction is stored THEN the system SHALL send a confirmation message as before
6. WHEN an error occurs THEN the system SHALL send appropriate error messages as before
7. WHEN a user sends corrections THEN the system SHALL handle merchant/amount corrections as before

### Requirement 6: Support Platform-Agnostic Types

**User Story:** As a developer, I want shared types for messaging operations, so that all adapters use consistent data structures.

#### Acceptance Criteria

1. WHEN messaging operations are performed THEN the system SHALL use platform-agnostic types (UserContext, TextMessage, OptionsMessage, etc.)
2. WHEN user context is needed THEN it SHALL include userId, sessionId, and optional metadata
3. WHEN images are passed THEN they SHALL use a common ImageInput type with data buffer and optional URL
4. WHEN transaction confirmations are sent THEN they SHALL use a TransactionSummary type
5. WHEN errors are sent THEN they SHALL use an ErrorMessage type with message, errorType, and optional suggestions
