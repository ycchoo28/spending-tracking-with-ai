import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

/**
 * Configuration interface for the Receipt Tracker Agent
 * Defines all required and optional settings for the application
 */
export interface Config {
  // Telegram Bot Configuration
  telegram: {
    botToken: string;
  };

  // OpenAI-compatible API Configuration
  openai: {
    apiKey: string;
    apiBase: string;
    visionModel: string;
    textModel: string;
  };

  // Supabase Configuration
  supabase: {
    url: string;
    key: string;
  };

  // Application Settings
  app: {
    confidenceThreshold: number;
    maxRetries: number;
    retryDelay: number;
    logLevel: string;
    nodeEnv: string;
  };
}

/**
 * Validation error class for configuration issues
 */
export class ConfigValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigValidationError';
  }
}

/**
 * Validates that a required environment variable is present
 * @param value - The environment variable value
 * @param name - The name of the environment variable
 * @throws ConfigValidationError if the value is missing
 */
function requireEnv(value: string | undefined, name: string): string {
  if (!value || value.trim() === '') {
    throw new ConfigValidationError(
      `Missing required environment variable: ${name}`
    );
  }
  return value;
}

/**
 * Gets an optional environment variable with a default value
 * @param value - The environment variable value
 * @param defaultValue - The default value to use if not set
 * @returns The environment variable value or default
 */
function getEnvOrDefault(value: string | undefined, defaultValue: string): string {
  return value && value.trim() !== '' ? value : defaultValue;
}

/**
 * Parses a numeric environment variable with validation
 * @param value - The environment variable value
 * @param defaultValue - The default value to use if not set
 * @param name - The name of the environment variable (for error messages)
 * @returns The parsed number
 * @throws ConfigValidationError if the value is not a valid number
 */
function parseNumber(
  value: string | undefined,
  defaultValue: number,
  name: string
): number {
  if (!value || value.trim() === '') {
    return defaultValue;
  }

  const parsed = Number(value);
  if (isNaN(parsed)) {
    throw new ConfigValidationError(
      `Invalid number for ${name}: ${value}`
    );
  }

  return parsed;
}

/**
 * Validates the confidence threshold is within valid range (0-1)
 * @param threshold - The confidence threshold value
 * @throws ConfigValidationError if the threshold is out of range
 */
function validateConfidenceThreshold(threshold: number): void {
  if (threshold < 0 || threshold > 1) {
    throw new ConfigValidationError(
      `Confidence threshold must be between 0 and 1, got: ${threshold}`
    );
  }
}

/**
 * Validates the retry settings are positive numbers
 * @param maxRetries - Maximum number of retries
 * @param retryDelay - Delay between retries in milliseconds
 * @throws ConfigValidationError if values are invalid
 */
function validateRetrySettings(maxRetries: number, retryDelay: number): void {
  if (maxRetries < 0) {
    throw new ConfigValidationError(
      `Max retries must be non-negative, got: ${maxRetries}`
    );
  }

  if (retryDelay < 0) {
    throw new ConfigValidationError(
      `Retry delay must be non-negative, got: ${retryDelay}`
    );
  }
}

/**
 * Loads and validates configuration from environment variables
 * @returns Validated configuration object
 * @throws ConfigValidationError if required variables are missing or invalid
 */
export function loadConfig(): Config {
  // Load required Telegram configuration
  const telegramBotToken = requireEnv(
    process.env.TELEGRAM_BOT_TOKEN,
    'TELEGRAM_BOT_TOKEN'
  );

  // Load required OpenAI configuration
  const openaiApiKey = requireEnv(
    process.env.OPENAI_API_KEY,
    'OPENAI_API_KEY'
  );
  const openaiApiBase = requireEnv(
    process.env.OPENAI_API_BASE,
    'OPENAI_API_BASE'
  );

  // Load optional OpenAI model settings with defaults
  const visionModel = getEnvOrDefault(
    process.env.OPENAI_VISION_MODEL,
    'gpt-4-vision-preview'
  );
  const textModel = getEnvOrDefault(
    process.env.OPENAI_TEXT_MODEL,
    'gpt-4'
  );

  // Load required Supabase configuration
  const supabaseUrl = requireEnv(
    process.env.SUPABASE_URL,
    'SUPABASE_URL'
  );
  const supabaseKey = requireEnv(
    process.env.SUPABASE_KEY,
    'SUPABASE_KEY'
  );

  // Load optional application settings with defaults
  const confidenceThreshold = parseNumber(
    process.env.CONFIDENCE_THRESHOLD,
    0.8,
    'CONFIDENCE_THRESHOLD'
  );
  const maxRetries = parseNumber(
    process.env.MAX_RETRIES,
    3,
    'MAX_RETRIES'
  );
  const retryDelay = parseNumber(
    process.env.RETRY_DELAY,
    2000,
    'RETRY_DELAY'
  );
  const logLevel = getEnvOrDefault(
    process.env.LOG_LEVEL,
    'info'
  );
  const nodeEnv = getEnvOrDefault(
    process.env.NODE_ENV,
    'development'
  );

  // Validate application settings
  validateConfidenceThreshold(confidenceThreshold);
  validateRetrySettings(maxRetries, retryDelay);

  // Construct and return the configuration object
  const config: Config = {
    telegram: {
      botToken: telegramBotToken,
    },
    openai: {
      apiKey: openaiApiKey,
      apiBase: openaiApiBase,
      visionModel,
      textModel,
    },
    supabase: {
      url: supabaseUrl,
      key: supabaseKey,
    },
    app: {
      confidenceThreshold,
      maxRetries,
      retryDelay,
      logLevel,
      nodeEnv,
    },
  };

  return config;
}

/**
 * Singleton configuration instance
 * Loaded once and reused throughout the application
 */
let configInstance: Config | null = null;

/**
 * Gets the application configuration
 * Loads configuration on first call and caches it for subsequent calls
 * @returns The application configuration
 * @throws ConfigValidationError if configuration is invalid
 */
export function getConfig(): Config {
  if (!configInstance) {
    configInstance = loadConfig();
  }
  return configInstance;
}

/**
 * Resets the configuration instance (useful for testing)
 */
export function resetConfig(): void {
  configInstance = null;
}
