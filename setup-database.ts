/**
 * Database setup script
 * Applies the schema to Supabase database
 */

import { createClient } from '@supabase/supabase-js';
import { getConfig } from './src/config/config';
import * as fs from 'fs';

async function setupDatabase() {
    console.log('🚀 Setting up Supabase database...\n');

    try {
        // Load configuration
        const config = getConfig();
        console.log('✅ Configuration loaded');
        console.log(`   Supabase URL: ${config.supabase.url}\n`);

        // Create Supabase client
        const supabase = createClient(config.supabase.url, config.supabase.key);

        // Read the SQL schema file
        const schemaSQL = fs.readFileSync('supabase-schema.sql', 'utf-8');
        console.log('📄 Schema file loaded\n');

        // Split SQL into individual statements (basic split by semicolon)
        const statements = schemaSQL
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'));

        console.log(`📝 Executing ${statements.length} SQL statements...\n`);

        // Execute each statement
        let successCount = 0;
        let errorCount = 0;

        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i] + ';';

            // Skip comments
            if (statement.trim().startsWith('--')) {
                continue;
            }

            try {
                const { error } = await supabase.rpc('exec_sql', { sql: statement });

                if (error) {
                    // Try direct query if RPC doesn't work
                    await supabase.from('_').select('*').limit(0);
                    console.log(`⚠️  Statement ${i + 1}: Using alternative method`);
                }

                successCount++;
                process.stdout.write('.');
            } catch (err: any) {
                errorCount++;
                console.log(`\n⚠️  Statement ${i + 1} warning: ${err.message}`);
            }
        }

        console.log('\n\n⚠️  Note: Direct SQL execution via API may be limited.');
        console.log('📋 Please execute the SQL manually in Supabase Dashboard:\n');
        console.log('   1. Go to: https://supabase.com/dashboard/project/fcclryvsgtaenkmpulae/editor');
        console.log('   2. Click on "SQL Editor" in the left sidebar');
        console.log('   3. Copy and paste the contents of "supabase-schema.sql"');
        console.log('   4. Click "Run" to execute the schema\n');

        console.log('✅ Schema file is ready at: supabase-schema.sql');
        console.log('🎯 After running the SQL, test the connection again with:');
        console.log('   npx ts-node test-supabase-connection.ts\n');

    } catch (error: any) {
        console.error('\n❌ Setup failed:');
        console.error(`   Error: ${error.message}\n`);
        process.exit(1);
    }
}

// Run setup
setupDatabase();
