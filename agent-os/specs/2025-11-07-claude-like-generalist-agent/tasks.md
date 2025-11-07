# Tasks — Claude-Like Generalist Agent

## 0. Codebase Reset
- [ ] **Archive legacy implementation**: Move the entire current `src/` to `archive/receipt-agent-v1/`, preserving package metadata and ensuring CI/CD no longer references it.
- [ ] **Bootstrap clean `src/`**: Generate a fresh TypeScript project structure (tsconfig, linting, testing harness) aligned with the new architecture map.
- [ ] **Legacy compatibility script**: Add a `scripts/run-legacy.sh` (or similar) that can spin up the archived code for comparison without affecting the new runtime.

## 1. Orchestration Core
- [ ] **Design dynamic routing policies**: Define the heuristics/state fields that trigger direct answer vs transaction-agent handoff, referencing `system-workflow.prompt.md` for behavior.
- [ ] **Build new LangGraph main agent**: Implement policy-driven node transitions and extend the typed state schema (conversationId, userProfile, TaskDraft, etc.) inside the fresh codebase.
- [ ] **Implement lightweight manifest loader**: Define how the transaction agent advertises its capabilities/requirements so the main agent can inspect them without hardcoding.
- [ ] **Add task lifecycle logging**: Capture inputs/outputs, duration, and errors for every transaction-agent invocation (link to existing logger/telemetry stack).

## 2. Memory & Persistence
- [ ] **Extend ConversationManager**: Support multi-domain summaries and attach TaskResult metadata for reuse.
- [ ] **Create TaskHistory + Todo storage**: Design and migrate Supabase tables for task status, todos, and long-term reminders; include ORM/helpers.
- [ ] **Implement summarization workflow**: Add background job or on-demand trigger that condenses >24h conversations while keeping pointers to stored tasks.

## 3. Transaction Agent Integration
- [ ] **Define sub-agent contract package**: Establish TypeScript interfaces/types for manifest, TaskDraft, TaskResult, error types, and serialization utilities (focused on the transaction agent as the reference implementation).
- [ ] **Rebuild transaction agent**: Implement the receipt-processing agent anew under `src/agents/transaction`, ensuring it consumes TaskDraft inputs, records checkpoints, and emits TaskResult payloads without importing legacy code.
- [ ] **Verify Supabase interactions**: Confirm categorization + persistence still work under the new orchestration, including retries and idempotency safeguards.

## 4. Tooling & Error Handling
- [ ] **Implement declarative tool manifest for transaction agent**: Enumerate dependencies (vision processor, categorizer, Supabase client) and auto-wire them when sessions start.
- [ ] **Fallback/Retry policies**: Define what the main agent does when the transaction agent declines or fails twice (apology + manual steps).
- [ ] **Telemetry hooks**: Emit structured events for handoff start, success, failure to feed dashboards.

## 5. Testing & Validation
- [ ] **Legacy parity harness**: Create a test runner that executes recorded chats against both the archived binary and the new runtime, diffing TaskResult payloads.
- [ ] **Unit tests for routing policies**: Simulate different receipt scenarios (single image, multi-image, follow-up question) and verify the correct decision.
- [ ] **Integration tests for transaction lifecycle**: Run end-to-end receipt flows ensuring state persistence and summarization behave correctly under the new orchestration.
- [ ] **Regression suite for transaction agent**: Ensure no behavioral regressions vs current workflow (categorization, Supabase writes, confidence thresholds).
- [ ] **Performance tests**: Measure transaction-agent handoff latency and memory summarization throughput.

## 6. Rollout & Observability
- [ ] **Gradual rollout plan**: Feature-flag the new orchestration (transaction-agent only), compare success metrics (resolution rate, latency) against baseline.
- [ ] **Telemetry dashboards**: Create Grafana/Looker panels for transaction task success rates, failure reasons, and latency.
- [ ] **Documentation & playbooks**: Update README/docs with new architecture diagrams, manifest/contract details, and guidance for future sub-agents.
