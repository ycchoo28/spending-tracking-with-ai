/**
 * Configuration utilities
 * Centralized configuration management
 */

import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Application configuration
 */
export const config = {
  // OpenAI/LLM Configuration
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    apiBase: process.env.OPENAI_API_BASE || 'https://api.openai.com/v1',
    visionModel: process.env.OPENAI_VISION_MODEL || process.env.VISION_MODEL || 'gpt-4-vision-preview',
    categorizerModel: process.env.OPENAI_TEXT_MODEL || process.env.CATEGORIZER_MODEL || 'gpt-4-turbo-preview',
  },

  // Telegram Configuration
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
  },

  // Database Configuration
  database: {
    url: process.env.SUPABASE_URL || '',
    key: process.env.SUPABASE_KEY || '',
  },

  // Workflow Configuration
  workflow: {
    confidenceThreshold: parseFloat(process.env.CONFIDENCE_THRESHOLD || '0.7'),
    maxRetries: parseInt(process.env.MAX_RETRIES || '3'),
    retryDelay: parseInt(process.env.RETRY_DELAY || '2000'),
  },

  // LangSmith Configuration (optional)
  langsmith: {
    apiKey: process.env.LANGSMITH_API_KEY,
    project: process.env.LANGSMITH_PROJECT,
    tracing: process.env.LANGSMITH_TRACING === 'true',
  },

  // Monitoring Configuration
  monitoring: {
    memoryIntervalMs: parseInt(process.env.MEMORY_MONITOR_INTERVAL_MS || '30000'),
  },
};

/**
 * Validates that all required configuration is present
 * @throws Error if required configuration is missing
 */
export function validateConfig(): void {
  const required = [
    { key: 'OPENAI_API_KEY', value: config.openai.apiKey },
    { key: 'TELEGRAM_BOT_TOKEN', value: config.telegram.botToken },
    { key: 'SUPABASE_URL', value: config.database.url },
    { key: 'SUPABASE_KEY', value: config.database.key },
  ];

  const missing = required.filter(({ value }) => !value);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.map(({ key }) => key).join(', ')}`
    );
  }
}
