-- Initial schema migration based on production database
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- User Preferences table
CREATE TABLE IF NOT EXISTS public.user_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    telegram_user_id TEXT UNIQUE NOT NULL,
    default_currency TEXT DEFAULT 'MYR',
    timezone TEXT DEFAULT 'Asia/Kuala_Lumpur',
    language TEXT DEFAULT 'en',
    notification_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transactions table with all production fields
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    telegram_user_id TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    currency TEXT NOT NULL DEFAULT 'MYR',
    merchant_name TEXT NOT NULL,
    category TEXT NOT NULL,
    date_time TIMESTAMPTZ NOT NULL,
    payment_method TEXT,
    transaction_reference TEXT,
    image_url TEXT,
    raw_extracted_data JSONB,
    confidence_score NUMERIC,
    user_corrected BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    processing_status TEXT DEFAULT 'completed',
    extraction_confidence NUMERIC,
    awaiting_user_input BOOLEAN DEFAULT FALSE,
    image_data_hash TEXT,
    retry_count INTEGER DEFAULT 0,
    error_message TEXT,
    workflow_execution_id TEXT
);

-- Category Learning table
CREATE TABLE IF NOT EXISTS public.category_learning (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    merchant_name TEXT NOT NULL,
    category TEXT NOT NULL,
    frequency INTEGER DEFAULT 1,
    last_used TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, merchant_name, category)
);

-- User Feedback table
CREATE TABLE IF NOT EXISTS public.user_feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID NOT NULL,
    telegram_user_id TEXT NOT NULL,
    feedback_type TEXT NOT NULL,
    original_value TEXT,
    corrected_value TEXT,
    confidence_before NUMERIC,
    user_comment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (transaction_id) REFERENCES public.transactions(id)
);

-- Add comments to match production
COMMENT ON COLUMN public.transactions.category IS 'Common categories: Food & Dining, Transportation, Shopping, Entertainment, Bills & Utilities, Healthcare, Education, Travel, Groceries, Personal Care, Other';
COMMENT ON COLUMN public.transactions.confidence_score IS 'Categorization confidence score (0.0 to 1.0)';
COMMENT ON COLUMN public.transactions.processing_status IS 'Status: pending, processing, completed, failed, awaiting_input';
COMMENT ON COLUMN public.transactions.extraction_confidence IS 'Data extraction confidence score (0.0 to 1.0)';
COMMENT ON COLUMN public.transactions.awaiting_user_input IS 'True if workflow is waiting for user clarification';
COMMENT ON COLUMN public.transactions.image_data_hash IS 'Hash of original image data for deduplication';
COMMENT ON COLUMN public.transactions.retry_count IS 'Number of processing retry attempts';
COMMENT ON COLUMN public.transactions.error_message IS 'Last error message if processing failed';
COMMENT ON COLUMN public.transactions.workflow_execution_id IS 'LangGraph workflow execution identifier';

COMMENT ON TABLE public.user_feedback IS 'Stores user corrections and feedback for system improvement';
COMMENT ON COLUMN public.user_feedback.feedback_type IS 'Type of feedback: category_correction, amount_correction, merchant_correction, general';
COMMENT ON COLUMN public.user_feedback.original_value IS 'Original AI-generated value';
COMMENT ON COLUMN public.user_feedback.corrected_value IS 'User-corrected value';
COMMENT ON COLUMN public.user_feedback.confidence_before IS 'AI confidence before user correction';

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_transactions_telegram_user_id ON public.transactions(telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date_time ON public.transactions(date_time DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON public.transactions(category);
CREATE INDEX IF NOT EXISTS idx_transactions_merchant_name ON public.transactions(merchant_name);
CREATE INDEX IF NOT EXISTS idx_category_learning_user_merchant ON public.category_learning(user_id, merchant_name);
CREATE INDEX IF NOT EXISTS idx_user_preferences_telegram_user_id ON public.user_preferences(telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_user_feedback_transaction_id ON public.user_feedback(transaction_id);
CREATE INDEX IF NOT EXISTS idx_user_feedback_telegram_user_id ON public.user_feedback(telegram_user_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers to automatically update updated_at
CREATE TRIGGER update_transactions_updated_at
    BEFORE UPDATE ON public.transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_preferences_updated_at
    BEFORE UPDATE ON public.user_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_learning ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_feedback ENABLE ROW LEVEL SECURITY;

-- Create policies (allowing all operations for development)
CREATE POLICY "Allow all operations on transactions" ON public.transactions FOR ALL USING (true);
CREATE POLICY "Allow all operations on category_learning" ON public.category_learning FOR ALL USING (true);
CREATE POLICY "Allow all operations on user_preferences" ON public.user_preferences FOR ALL USING (true);
CREATE POLICY "Allow all operations on user_feedback" ON public.user_feedback FOR ALL USING (true);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON public.transactions TO anon, authenticated;
GRANT ALL ON public.category_learning TO anon, authenticated;
GRANT ALL ON public.user_preferences TO anon, authenticated;
GRANT ALL ON public.user_feedback TO anon, authenticated;