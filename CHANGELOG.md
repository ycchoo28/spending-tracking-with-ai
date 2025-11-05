# Changelog

All notable changes to the Receipt Tracker Agent project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.2.0] - 2025-11-05

### Removed
- **Code Cleanup**: Removed unused features that were never utilized in production
  - Removed `injectedContext` feature and related logic
  - Removed `shouldContinue` mechanism (always hardcoded to false)
  - Removed `checkContinuationNode` function and continuation edges
  - Removed orchestrator execution state tracking (`isProcessing`, `activeExecutions`)
  - Removed unused imports and helper methods

### Changed
- Simplified `ConversationOrchestrator` to clean request/response pattern
- Simplified main agent workflow graph (removed continuation logic)
- Updated state types to remove unused fields
- Improved code clarity by removing ~150 lines of dead code

### Documentation
- Updated README_V2.md to reflect actual architecture
- Clarified that each user message triggers a new invocation
- Removed references to context injection during processing
- Added CLEANUP-SUMMARY.md documenting all changes

## [2.1.0] - 2025-11-04

### Fixed
- **Critical**: Fixed infinite loop when transaction storage fails
  - `invokeTransactionAgentNode` now checks for `result.error` in addition to `result.completed`
  - `activeSubAgent` is cleared when errors occur, preventing endless retries
  - Logic: `const shouldKeepActive = !result.completed && !result.error;`
  - Previously, failed transactions would cause the agent to loop indefinitely
  - Now, errors properly terminate the conversation and return user-friendly messages

### Changed
- Improved error handling in main agent node
- Enhanced documentation with bug fix details and debugging guide

## [2.0.0] - 2025-10-22

### Added
- **Complete rewrite**: Agent Loop v2 with multi-turn conversation support
- **Supervisor pattern**: Main Conversation Agent + Transaction Sub-Agent architecture
- **Adaptive decision-making**: LLM-based decision node replaces hard-coded conditional logic
- **Multi-turn conversations**: Users can provide information incrementally across multiple messages
- **PostgreSQL checkpointing**: Conversation state persists in Supabase for resumption and debugging
- **Conversation lifecycle management**: Automatic expiration after 24 hours, cleanup jobs
- **Intelligent field validation**: Dynamic validation with prioritization of critical fields
- **LangSmith tracing**: Full observability of agent execution with trace viewing

### Changed
- Replaced fixed workflow (v1) with adaptive agent loop (v2)
- Moved v1 implementation to `_archive_v1/` directory for reference
- Updated database schema with new tables: `conversations`, `conversation_messages`, `checkpoints`
- Updated `transactions` table with `conversation_id` and `turn_number` columns
- Refactored messaging adapters to use new `onMessage` callback pattern
- Updated configuration with v2-specific settings (conversation expiration, LLM model, etc.)

### Removed
- v1 fixed workflow with hard-coded conditional edges (archived, not deleted)
- Single-turn processing limitation
- Message buffering (replaced with context injection)

## [1.0.0] - 2025-10-15

### Added
- Initial release with fixed workflow
- Receipt image processing with vision AI
- Automatic transaction categorization
- Telegram bot interface
- Supabase database integration
- Category learning from user corrections
- Interactive error recovery for missing fields
- LangGraph workflow orchestration (v1 fixed workflow)

### Features
- Single-turn receipt processing
- Hard-coded conditional logic for field validation
- Category suggestions based on merchant history
- User preference management
- Transaction history tracking

---

## Migration Notes

### v1 to v2 Migration

**Breaking Changes:**
- Complete architecture rewrite - no backward compatibility
- New database tables required (migrations provided)
- Different conversation flow (multi-turn vs single-turn)
- New configuration variables for agent loop

**Migration Steps:**
1. Run database migrations: `supabase/migrations/20241022000001_agent_loop_v2_schema.sql`
2. Update `.env` with v2 configuration variables
3. Restart application - v2 will be used automatically
4. Old v1 code is preserved in `_archive_v1/` for reference

**What's Preserved:**
- All existing transactions in database
- User preferences and category learning
- Vision processing and categorization logic
- Database client and core utilities

**What's New:**
- Conversation state management
- Multi-turn interaction support
- Adaptive agent decision-making
- Context injection during processing
- PostgreSQL checkpointing

---

## Versioning Strategy

- **Major version (X.0.0)**: Breaking changes, architecture rewrites
- **Minor version (2.X.0)**: New features, enhancements, non-breaking changes
- **Patch version (2.1.X)**: Bug fixes, documentation updates, minor improvements

---

## Links

- [v2 Architecture Documentation](src/features/receipt-processing/README_V2.md)
- [v2 Requirements](.kiro/specs/multi-turn-agent-loop/requirements.md)
- [v2 Design Document](.kiro/specs/multi-turn-agent-loop/design.md)
- [Main README](README.md)
