# Database Schema Plan — Claude-Like Generalist Agent (Phase 1)

## Objectives
- Track each task handoff between the main agent and the transaction sub-agent, mirroring Claude Code's task log.
- Persist summaries/long-term context so conversations older than 24h can be reloaded without replaying all LangGraph turns.
- Maintain clear links between tasks, conversations, and downstream artifacts (transactions) for observability and audits.
- Store Claude-style todos/reminders so the agent can recall pending follow-ups even after 24h windows.
- Keep the design extensible (future sub-agents can reuse the same tables) while only wiring the transaction agent in this phase.
- Ensure the clean-slate `src/` rebuild can rely on this schema while the archived implementation remains untouched.

## Proposed Schema Changes

### 1. `agent_tasks` (new table)
Stores one record per sub-agent execution.
- `id UUID PRIMARY KEY DEFAULT uuid_generate_v4()`
- `conversation_id TEXT NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE`
- `task_type TEXT NOT NULL` (e.g., `transaction_processing`)
- `status TEXT NOT NULL CHECK (status IN ('queued','running','succeeded','failed','cancelled'))`
- `requested_by TEXT NOT NULL` (identifier for main agent / automation)
- `assigned_agent TEXT NOT NULL` (e.g., `transaction-agent`)
- `input_payload JSONB NOT NULL` (TaskDraft snapshot)
- `result_payload JSONB` (TaskResult snapshot)
- `error_message TEXT`
- `started_at TIMESTAMPTZ DEFAULT NOW()`
- `completed_at TIMESTAMPTZ`
- `latency_ms INTEGER` (computed on completion)
- Indexes: `(conversation_id)`, `(task_type)`, `(status)`, `(assigned_agent, status)` for dashboards.
- RLS: mirror `conversations` policy (allow in dev; restrict per user later).

### 2. `agent_task_events` (new table, optional but recommended)
Fine-grained telemetry for retries/step tracing.
- `id UUID PRIMARY KEY DEFAULT uuid_generate_v4()`
- `task_id UUID NOT NULL REFERENCES public.agent_tasks(id) ON DELETE CASCADE`
- `event_type TEXT NOT NULL` (e.g., `checkpoint`, `retry`, `tool_call`)
- `metadata JSONB`
- `created_at TIMESTAMPTZ DEFAULT NOW()`
- Index on `(task_id, created_at)`.

### 3. `conversation_summaries` (new table)
Persists rolling summaries beyond 24h windows.
- `conversation_id TEXT PRIMARY KEY REFERENCES public.conversations(id) ON DELETE CASCADE`
- `summary TEXT NOT NULL`
- `last_summarized_at TIMESTAMPTZ DEFAULT NOW()`
- `vector_embedding VECTOR` *(optional; only if pgvector installed — skip for now)*
- Used by ConversationManager before loading older chats.

### 4. `conversation_todos` (new table)
Tracks open reminders/todos that the main agent surfaces to users.
- `id UUID PRIMARY KEY DEFAULT uuid_generate_v4()`
- `conversation_id TEXT REFERENCES public.conversations(id) ON DELETE SET NULL`
- `user_id TEXT NOT NULL`
- `title TEXT NOT NULL`
- `details TEXT`
- `status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','done','cancelled'))`
- `due_at TIMESTAMPTZ`
- `source_task_id UUID REFERENCES public.agent_tasks(id)` (ties back to originating task, if any)
- `created_at TIMESTAMPTZ DEFAULT NOW()`
- `completed_at TIMESTAMPTZ`
- Indexes: `(user_id, status)`, `(due_at)` to support reminders.
- RLS: follow conversations policy (allow all in dev, later restrict per user).

### 5. Column updates
- `public.transactions` — add `task_id UUID REFERENCES public.agent_tasks(id)` so each transaction ties back to the orchestrated task run.
- `public.conversations` — add `last_task_id UUID REFERENCES public.agent_tasks(id)` for quick joins when resuming threads.

## Migration Strategy
1. Create a new SQL migration (e.g., `202511070001_agent_task_schema.sql`) that:
   - Ensures `uuid-ossp` extension exists (safeguard).
   - Creates `agent_tasks`, `agent_task_events`, `conversation_summaries`, and `conversation_todos` with indexes and comments.
   - Alters `transactions` and `conversations` to add the foreign keys listed.
   - Adds RLS + permissive policies (match existing pattern) and grants for `anon/authenticated` roles.
2. Update seed data if needed (optional; can insert sample task for integration tests).
3. Document schema in `supabase/README.md` (brief section on task logging + summaries).

## Impact & Usage Notes
- Application layer in the new `src/` should write to `agent_tasks` whenever the main agent hands work to the transaction agent; upon completion, update `status`, `result_payload`, `latency_ms`.
- Errors bubble through `agent_task_events` for debugging (e.g., OCR failure, categorizer retry).
- `conversation_summaries` can be filled by a scheduled job or when ConversationManager trims history.
- Future sub-agents only need to define new `task_type` values and will reuse the same schema, keeping Phase 1 focused while future-proofing.
