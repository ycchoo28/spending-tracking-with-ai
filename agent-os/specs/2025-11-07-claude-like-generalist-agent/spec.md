# Claude-Like Generalist Agent Specification

## Summary
Archive the entire current `src/` implementation into `archive/receipt-agent-v1/` and rebuild a brand-new `src/` that delivers a Claude-Code-like generalist assistant from first principles. The new codebase must recreate receipt-tracking capabilities while introducing a modular orchestration core where the main agent behaves like Claude Code’s generalist brain and delegates focused work to sub-agents. The clean rebuild abandons legacy LangGraph wiring in favor of a task-based flow driven by policies inspired by `reference-projects/claude-code-reverse-main/results/prompts/system-workflow.prompt.md`, plus lightweight loop patterns from `reference-projects/neu-translator-main`. Legacy files remain only for reference in the archive; every runtime path under the fresh `src/` follows the new requirements and design.

## Goals & Success Criteria
1. **Generalist front door** – a brand-new conversational agent handles receipt-tracking chats today and is architected to cover broader personal-assistant queries later.
2. **Dynamic task routing** – the rebuilt main agent can spin up the (new) transaction sub-agent session on demand (and future agents later), each with scoped context, and merge results back into the live chat.
3. **Extensible sub-agent interface** – adding a new vertical in the future remains straightforward by writing a code-first sub-agent that implements the manifest/contract, without deep edits to the main orchestrator graph.
4. **Persistent multi-domain memory** – conversations keep context for at least 24 hours and store finalized task outcomes for reuse.
5. **Safety & observability** – every sub-agent invocation is logged with inputs/outputs, duration, and failure reason to aid audits.
6. **Legacy isolation** – the old `src/` lives in `archive/receipt-agent-v1/` as a reference only; the active runtime exclusively uses the new `src/`.

Success is measured by: (a) the new main agent resolving ≥90% of receipt-tracking prompts while routing to the rebuilt transaction agent appropriately, (b) transaction sub-agent launch latency under 2 seconds, (c) clear interfaces that let future sub-agents plug in with <1 day of orchestration work, and (d) parity regression tests confirming the archived implementation can be retired.

## Non-Goals
- Providing code-editing or IDE tooling (Claude Code is merely an architectural reference).
- Incrementally patching the legacy `src/`. Once archived it is untouched unless we need historical reference.
- Building UI surfaces beyond the existing Telegram interface.

## User & Conversation Flows
1. User asks any personal-assistant question.
2. Main agent interprets intent using embeddings + heuristics from LangGraph nodes.
3. If the request can be answered directly (FAQ, quick lookup), it replies immediately.
4. Otherwise it drafts a task capsule (goal, inputs, constraints) and invokes a sub-agent session.
5. Sub-agent performs multi-step work using its own tools (vision, Supabase, categorizer) — future agents could add travel APIs, note DBs, etc.
6. When finished, the sub-agent emits a structured result payload and optional follow-up suggestions.
7. Main agent summarizes output, updates memory (Todos, trip plan cache, etc.), and responds to the user.

## Architecture Overview

### Codebase Reset & Directory Layout
- **Archive step**: copy the current `src/` directory to `archive/receipt-agent-v1/` (preserve package.json lockfiles for provenance). No new code is added to the archive after this cut.
- **Fresh `src/` skeleton**: bootstrap a clean TypeScript project rooted at `src/` with clear subdirectories:
  - `src/core/` for LangGraph state definitions, policies, memory managers.
  - `src/agents/main/` for the generalist agent loop implementation.
  - `src/agents/transaction/` for the rewritten receipt sub-agent that conforms to the new contract.
  - `src/contracts/` for manifest schemas, TaskDraft/TaskResult types, and manifest loaders.
  - `src/platform/` for adapters (Supabase, telemetry, storage, todo store).
- **Compatibility harness**: add `scripts/run-legacy.sh` that can boot the archived version for emergency verification without touching the new runtime.
- **Testing layout**: mirror the new structure under `tests/` (e.g., `tests/core/policies.spec.ts`, `tests/agents/transaction.integration.ts`).

### Main Agent Loop
- Implement as a LangGraph state machine whose nodes represent: `ingest_message`, `decide_strategy`, `answer_directly`, `handoff_to_task`, `summarize_response`.
- Base handoff behavior on the logic described in `reference-projects/claude-code-reverse-main/results/prompts/system-workflow.prompt.md`, where the main agent launches a sub-agent whenever the task can be isolated, instead of trying to solve it inline.
- Replace hardcoded branches with policy functions that evaluate the current state (intent label, confidence, workload) to decide next node, emulating Claude’s prompt-led task tool while keeping typed state.
- State fields to include: `conversationId`, `userProfile`, `knownTasks[]`, `activeTask`, `contextSummary`, `lastTurnMetadata`.

