# Requirements Document - Agent Loop v2

## Introduction

This document specifies the requirements for v2 of the Receipt Tracker Agent, transforming it from a single-turn fixed workflow (v1) into a multi-turn conversational system with a supervisor agent pattern. 

**v1 (Current):** Fixed workflow with hard-coded conditional logic for transaction processing
**v2 (This Spec):** Multi-turn agent loop with adaptive decision-making

The v2 system will consist of a Main Conversation Agent that handles overall conversation flow and intent routing, and an Adaptive Transaction Sub-Agent that intelligently processes receipt transactions through dynamic decision-making rather than the fixed conditional edges used in v1.

## Glossary

- **Main Conversation Agent**: The supervisor agent that maintains conversation context, analyzes user intent, and routes requests to appropriate sub-agents
- **Transaction Sub-Agent**: A specialized agent that processes receipt transactions with adaptive decision-making capabilities
- **Agent Decision Node**: A workflow node where an LLM analyzes current state and decides the next action dynamically
- **Conversation State**: The persistent context maintained by the Main Agent including conversation history and active sub-agent status
- **Sub-Agent State**: The isolated state maintained by a sub-agent during task execution
- **Intent Analysis**: The process of determining what the user wants to accomplish from their message
- **Adaptive Workflow**: A workflow where the agent decides next steps dynamically rather than following fixed conditional logic
- **Field Validation**: The process of checking whether transaction fields (merchant, amount, category) are valid, invalid, or missing
- **Checkpointing**: LangGraph's mechanism for persisting workflow state to enable resumption and multi-turn conversations

## Requirements

### Requirement 1: Main Conversation Agent - Intent Analysis

**User Story:** As a user, I want the agent to understand what I'm trying to do from my message, so that it can route me to the appropriate functionality

#### Acceptance Criteria

1. WHEN a user sends a message, THE Main Conversation Agent SHALL analyze the message to determine user intent
2. THE Main Conversation Agent SHALL classify intent into one of the following categories: transaction processing, general conversation, or system command
3. WHEN the intent is transaction processing, THE Main Conversation Agent SHALL route the request to the Transaction Sub-Agent
4. WHEN the intent is general conversation, THE Main Conversation Agent SHALL respond directly without invoking sub-agents
5. THE Main Conversation Agent SHALL use conversation history as context when analyzing intent

### Requirement 2: Main Conversation Agent - Conversation State Management

**User Story:** As a user, I want the agent to remember our conversation context, so that I can have natural multi-turn interactions

#### Acceptance Criteria

1. WHEN a conversation begins, THE Main Conversation Agent SHALL create a unique conversation identifier
2. THE Main Conversation Agent SHALL persist conversation state using LangGraph's PostgreSQL checkpointing mechanism
3. WHEN a user sends a follow-up message, THE Main Conversation Agent SHALL load the existing conversation state before processing
4. THE Main Conversation Agent SHALL maintain conversation history including all user messages and agent responses
5. THE Main Conversation Agent SHALL track which sub-agent is currently active and its state

### Requirement 3: Main Conversation Agent - Sub-Agent Coordination

**User Story:** As a user, I want seamless handoff between the main agent and specialized agents, so that I don't notice the internal architecture

#### Acceptance Criteria

1. WHEN routing to a sub-agent, THE Main Conversation Agent SHALL prepare the necessary state and context for the sub-agent
2. THE Main Conversation Agent SHALL invoke the sub-agent with a unique thread identifier for checkpoint isolation
3. WHEN a sub-agent completes its task, THE Main Conversation Agent SHALL receive the result and update conversation state
4. THE Main Conversation Agent SHALL incorporate sub-agent responses into the conversation history
5. WHEN a sub-agent requests user input, THE Main Conversation Agent SHALL pause and wait for the next user message before resuming

### Requirement 4: Main Conversation Agent - Conversation Lifecycle

**User Story:** As a user, I want to control the conversation with commands, so that I can cancel, restart, or get help at any time

#### Acceptance Criteria

1. WHEN a user sends a "cancel" command, THE Main Conversation Agent SHALL terminate the active sub-agent and reset conversation state
2. WHEN a user sends a "help" command, THE Main Conversation Agent SHALL provide context-aware guidance based on current conversation state
3. WHEN a user sends a "status" command, THE Main Conversation Agent SHALL summarize the current state and any pending actions
4. THE Main Conversation Agent SHALL recognize conversation control commands at any point in the dialogue
5. THE Main Conversation Agent SHALL expire inactive conversations after 24 hours

