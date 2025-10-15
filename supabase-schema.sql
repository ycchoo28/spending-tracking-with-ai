-- Receipt Tracker Agent Database Schema
-- This script creates all necessary tables for the application

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Transactions table
-- Stores all receipt and transaction data extracted from images
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    telegram_user_id TEXT NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'MYR',
    merchant_name TEXT NOT NULL,
    category TEXT NOT NULL,
    date_time TIMESTAMPTZ NOT NULL,
    payment_method TEXT,
    transaction_reference TEXT,
    image_url TEXT,
    raw_extracted_data JSONB,
    confidence_score DECIMAL(3, 2),
    user_corrected BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Category Learning table
-- Tracks user preferences for merchant-category mappings
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

-- User Preferences table
-- Stores user-specific settings and preferences
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

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_transactions_telegram_user_id 
    ON public.transactions(telegram_user_id);

CREATE INDEX IF NOT EXISTS idx_transactions_date_time 
    ON public.transactions(date_time DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_category 
    ON public.transactions(category);

CREATE INDEX IF NOT EXISTS idx_transactions_merchant_name 
    ON public.transactions(merchant_name);

CREATE INDEX IF NOT EXISTS idx_category_learning_user_merchant 
    ON public.category_learning(user_id, merchant_name);

CREATE INDEX IF NOT EXISTS idx_user_preferences_telegram_user_id 
    ON public.user_preferences(telegram_user_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers to automatically update updated_at
DROP TRIGGER IF EXISTS update_transactions_updated_at ON public.transactions;
CREATE TRIGGER update_transactions_updated_at
    BEFORE UPDATE ON public.transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_preferences_updated_at ON public.user_preferences;
CREATE TRIGGER update_user_preferences_updated_at
    BEFORE UPDATE ON public.user_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_learning ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- Create policies for transactions table
-- Allow users to read their own transactions
CREATE POLICY "Users can view their own transactions" 
    ON public.transactions FOR SELECT
    USING (true);  -- For now, allow all reads (you can restrict by user_id later)

-- Allow users to insert their own transactions
CREATE POLICY "Users can insert their own transactions" 
    ON public.transactions FOR INSERT
    WITH CHECK (true);  -- For now, allow all inserts

-- Allow users to update their own transactions
CREATE POLICY "Users can update their own transactions" 
    ON public.transactions FOR UPDATE
    USING (true);  -- For now, allow all updates

-- Create policies for category_learning table
CREATE POLICY "Users can view category learning data" 
    ON public.category_learning FOR SELECT
    USING (true);

CREATE POLICY "Users can insert category learning data" 
    ON public.category_learning FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Users can update category learning data" 
    ON public.category_learning FOR UPDATE
    USING (true);

-- Create policies for user_preferences table
CREATE POLICY "Users can view their own preferences" 
    ON public.user_preferences FOR SELECT
    USING (true);

CREATE POLICY "Users can insert their own preferences" 
    ON public.user_preferences FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Users can update their own preferences" 
    ON public.user_preferences FOR UPDATE
    USING (true);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON public.transactions TO anon, authenticated;
GRANT ALL ON public.category_learning TO anon, authenticated;
GRANT ALL ON public.user_preferences TO anon, authenticated;

-- Insert some sample categories for reference
COMMENT ON COLUMN public.transactions.category IS 'Common categories: Food & Dining, Transportation, Shopping, Entertainment, Bills & Utilities, Healthcare, Education, Travel, Groceries, Personal Care, Other';
