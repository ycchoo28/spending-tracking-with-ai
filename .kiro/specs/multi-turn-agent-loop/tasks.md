# Implementation Plan

- [x] 1. Archive v1 and set up project structure

  - Move existing workflow code to `_archive_v1/` directory
  - Create new directory structure for main-agent and transaction-agent
  - Update imports in index files to prepare for new implementation
  - _Requirements: All requirements (foundational)_

- [x] 2. Set up database schema and checkpointing

  - Create conversations table with status tracking
  - Create conversation_messages table for history
  - Create checkpoints table for LangGraph state persistence
  - Add conversation tracking columns to transactions table
  - Configure PostgreSQL checkpointer for LangGraph
  - _Requirements: 2, 13_

- [x] 3. Implement Conversation Orchestrator
- [x] 3.1 Create ConversationOrchestrator class

  - Implement agent execution state tracking
  - Add message handling logic
  - Add context injection mechanism during processing
  - Implement checkpoint load/save for context injection
  - _Requirements: 3, 17_

- [x] 3.2 Implement conversation lifecycle management

  - Add conversation creation and initialization
  - Implement conversation expiration logic (24 hours)
  - Add cleanup job for expired conversations
  - _Requirements: 4, 13_

- [x] 4. Implement Main Conversation Agent
- [x] 4.1 Create ConversationState interface and types

  - Define conversation state structure
  - Define conversation message format
  - Add injectedContext field for context injection
  - _Requirements: 2, 14_

- [x] 4.2 Implement analyzeIntentNode

  - Create LLM prompt for intent classification
  - Implement intent analysis logic (transaction, general, command)
  - Include conversation history in analysis
  - Handle injected context in intent analysis
  - _Requirements: 1, 14_

- [x] 4.3 Implement routeToTransactionNode

  - Extract image data from message
  - Extract text content from message
  - Prepare sub-agent state with context
  - Generate unique sub-agent thread ID
  - _Requirements: 3_

- [x] 4.4 Implement invokeTransactionAgentNode

  - Invoke transaction sub-agent with prepared state
  - Handle sub-agent completion status
  - Extract response message from sub-agent result
  - _Requirements: 3_

- [x] 4.5 Implement handleGeneralNode

  - Create conversational response prompt
  - Include conversation history
  - Handle injected context
  - Generate natural language responses
  - _Requirements: 1, 15_

- [x] 4.6 Implement handleCommandNode

  - Handle "cancel" command
  - Handle "help" command with context-aware guidance
  - Handle "status" command with conversation summary
  - _Requirements: 4_

- [x] 4.7 Implement updateHistoryNode

  - Append user message to conversation history
  - Append agent response to conversation history
  - Persist messages to database
  - Limit history to most recent 20 messages
  - _Requirements: 2, 14_

- [x] 4.8 Implement checkContinuationNode

  - Determine if conversation should continue
  - Check for active sub-agent
  - Set shouldContinue flag
  - _Requirements: 2_

- [x] 4.9 Create Main Agent workflow graph

  - Define state channels
  - Add all nodes to graph
  - Configure conditional routing based on intent
  - Add loop-back edge for multi-turn conversations
  - Compile graph with checkpointer
  - _Requirements: 1, 2, 3, 4_

- [x] 5. Implement Transaction Sub-Agent
- [x] 5.1 Create TransactionAgentState interface and types

  - Define transaction agent state structure
  - Define ExtractedTransaction interface
  - Define validation status structure
  - Add fields for agent decision tracking
  - _Requirements: 6, 10_

- [x] 5.2 Implement extractIfNeededNode

  - Check if image data exists and extraction not done
  - Call vision processor for extraction
  - Handle extraction errors gracefully
  - Initialize empty extracted data if no image
  - _Requirements: 10, 12_

- [x] 5.3 Implement applyUserContextNode

  - Check for user-provided context
  - Use LLM to extract structured data from text
  - Update extracted data with user-provided information
  - Handle injected context from orchestrator
  - _Requirements: 7, 17_

- [x] 5.4 Implement validateFieldsNode

  - Validate merchant name (valid, invalid, missing)
  - Validate amount (valid, invalid, missing)
  - Validate category (valid, invalid, missing)
  - Return validation status for all fields
  - _Requirements: 6_

- [x] 5.5 Implement agentDecideActionNode (Core Decision Logic)

  - Create comprehensive decision prompt with current state
  - Include validation status in prompt
  - Define available actions and decision rules
  - Call LLM to decide next action
  - Parse action and reasoning from response
  - _Requirements: 5, 6_

