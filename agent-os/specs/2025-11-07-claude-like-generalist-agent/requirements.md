# Requirements Research — Claude-Like Generalist Agent

## Inputs Reviewed
- Raw idea: "i want my current project to be like claude code where its more flexible. reference to reference-projects/claude-code-reverse"
- Product mission/roadmap/tech stack: files not present under `agent-os/product`, so context inferred from repository README and reference project docs already cited by user.

## Clarifying Questions & Answers
**Q1:** Should the main agent keep conversation control even when sub-agents run?
**Answer:** Main agent must act as a generalist assistant; it solves general questions and routes tasks to sub-agents (receipt tracking, trip planning, notes, etc.).

**Q2:** Tooling scope (arbitrary tools vs curated list)?
**Answer:** Reference Claude Code structure for routing/task handling, but no coding tools/tasks are required; focus is on multi-domain personal assistant workflows.

**Q3:** Orchestration style (LangGraph state machine vs Claude Task prompt)?
**Answer:** Use Claude Code architecture as structural inspiration; transaction agent becomes one sub-agent among many, coordinated by a generalist main agent capable of delegating tasks similar to Claude’s Task mechanism.

**Q4:** Conversation persistence needs?
**Answer:** Not explicitly expanded beyond existing ConversationManager, but system should handle personal assistant chats that may span receipts, trips, notes, etc.

**Q5:** Dynamic vs fixed tool registration?
**Answer:** Emulate Claude structure for routing; emphasis is on flexible sub-agent orchestration rather than IDE tool registration.

**Q6:** Out-of-scope workflows?
**Answer:** Coding-related requirements or tasks are out of scope for this agent structure.

**Q7:** Should we refactor the current code or rebuild from scratch?
**Answer:** Relocate the entire existing `src/` into `archive/receipt-agent-v1/` and create a brand-new `src/` that implements the Claude-like architecture; treat the archived code as read-only reference material.

**Existing Code Reuse Response:** Reference `reference-projects/claude-code-reverse` for structural inspiration; treat the archived receipt transaction agent as behavioral documentation while reimplementing it under the new contract.

**Visual Assets Check:** No visual files found in `planning/visuals/`.

## Existing Code to Reference
- Legacy receipt transaction workflow (for behavior reference only): `archive/receipt-agent-v1/src/features/receipt-processing/transaction-agent/`
- Legacy main agent LangGraph orchestration: `archive/receipt-agent-v1/src/features/receipt-processing/main-agent/main-agent.ts`
- Claude structural reference: `reference-projects/claude-code-reverse-main/README.md`

## Requirements Summary

- Provide a main generalist agent capable of answering everyday personal assistant queries, starting with receipt tracking.
- Archive the legacy `src/` implementation untouched in `archive/receipt-agent-v1/` before writing new code.
- Enable routing/delegation to the transaction agent through the new orchestration while keeping hooks for future verticals. Rebuild the transaction agent under the new contract instead of reusing the legacy modules directly.
- Main agent decides when to keep control versus invoke the transaction sub-agent, similar to Claude Code’s task orchestration.
- Maintain conversation context across domains so the user can switch topics fluidly within a single chat thread once additional agents arrive in later phases.
- Persist a todo/reminder store that mirrors Claude Code’s short-term memory so the agent can track outstanding follow-ups per conversation/user.

### Reusability Opportunities
- Reuse infrastructure concepts (LangGraph, ConversationManager, PostgreSQL checkpointer) but rebuild implementations under the new `src/`.
- Treat the archived transaction agent as documentation for desired behavior; the living version must be rewritten to satisfy the new manifest contract.
- Mirror Claude Code’s task routing structure from `reference-projects/claude-code-reverse` for delegation patterns and task lifecycle tracking.
- No requirement for zero-code sub-agent onboarding in this phase; only the transaction agent needs to plug into the new contract.

### Scope Boundaries
**In Scope:**
- Moving legacy code to the archive directory and bootstrapping a fresh `src/` codebase.
- Designing a Claude-like orchestration model inside this project.
- Defining roles, responsibilities, and interfaces between the generalist agent and the receipt transaction sub-agent.
- Rebuilding the transaction agent under the new contract and ensuring parity with the existing workflow.
- Implementing the persistent todo/reminder store and surfacing it through the agent loop.

**Out of Scope:**
- Coding/IDE-specific tooling or developer workflows.
- Building additional sub-agents (trip planner, notes, inbox) in this phase.
- Incremental modifications to the archived code after the cut.
- Non-personal-assistant domains (e.g., enterprise ops) unless they align with future roadmap.

### Technical Considerations
- Bootstrap a new TypeScript project under `src/` (tsconfig, linting, dependency injection) and ensure no imports reach back into `archive/receipt-agent-v1/`.
- Continue leveraging LangGraph nodes and typed state objects; may need extensible state schema for multi-domain context (active task metadata, domain-specific payloads).
- Ensure ConversationManager/checkpointer can store multi-domain history and sub-agent outputs for later recall.
- Define a standard contract for sub-agent invocation (input schema, expected outputs, error handling) so new domains can be plugged in easily.
- Replace rigid predefined flows with a Claude Code–style task orchestration where the main agent dynamically decides which tools/steps to execute next instead of following a static script.
- Reference `reference-projects/neu-translator-main` for designing an agent loop that lets the main agent spin up sub-agents on demand and gather their results back into the broader conversation.
- Ensure the task handoff contract is flexible enough for future sub-agents, even though only the transaction agent ships now.

## Visual Assets
No visual assets provided.
