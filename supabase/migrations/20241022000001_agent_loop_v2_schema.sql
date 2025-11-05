-- Agent Loop v2 Schema Migration
-- Adds tables for multi-turn conversations, checkpointing, and message history

-- Conversations table
CREATE TABLE IF NOT EXISTS public.conversations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  chat_id BIGINT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'completed', 'expired', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  turn_count INTEGER DEFAULT 0,
  active_sub_agent TEXT,
  metadata JSONB
);

-- Conversation messages table
CREATE TABLE IF NOT EXISTS public.conversation_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB
);

-- Checkpoints table for LangGraph state persistence
CREATE TABLE IF NOT EXISTS public.checkpoints (
  thread_id TEXT NOT NULL,
  checkpoint_id TEXT NOT NULL,
  parent_id TEXT,
  checkpoint JSONB NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  PRIMARY KEY (thread_id, checkpoint_id)
);

-- Add conversation tracking columns to transactions table
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS conversation_id TEXT,
ADD COLUMN IF NOT EXISTS turn_number INTEGER;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON public.conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON public.conversations(status);
CREATE INDEX IF NOT EXISTS idx_conversations_last_activity ON public.conversations(last_activity_at);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_conversation_id ON public.conversation_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_timestamp ON public.conversation_messages(timestamp);
CREATE INDEX IF NOT EXISTS idx_checkpoints_thread_id ON public.checkpoints(thread_id);
CREATE INDEX IF NOT EXISTS idx_checkpoints_created_at ON public.checkpoints(created_at);
CREATE INDEX IF NOT EXISTS idx_transactions_conversation_id ON public.transactions(conversation_id);

-- Add comments for documentation
COMMENT ON TABLE public.conversations IS 'Stores multi-turn conversation state and metadata';
COMMENT ON COLUMN public.conversations.status IS 'Conversation status: active, completed, expired, cancelled';
COMMENT ON COLUMN public.conversations.turn_count IS 'Number of turns (user messages) in the conversation';
COMMENT ON COLUMN public.conversations.active_sub_agent IS 'Currently active sub-agent (e.g., transaction)';
COMMENT ON COLUMN public.conversations.metadata IS 'Additional conversation metadata (JSON)';

COMMENT ON TABLE public.conversation_messages IS 'Stores conversation message history';
COMMENT ON COLUMN public.conversation_messages.role IS 'Message role: user or assistant';
COMMENT ON COLUMN public.conversation_messages.metadata IS 'Additional message metadata (JSON)';

COMMENT ON TABLE public.checkpoints IS 'LangGraph checkpoint storage for state persistence';
COMMENT ON COLUMN public.checkpoints.thread_id IS 'Unique thread identifier for the workflow';
COMMENT ON COLUMN public.checkpoints.checkpoint_id IS 'Unique checkpoint identifier';
COMMENT ON COLUMN public.checkpoints.parent_id IS 'Parent checkpoint ID for checkpoint chain';
COMMENT ON COLUMN public.checkpoints.checkpoint IS 'Serialized checkpoint state (JSON)';

COMMENT ON COLUMN public.transactions.conversation_id IS 'Associated conversation ID for traceability';
COMMENT ON COLUMN public.transactions.turn_number IS 'Turn number when transaction was created';

-- Enable Row Level Security (RLS)
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkpoints ENABLE ROW LEVEL SECURITY;

-- Create policies (allowing all operations for development)
CREATE POLICY "Allow all operations on conversations" ON public.conversations FOR ALL USING (true);
CREATE POLICY "Allow all operations on conversation_messages" ON public.conversation_messages FOR ALL USING (true);
CREATE POLICY "Allow all operations on checkpoints" ON public.checkpoints FOR ALL USING (true);

-- Grant necessary permissions
GRANT ALL ON public.conversations TO anon, authenticated;
GRANT ALL ON public.conversation_messages TO anon, authenticated;
GRANT ALL ON public.checkpoints TO anon, authenticated;