- [x] 5.6 Implement requestMerchantNode

  - Generate contextual message requesting merchant name
  - Include available transaction details in message
  - Set completed flag to false
  - _Requirements: 7_

- [x] 5.7 Implement requestAmountNode

  - Generate contextual message requesting amount
  - Include available transaction details in message
  - Set completed flag to false
  - _Requirements: 7_

- [x] 5.8 Implement requestCategoryNode

  - Generate message requesting category selection
  - Include transaction details in message
  - Prepare suggested categories for display
  - Set completed flag to false
  - _Requirements: 7_

- [x] 5.9 Implement categorizeNode

  - Call transaction categorizer with extracted data
  - Check categorization confidence against threshold
  - If low confidence, set next action to request_category
  - If high confidence, accept category automatically
  - _Requirements: 8_

- [x] 5.10 Implement storeTransactionNode

  - Store transaction to database with all fields
  - Include conversation tracking fields
  - Generate confirmation message with transaction details
  - Set completed flag to true
  - Handle storage errors with retry logic
  - _Requirements: 11, 12_

- [x] 5.11 Implement requestBetterImageNode

  - Generate helpful message about image quality
  - Provide tips for better photo capture
  - Set completed flag to false
  - _Requirements: 12_

- [x] 5.12 Create Transaction Agent workflow graph

  - Define state channels
  - Add all nodes to graph
  - Configure dynamic routing based on agent decisions
  - Add loop-back edges for multi-turn processing
  - Add end edges for completion and waiting states
  - Compile graph
  - _Requirements: 5, 6, 7, 8, 9, 10, 11, 12_

- [x] 6. Integrate with messaging adapters
- [x] 6.1 Update messaging adapter interface

  - Ensure adapters can handle multi-turn conversations
  - Add support for conversation context
  - Update message handling to use orchestrator
  - _Requirements: 1, 2_

- [x] 6.2 Update Telegram adapter integration

  - Route incoming messages to orchestrator
  - Handle image and text messages
  - Display category selection options
  - Handle command messages
  - _Requirements: 1, 7_

- [x] 6.3 Update Console adapter integration

  - Route incoming messages to orchestrator
  - Handle multi-turn console interactions
  - Display conversation flow clearly
  - _Requirements: 1_

- [x] 7. Update main application entry point

  - Initialize conversation orchestrator
  - Initialize main agent with dependencies
  - Initialize transaction sub-agent with dependencies
  - Configure PostgreSQL checkpointer
  - Wire up messaging adapters to orchestrator
  - Remove old v1 workflow initialization
  - _Requirements: All_

- [x] 8. Implement error handling and logging

  - Add comprehensive error logging with conversation context
  - Implement error recovery strategies
  - Add user-friendly error messages
  - Log agent decisions for debugging
  - Add performance tracking for agent operations
  - _Requirements: 12_

- [x] 9. Add configuration management

  - Create configuration interface for agent loop
  - Set default values for thresholds and timeouts
  - Add environment variable support
  - Configure LLM model and parameters
  - _Requirements: All_

- [x] 10. Testing and validation
- [x] 10.1 Write unit tests for Main Agent nodes

  - Test intent analysis with various inputs
  - Test routing logic
  - Test command handling
  - Test conversation history management
  - _Requirements: 1, 2, 4, 14_

- [x] 10.2 Write unit tests for Transaction Agent nodes

  - Test field validation logic
  - Test agent decision-making with various states
  - Test extraction and context application
  - Test categorization flow
  - Test transaction storage
  - _Requirements: 5, 6, 7, 8, 10, 11_

- [x] 10.3 Write integration tests for orchestrator

  - Test context injection during processing
  - Test agent execution state management
  - Test checkpoint persistence and loading
  - _Requirements: 3, 13, 17_

- [x] 10.4 Write end-to-end conversation flow tests

  - Test happy path: image → extract → categorize → store
  - Test clarification path: image → request merchant → store
  - Test context injection: image → text during processing → store
  - Test multi-turn: image → request amount → request category → store
  - Test error recovery flows
  - Test command interruption
  - _Requirements: All_

- [x] 11. Documentation and deployment
  - Update README with v2 architecture overview
  - Document conversation flow and agent decision-making
  - Add migration guide from v1 to v2
  - Create deployment checklist
  - Document monitoring and alerting setup
  - _Requirements: All_
