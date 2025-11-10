-- Seed data for local development

-- Insert sample user preferences
INSERT INTO public.user_preferences (telegram_user_id, default_currency, timezone, language, notification_enabled)
VALUES 
    ('123456789', 'MYR', 'Asia/Kuala_Lumpur', 'en', true),
    ('987654321', 'USD', 'America/New_York', 'en', true)
ON CONFLICT (telegram_user_id) DO NOTHING;

-- Insert sample transactions
INSERT INTO public.transactions (
    user_id, 
    telegram_user_id, 
    amount, 
    currency, 
    merchant_name, 
    category, 
    date_time, 
    payment_method,
    confidence_score,
    processing_status,
    extraction_confidence
) VALUES 
    ('user_123456789', '123456789', 15.50, 'MYR', 'Starbucks', 'Food & Dining', NOW() - INTERVAL '1 day', 'Credit Card', 0.95, 'completed', 0.98),
    ('user_123456789', '123456789', 25.00, 'MYR', 'Grab', 'Transportation', NOW() - INTERVAL '2 days', 'E-Wallet', 0.90, 'completed', 0.92),
    ('user_123456789', '123456789', 120.00, 'MYR', 'AEON', 'Groceries', NOW() - INTERVAL '3 days', 'Debit Card', 0.88, 'completed', 0.95),
    ('user_987654321', '987654321', 8.99, 'USD', 'Netflix', 'Entertainment', NOW() - INTERVAL '1 day', 'Credit Card', 0.99, 'completed', 0.99),
    ('user_987654321', '987654321', 45.20, 'USD', 'Target', 'Shopping', NOW() - INTERVAL '2 days', 'Credit Card', 0.85, 'completed', 0.90)
ON CONFLICT (id) DO NOTHING;

-- Insert sample category learning data
INSERT INTO public.category_learning (user_id, merchant_name, category, frequency, last_used)
VALUES 
    ('user_123456789', 'Starbucks', 'Food & Dining', 5, NOW() - INTERVAL '1 day'),
    ('user_123456789', 'Grab', 'Transportation', 10, NOW() - INTERVAL '2 days'),
    ('user_123456789', 'AEON', 'Groceries', 3, NOW() - INTERVAL '3 days'),
    ('user_987654321', 'Netflix', 'Entertainment', 1, NOW() - INTERVAL '1 day'),
    ('user_987654321', 'Target', 'Shopping', 2, NOW() - INTERVAL '2 days')
ON CONFLICT (user_id, merchant_name, category) DO NOTHING;