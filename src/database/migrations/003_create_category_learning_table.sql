-- Create category_learning table
CREATE TABLE IF NOT EXISTS category_learning (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    merchant_name TEXT NOT NULL,
    category TEXT NOT NULL,
    frequency INT DEFAULT 1,
    last_used TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, merchant_name, category)
);

-- Create indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_category_learning_user_merchant ON category_learning(user_id, merchant_name);
CREATE INDEX IF NOT EXISTS idx_category_learning_user_id ON category_learning(user_id);
CREATE INDEX IF NOT EXISTS idx_category_learning_last_used ON category_learning(last_used DESC);