### Sub-Agent Contract
Each sub-agent exposes:
- **Manifest**: id, description, supported intents, required capabilities, tooling dependencies.
- **Input schema**: normalized task capsule (goal, artifacts, constraints, success criteria).
- **Output schema**: status, primary result, structured data (transactions, itinerary entries, note IDs), recommended next actions.
- **Error handling**: typed errors bubbled up so the main agent can retry, fallback, or apologize.
Sub-agents run inside isolated LangGraph workflows or lightweight planners similar to `reference-projects/neu-translator-main`.

### Task Lifecycle
1. Main agent builds a `TaskDraft` and evaluates candidate sub-agents (only the transaction agent in this phase, but architecture keeps the scoring hook).
2. Selected agent receives the draft plus any attachments (images, OCR data, metadata).
3. Sub-agent records intermediate state to the PostgreSQL checkpointer for recoverability.
4. Upon completion it emits `TaskResult` which the main agent stores in `ConversationManager` and optional long-term memory (Supabase tables for receipts, etc.).
5. Main agent crafts the user-facing reply and updates Todos/notifications akin to Claude’s short-term memory files (implemented via Supabase or local JSON store).

### Memory & Persistence
- Continue using `ConversationManager` for 24-hour rolling context; add a summarization step for conversations older than 24h but still relevant.
- Implement a `TaskHistory` table (conversationId, taskId, agentId, status, payload) to allow referencing past receipt runs now and other domains later.
- Build a persistent todo/reminder store (Supabase table analogous to Claude’s `~/.claude/todos/`) so the main agent can surface outstanding follow-ups.

### Tooling & Manifest
- Maintain a curated tool list per agent (vision processor, categorizer, Supabase). Tools register declaratively so the main agent can inspect capabilities without modifying core logic.
- Provide a lightweight manifest/contract system for capability discovery; when a new sub-agent eventually ships, its manifest is added to the codebase and the main agent can route based on this metadata.

## Sub-Agent Scope (Phase 1)
1. **Receipt Transaction Agent (rewritten)** – rebuild the agent under `src/agents/transaction` so it handles OCR + categorization via the new contract. Logic can reference the archived code, but no imports cross the archive boundary. Treat this as the living reference implementation for future agents.

Future agents (trip planner, personal notes, inbox/todo) are deferred and should reuse the same manifest/contract when prioritized.

## Technical Considerations
- Bootstrap a fresh `src/` project (tsconfig, lint config, dependency graph) that shares only package-level tooling with the archived code; block imports that reach into `archive/`.
- Extend LangGraph state schema to support arbitrary `TaskDraft` payloads while keeping TypeScript types strict.
- Use the existing PostgreSQL checkpointer for both main and sub-agent state; ensure namespaces prevent collisions.
- Add policy modules for routing, prioritization, and fallback (e.g., if the transaction agent fails twice, return partial answer plus apology).
- Provide telemetry hooks (Prometheus / custom logs) for task lifecycle metrics.
- Follow coding standards under `agent-os/standards/global/*` for style, validation, and error handling.

## Testing & Verification
- Unit tests for routing policies: given intent + confidence, ensure the correct action (direct answer vs sub-agent) is chosen.
- Integration tests that simulate multi-agent task completion, verifying state persistence and final responses.
- Regression tests for existing receipt workflows to guarantee parity after orchestration change.
- Load tests on the task handoff path to confirm sub-agent launch latency meets the 2-second target.
- Legacy-to-new parity tests: run a curated set of archived receipt conversations through both the archived binary and the new code, asserting equivalent TaskResult payloads.

## Risks & Open Questions
- **Complexity creep**: dynamic orchestration can balloon scope; mitigate by delivering in phases (generalist core, then sub-agent registry, then new verticals).
- **Memory consistency**: summarization plus short-term todos must avoid contradictory state; may require CRDT-like merging strategy.
- **Tool capability gaps**: trip planning and notes require new integrations; confirm API availability before implementation.
- **Question**: Should long-term memory live in Supabase only or also in local JSON for offline support?

## Rollout Plan
1. Phase 1 – Main agent refactor plus transaction-agent contract implementation and telemetry.
2. Phase 2 – Validate parity vs legacy workflow, tune routing policies, and harden persistence/memory.
3. Phase 3 – Collect user feedback, adjust policies, and prepare documentation so future sub-agents can plug in when prioritized.
