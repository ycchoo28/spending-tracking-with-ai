/**
 * Test script to verify configuration is loaded correctly
 */

import { config, validateConfig } from './src/core/config';

console.log('🔍 Testing Configuration...\n');

try {
  // Validate config
  validateConfig();
  console.log('✅ Configuration validation passed\n');

  // Display configuration
  console.log('📋 Configuration Values:');
  console.log('─────────────────────────────────────');
  console.log('OpenAI API Key:', config.openai.apiKey ? '✓ Set' : '✗ Missing');
  console.log('OpenAI API Base:', config.openai.apiBase);
  console.log('Vision Model:', config.openai.visionModel);
  console.log('Categorizer Model:', config.openai.categorizerModel);
  console.log('─────────────────────────────────────');
  console.log('Telegram Bot Token:', config.telegram.botToken ? '✓ Set' : '✗ Missing');
  console.log('─────────────────────────────────────');
  console.log('Supabase URL:', config.database.url ? '✓ Set' : '✗ Missing');
  console.log('Supabase Key:', config.database.key ? '✓ Set' : '✗ Missing');
  console.log('─────────────────────────────────────');
  console.log('Confidence Threshold:', config.workflow.confidenceThreshold);
  console.log('Max Retries:', config.workflow.maxRetries);
  console.log('Retry Delay:', config.workflow.retryDelay, 'ms');
  console.log('─────────────────────────────────────');
  console.log('LangSmith Tracing:', config.langsmith.tracing ? '✓ Enabled' : '✗ Disabled');
  if (config.langsmith.tracing) {
    console.log('LangSmith Project:', config.langsmith.project);
  }
  console.log('─────────────────────────────────────\n');

  console.log('✅ All configuration loaded successfully!');
  console.log('\n💡 Models being used:');
  console.log(`   Vision: ${config.openai.visionModel}`);
  console.log(`   Categorizer: ${config.openai.categorizerModel}`);

} catch (error) {
  console.error('❌ Configuration error:', (error as Error).message);
  process.exit(1);
}