### Requirement 5: Transaction Sub-Agent - Adaptive Decision Making

**User Story:** As a user, I want the agent to intelligently decide what information to request, so that the conversation feels natural and efficient

#### Acceptance Criteria

1. THE Transaction Sub-Agent SHALL use an LLM-based decision node to determine the next action dynamically
2. WHEN analyzing transaction state, THE Transaction Sub-Agent SHALL consider field validation status, extraction confidence, and business rules
3. THE Transaction Sub-Agent SHALL prioritize requesting critical fields (merchant, amount) before optional fields (category)
4. WHEN all required fields are valid, THE Transaction Sub-Agent SHALL proceed to store the transaction without unnecessary clarification
5. THE Transaction Sub-Agent SHALL provide reasoning for its decisions in logs for debugging and transparency

### Requirement 6: Transaction Sub-Agent - Field Validation and State Tracking

**User Story:** As a user, I want the agent to track what information is missing or invalid, so that it can guide me through providing the correct details

#### Acceptance Criteria

1. THE Transaction Sub-Agent SHALL validate each transaction field as valid, invalid, or missing after extraction
2. WHEN a field is missing, THE Transaction Sub-Agent SHALL mark it as requiring user input
3. WHEN a field is invalid, THE Transaction Sub-Agent SHALL determine whether to request correction or retry extraction
4. THE Transaction Sub-Agent SHALL maintain validation status for merchant name, amount, and category fields
5. WHEN a user provides information, THE Transaction Sub-Agent SHALL update the corresponding field and re-validate

### Requirement 7: Transaction Sub-Agent - Dynamic Clarification Requests

**User Story:** As a user, I want the agent to ask specific questions based on what's missing, so that I only provide information that's actually needed

#### Acceptance Criteria

1. WHEN the merchant name is missing or invalid, THE Transaction Sub-Agent SHALL request the merchant name from the user
2. WHEN the amount is missing or invalid, THE Transaction Sub-Agent SHALL request the amount from the user
3. WHEN the category is missing, THE Transaction Sub-Agent SHALL attempt automatic categorization before requesting user input
4. THE Transaction Sub-Agent SHALL generate contextual clarification messages that reference the current transaction state
5. THE Transaction Sub-Agent SHALL support receiving clarification responses in natural language format

### Requirement 8: Transaction Sub-Agent - Intelligent Categorization

**User Story:** As a user, I want the agent to automatically categorize transactions when confident, so that I don't have to manually select categories for obvious transactions

#### Acceptance Criteria

1. WHEN merchant and amount are valid but category is missing, THE Transaction Sub-Agent SHALL attempt automatic categorization
2. WHEN categorization confidence exceeds the threshold, THE Transaction Sub-Agent SHALL accept the category without user confirmation
3. WHEN categorization confidence is below the threshold, THE Transaction Sub-Agent SHALL request category selection from the user
4. THE Transaction Sub-Agent SHALL provide suggested categories based on merchant and transaction history
5. WHEN a user selects a category, THE Transaction Sub-Agent SHALL learn from the correction for future categorizations

### Requirement 9: Transaction Sub-Agent - Multi-Turn Processing Loop

**User Story:** As a user, I want to provide transaction details incrementally across multiple messages, so that I can correct or add information naturally

#### Acceptance Criteria

1. THE Transaction Sub-Agent SHALL support receiving user input across multiple conversation turns
2. WHEN requesting information, THE Transaction Sub-Agent SHALL return control to the Main Agent and wait for user response
3. WHEN the user provides requested information, THE Transaction Sub-Agent SHALL resume from its previous state
4. THE Transaction Sub-Agent SHALL loop through validation and decision-making until all fields are valid
5. WHEN all fields are valid, THE Transaction Sub-Agent SHALL store the transaction and mark itself as completed

### Requirement 10: Transaction Sub-Agent - Image Extraction Integration

**User Story:** As a user, I want to send a receipt photo and have the agent extract details automatically, so that I don't have to type everything manually

#### Acceptance Criteria

