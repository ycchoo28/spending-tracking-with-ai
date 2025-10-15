# Database Migrations

This directory contains SQL migration scripts for setting up the Supabase database schema.

## Migration Files

1. `001_create_transactions_table.sql` - Creates the main transactions table with indexes
2. `002_create_user_preferences_table.sql` - Creates user preferences table
3. `003_create_category_learning_table.sql` - Creates category learning table for ML improvements

## Running Migrations

### Option 1: Supabase Dashboard (Recommended for initial setup)

1. Log in to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Run each migration file in order (001, 002, 003)
4. Verify tables are created in the Table Editor

### Option 2: Supabase CLI

```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Link to your project
supabase link --project-ref your-project-ref

# Run migrations
supabase db push
```

### Option 3: Programmatic Execution

You can also run these migrations programmatically using the Supabase client:

```typescript
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function runMigrations() {
  const migrations = [
    '001_create_transactions_table.sql',
    '002_create_user_preferences_table.sql',
    '003_create_category_learning_table.sql'
  ];

  for (const migration of migrations) {
    const sql = readFileSync(join(__dirname, migration), 'utf-8');
    const { error } = await supabase.rpc('exec_sql', { sql });
    if (error) console.error(`Error running ${migration}:`, error);
    else console.log(`Successfully ran ${migration}`);
  }
}
```

## Schema Overview

### transactions
Stores all processed transactions with extracted data, categorization, and metadata.

### user_preferences
Stores user-specific settings like default currency and timezone.

### category_learning
Tracks merchant-category associations to improve categorization accuracy over time.

## Notes

- All tables use UUID primary keys
- Timestamps are stored with timezone information
- Indexes are created for frequently queried columns
- The `update_updated_at_column()` trigger function automatically updates the `updated_at` field
