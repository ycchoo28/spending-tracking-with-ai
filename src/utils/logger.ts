import winston from 'winston';

/**
 * Performance metrics interface for tracking processing times
 */
export interface PerformanceMetrics {
  operation: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  success: boolean;
  error?: string;
  metadata?: Record<string, any>;
}

/**
 * Logger class that provides structured logging with winston
 * Includes performance metrics tracking
 */
class Logger {
  private logger: winston.Logger;
  private metrics: Map<string, PerformanceMetrics>;

  constructor() {
    // Get log level from environment or default to 'info'
    const logLevel = process.env.LOG_LEVEL || 'info';
    const nodeEnv = process.env.NODE_ENV || 'development';

    // Configure winston logger
    this.logger = winston.createLogger({
      level: logLevel,
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.splat(),
        winston.format.json()
      ),
      defaultMeta: { service: 'receipt-tracker-agent' },
      transports: [
        // Console transport with colorized output for development
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.printf(({ timestamp, level, message, ...meta }) => {
              let metaStr = '';
              if (Object.keys(meta).length > 0 && meta.service !== 'receipt-tracker-agent') {
                metaStr = ` ${JSON.stringify(meta)}`;
              }
              return `${timestamp} [${level}]: ${message}${metaStr}`;
            })
          ),
        }),
      ],
    });

    // Add file transport in production
    if (nodeEnv === 'production') {
      this.logger.add(
        new winston.transports.File({
          filename: 'logs/error.log',
          level: 'error',
          format: winston.format.json(),
        })
      );
      this.logger.add(
        new winston.transports.File({
          filename: 'logs/combined.log',
          format: winston.format.json(),
        })
      );
    }

    this.metrics = new Map();
  }

  /**
   * Log an info message
   * @param message - The message to log
   * @param meta - Additional metadata
   */
  info(message: string, meta?: Record<string, any>): void {
    this.logger.info(message, meta);
  }

  /**
   * Log a warning message
   * @param message - The message to log
   * @param meta - Additional metadata
   */
  warn(message: string, meta?: Record<string, any>): void {
    this.logger.warn(message, meta);
  }

  /**
   * Log an error message
   * @param message - The message to log
   * @param error - The error object
   * @param meta - Additional metadata
   */
  error(message: string, error?: Error | any, meta?: Record<string, any>): void {
    const errorMeta = {
      ...meta,
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : error,
    };
    this.logger.error(message, errorMeta);
  }

  /**
   * Log a debug message
   * @param message - The message to log
   * @param meta - Additional metadata
   */
  debug(message: string, meta?: Record<string, any>): void {
    this.logger.debug(message, meta);
  }

  /**
   * Start tracking performance for an operation
   * @param operationId - Unique identifier for the operation
   * @param operation - Name of the operation
   * @param metadata - Additional metadata
   */
  startPerformanceTracking(
    operationId: string,
    operation: string,
    metadata?: Record<string, any>
  ): void {
    const metric: PerformanceMetrics = {
      operation,
      startTime: Date.now(),
      success: false,
      metadata,
    };
    this.metrics.set(operationId, metric);
    this.debug(`Started: ${operation}`, { operationId, ...metadata });
  }

  /**
   * End performance tracking for an operation
   * @param operationId - Unique identifier for the operation
   * @param success - Whether the operation succeeded
   * @param error - Error message if operation failed
   * @param metadata - Additional metadata
   */
  endPerformanceTracking(
    operationId: string,
    success: boolean = true,
    error?: string,
    metadata?: Record<string, any>
  ): void {
    const metric = this.metrics.get(operationId);
    if (!metric) {
      this.warn(`Performance tracking not found for operation: ${operationId}`);
      return;
    }

    metric.endTime = Date.now();
    metric.duration = metric.endTime - metric.startTime;
    metric.success = success;
    metric.error = error;

    // Log the performance metric
    const logMeta = {
      operationId,
      operation: metric.operation,
      duration: `${metric.duration}ms`,
      success: metric.success,
      ...metric.metadata,
      ...metadata,
    };

    if (success) {
      this.info(`Completed: ${metric.operation}`, logMeta);
    } else {
      this.error(`Failed: ${metric.operation}`, error, logMeta);
    }

    // Clean up
    this.metrics.delete(operationId);
  }

  /**
   * Log image received event
   * @param userId - The user ID
   * @param imageSize - Size of the image in bytes
   */
  logImageReceived(userId: string, imageSize: number): void {
    this.info('Image received', {
      event: 'image_received',
      userId,
      imageSize: `${(imageSize / 1024).toFixed(2)} KB`,
    });
  }

  /**
   * Log extraction complete event
   * @param userId - The user ID
   * @param success - Whether extraction succeeded
   * @param confidence - Extraction confidence score
   * @param merchantName - Extracted merchant name
   */
  logExtractionComplete(
    userId: string,
    success: boolean,
    confidence?: number,
    merchantName?: string
  ): void {
    if (success) {
      this.info('Extraction complete', {
        event: 'extraction_complete',
        userId,
        confidence,
        merchantName,
      });
    } else {
      this.warn('Extraction failed', {
        event: 'extraction_failed',
        userId,
      });
    }
  }

  /**
   * Log categorization event
   * @param userId - The user ID
   * @param category - Assigned category
   * @param confidence - Categorization confidence score
   * @param needsClarification - Whether user clarification is needed
   */
  logCategorization(
    userId: string,
    category: string,
    confidence: number,
    needsClarification: boolean
  ): void {
    this.info('Transaction categorized', {
      event: 'categorization',
      userId,
      category,
      confidence,
      needsClarification,
    });
  }

  /**
   * Log storage event
   * @param userId - The user ID
   * @param transactionId - The stored transaction ID
   * @param amount - Transaction amount
   * @param category - Transaction category
   */
  logStorage(
    userId: string,
    transactionId: string,
    amount: number,
    category: string
  ): void {
    this.info('Transaction stored', {
      event: 'storage',
      userId,
      transactionId,
      amount,
      category,
    });
  }

  /**
   * Log API call event
   * @param apiType - Type of API (vision, text, database)
   * @param endpoint - API endpoint or operation
   * @param duration - Duration in milliseconds
   * @param success - Whether the call succeeded
   */
  logApiCall(
    apiType: 'vision' | 'text' | 'database',
    endpoint: string,
    duration: number,
    success: boolean
  ): void {
    this.debug('API call', {
      event: 'api_call',
      apiType,
      endpoint,
      duration: `${duration}ms`,
      success,
    });
  }

  /**
   * Log user interaction event
   * @param userId - The user ID
   * @param interaction - Type of interaction
   * @param details - Additional details
   */
  logUserInteraction(
    userId: string,
    interaction: 'category_selected' | 'command' | 'photo_sent',
    details?: Record<string, any>
  ): void {
    this.info('User interaction', {
      event: 'user_interaction',
      userId,
      interaction,
      ...details,
    });
  }

  /**
   * Get the winston logger instance (for advanced usage)
   * @returns The winston logger
   */
  getLogger(): winston.Logger {
    return this.logger;
  }
}

// Export singleton instance
export const logger = new Logger();
