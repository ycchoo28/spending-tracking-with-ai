-- Create user_preferences table
CREATE TABLE IF NOT EXISTS user_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    telegram_user_id TEXT UNIQUE NOT NULL,
    default_currency TEXT DEFAULT 'MYR',
    timezone TEXT DEFAULT 'Asia/Kuala_Lumpur',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for telegram_user_id lookups
CREATE INDEX IF NOT EXISTS idx_user_preferences_telegram_user_id ON user_preferences(telegram_user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_user_preferences_updated_at
    BEFORE UPDATE ON user_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
