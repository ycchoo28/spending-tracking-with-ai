# Local Supabase Development

This directory contains the Supabase local development setup.

## Quick Start

```bash
# Start local Supabase (requires Docker Desktop)
supabase start

# Stop local Supabase
supabase stop

# Check status
supabase status

# Reset database (drops all data and re-runs migrations + seeds)
supabase db reset
```

## URLs

- **Studio**: http://127.0.0.1:54323 (Database management UI)
- **API**: http://127.0.0.1:54321
- **Database**: postgresql://postgres:postgres@127.0.0.1:54322/postgres
- **Mailpit**: http://127.0.0.1:54324 (Email testing)

## Environment Variables

Use `.env.local` for local development. The keys are automatically generated when you run `supabase start`.

## Migrations

Migrations are stored in `supabase/migrations/` and are automatically applied when starting Supabase.

### Create a new migration

```bash
# Generate a new migration file
supabase migration new <migration_name>

# Or create from database diff (after making changes in Studio)
supabase db diff -f <migration_name>
```

## Seed Data

Seed data is in `supabase/seed.sql` and is automatically loaded on `supabase db reset`.

## Testing

Run the test script to verify your local setup:

```bash
npm run test:local-db
# or
npx ts-node test-local-db.ts
```

## Syncing with Production

To pull the latest schema from production:

```bash
# Link to your production project (one time)
supabase link --project-ref <your-project-ref>

# Pull remote schema changes
supabase db pull
```
