/**
 * Configuration utilities
 * Centralized configuration management
 */

import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Get ModelScope text model based on profile
 */
function getModelScopeTextModel(): string {
  const profile = process.env.MODELSCOPE_TEXT_MODEL_PROFILE || 'glm4';
  
  switch (profile.toLowerCase()) {
    case 'qwen-coder':
    case 'qwen_coder':
    case 'coder':
      return process.env.MODELSCOPE_TEXT_MODEL_QWEN_CODER || 'Qwen/Qwen3-Coder-480B-A35B-Instruct';
    
    case 'glm4':
    case 'glm':
    default:
      return process.env.MODELSCOPE_TEXT_MODEL_GLM4 || 'ZhipuAI/GLM-4.6';
  }
}

/**
 * Application configuration
 */
export const config = {
  // ModelScope API Configuration
  openai: {
    provider: 'modelscope',
    apiKey: process.env.MODELSCOPE_API_KEY || '',
    apiBase: process.env.MODELSCOPE_API_BASE || 'https://api-inference.modelscope.cn/v1',
    visionModel: process.env.MODELSCOPE_VISION_MODEL || 'Qwen/Qwen3-VL-235B-A22B-Instruct',
    textModel: getModelScopeTextModel(),
    textModelProfile: process.env.MODELSCOPE_TEXT_MODEL_PROFILE || 'glm4',
    // Legacy support
    categorizerModel: getModelScopeTextModel(),
  },

  // Telegram Configuration
  telegram: {
    // Use dev bot token in development, prod token in production
    botToken: process.env.NODE_ENV === 'production' 
      ? process.env.TELEGRAM_BOT_TOKEN_PROD || process.env.TELEGRAM_BOT_TOKEN || ''
      : process.env.TELEGRAM_BOT_TOKEN_DEV || process.env.TELEGRAM_BOT_TOKEN || '',
  },

  // Database Configuration
  database: {
    // Use dev database in development, prod database in production
    url: process.env.NODE_ENV === 'production'
      ? process.env.SUPABASE_URL_PROD || process.env.SUPABASE_URL || ''
      : process.env.SUPABASE_URL_DEV || process.env.SUPABASE_URL || '',
    key: process.env.NODE_ENV === 'production'
      ? process.env.SUPABASE_KEY_PROD || process.env.SUPABASE_KEY || ''
      : process.env.SUPABASE_KEY_DEV || process.env.SUPABASE_KEY || '',
  },

  // Workflow Configuration
  workflow: {
    confidenceThreshold: parseFloat(process.env.CONFIDENCE_THRESHOLD || '0.7'),
    maxRetries: parseInt(process.env.MAX_RETRIES || '3'),
    retryDelay: parseInt(process.env.RETRY_DELAY || '2000'),
  },

  // v2: Agent Loop Configuration
  agentLoop: {
    // Conversation management
    conversationExpirationHours: parseInt(process.env.CONVERSATION_EXPIRATION_HOURS || '24'),
    maxConversationHistory: parseInt(process.env.MAX_CONVERSATION_HISTORY || '20'),
    
    // Agent decision-making
    categoryConfidenceThreshold: parseFloat(process.env.CATEGORY_CONFIDENCE_THRESHOLD || '0.8'),
    extractionConfidenceThreshold: parseFloat(process.env.EXTRACTION_CONFIDENCE_THRESHOLD || '0.3'),
    
    // Retry and timeout
    maxRetries: parseInt(process.env.AGENT_MAX_RETRIES || '3'),
    retryDelayMs: parseInt(process.env.AGENT_RETRY_DELAY_MS || '2000'),
    agentDecisionTimeoutMs: parseInt(process.env.AGENT_DECISION_TIMEOUT_MS || '30000'),
    
    // LLM configuration - uses the same text model as categorizer
    llmModel: process.env.AGENT_LLM_MODEL || getModelScopeTextModel(),
    llmTemperature: parseFloat(process.env.AGENT_LLM_TEMPERATURE || '0.7'),
    llmMaxTokens: parseInt(process.env.AGENT_LLM_MAX_TOKENS || '50000'),
    
    // Database
    checkpointCleanupIntervalHours: parseInt(process.env.CHECKPOINT_CLEANUP_INTERVAL_HOURS || '6'),
    
    // Feature flags
    enableContextInjection: process.env.ENABLE_CONTEXT_INJECTION !== 'false',
    enableAdaptiveDecisions: process.env.ENABLE_ADAPTIVE_DECISIONS !== 'false',
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
  const env = process.env.NODE_ENV || 'development';
  
  const telegramTokenKey = env === 'production' 
    ? 'TELEGRAM_BOT_TOKEN_PROD or TELEGRAM_BOT_TOKEN'
    : 'TELEGRAM_BOT_TOKEN_DEV or TELEGRAM_BOT_TOKEN';
  const supabaseUrlKey = env === 'production'
    ? 'SUPABASE_URL_PROD or SUPABASE_URL'
    : 'SUPABASE_URL_DEV or SUPABASE_URL';
  const supabaseKeyKey = env === 'production'
    ? 'SUPABASE_KEY_PROD or SUPABASE_KEY'
    : 'SUPABASE_KEY_DEV or SUPABASE_KEY';

  const required = [
    { key: 'MODELSCOPE_API_KEY', value: config.openai.apiKey },
    { key: telegramTokenKey, value: config.telegram.botToken },
    { key: supabaseUrlKey, value: config.database.url },
    { key: supabaseKeyKey, value: config.database.key },
  ];

  const missing = required.filter(({ value }) => !value);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.map(({ key }) => key).join(', ')}`
    );
  }
}