1. WHEN the Transaction Sub-Agent receives image data, THE Transaction Sub-Agent SHALL invoke the vision processor to extract transaction details
2. THE Transaction Sub-Agent SHALL only attempt extraction once per image to avoid redundant API calls
3. WHEN extraction confidence is very low, THE Transaction Sub-Agent SHALL request a clearer photo from the user
4. THE Transaction Sub-Agent SHALL preserve extracted data across conversation turns for incremental correction
5. WHEN extraction is successful, THE Transaction Sub-Agent SHALL proceed to field validation

### Requirement 11: Transaction Sub-Agent - Transaction Storage

**User Story:** As a user, I want my transaction to be saved only when all details are correct, so that my financial records are accurate

#### Acceptance Criteria

1. THE Transaction Sub-Agent SHALL only store a transaction when all required fields are valid
2. WHEN storing a transaction, THE Transaction Sub-Agent SHALL include the conversation identifier for traceability
3. THE Transaction Sub-Agent SHALL generate a confirmation message with transaction details after successful storage
4. THE Transaction Sub-Agent SHALL mark itself as completed after storing the transaction
5. WHEN storage fails, THE Transaction Sub-Agent SHALL report the error to the Main Agent and request retry

### Requirement 12: Transaction Sub-Agent - Error Handling and Recovery

**User Story:** As a user, I want helpful error messages and recovery options, so that I can fix issues without starting over

#### Acceptance Criteria

1. WHEN extraction fails, THE Transaction Sub-Agent SHALL provide a clear error message and suggest recovery actions
2. WHEN validation fails, THE Transaction Sub-Agent SHALL identify the specific invalid field and request correction
3. THE Transaction Sub-Agent SHALL support retrying extraction with a new image if the original is unclear
4. WHEN an unexpected error occurs, THE Transaction Sub-Agent SHALL log the error and return a user-friendly message
5. THE Transaction Sub-Agent SHALL preserve partial transaction data during error recovery to avoid losing user progress

### Requirement 13: Checkpointing and State Persistence

**User Story:** As a user, I want to resume interrupted conversations, so that I can continue where I left off if I get disconnected

#### Acceptance Criteria

1. THE Main Conversation Agent SHALL use LangGraph's PostgreSQL checkpointing to persist state after each turn
2. THE Transaction Sub-Agent SHALL use a separate checkpoint thread to isolate its state from the main conversation
3. WHEN a user returns after interruption, THE Main Conversation Agent SHALL load the most recent checkpoint and resume
4. THE System SHALL store checkpoints in the Supabase database for durability
5. THE System SHALL clean up expired checkpoints after 24 hours to manage storage

### Requirement 14: Conversation History Management

**User Story:** As a user, I want the agent to reference our previous exchanges, so that the conversation feels coherent and contextual

#### Acceptance Criteria

1. THE Main Conversation Agent SHALL append each user message and agent response to the conversation history
2. THE Main Conversation Agent SHALL include conversation history when analyzing intent
3. THE Transaction Sub-Agent SHALL access conversation history to generate contextual clarification requests
4. THE System SHALL limit conversation history to the most recent 20 messages to manage token usage
5. WHEN conversation history exceeds the limit, THE System SHALL summarize older messages to preserve context

### Requirement 15: Response Generation

**User Story:** As a user, I want natural, conversational responses, so that interacting with the agent feels friendly and intuitive

#### Acceptance Criteria

1. THE Main Conversation Agent SHALL generate conversational responses for general queries
2. THE Transaction Sub-Agent SHALL generate contextual messages that reference the current transaction state
3. THE System SHALL use consistent tone and formatting across all agent responses
4. THE System SHALL include relevant emojis and formatting to improve readability
5. THE System SHALL avoid technical jargon in user-facing messages

### Requirement 17: Context Injection During Active Processing

**User Story:** As a user, I want to add information while the agent is processing, so that I can provide corrections or clarifications without waiting

#### Acceptance Criteria

1. WHEN a user sends a message while an agent is actively processing, THE System SHALL pause the agent execution
2. THE System SHALL inject the new message as additional context into the current agent state
3. THE agent SHALL incorporate the injected context when making its next decision
4. WHEN context is injected, THE agent SHALL resume processing from its current decision point with the updated state
5. THE System SHALL support context injection for both the Main Conversation Agent and Transaction Sub-Agent
