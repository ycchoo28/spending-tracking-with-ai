import { WorkflowState } from './workflow';

/**
 * Error types that can occur during workflow execution
 */
export type WorkflowErrorType =
  | 'extraction'
  | 'categorization'
  | 'storage'
  | 'validation'
  | 'network'
  | 'timeout'
  | 'unknown';

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  LOW = 'low', // Recoverable, can retry
  MEDIUM = 'medium', // May need user intervention
  HIGH = 'high', // Critical, workflow should stop
}

/**
 * Structured error information
 */
export interface WorkflowError {
  type: WorkflowErrorType;
  message: string;
  severity: ErrorSeverity;
  retryable: boolean;
  userMessage: string; // User-friendly error message
  originalError?: Error;
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxRetries: number;
  retryDelay: number; // Base delay in milliseconds
  exponentialBackoff: boolean;
}

/**
 * ErrorHandler class for managing workflow errors
 * Provides error classification, retry logic, and user-friendly messaging
 */
export class ErrorHandler {
  private retryConfig: RetryConfig;
  private retryAttempts: Map<string, number>;

  /**
   * Creates a new ErrorHandler instance
   * @param retryConfig - Configuration for retry behavior
   */
  constructor(retryConfig: RetryConfig) {
    this.retryConfig = retryConfig;
    this.retryAttempts = new Map();
  }

  /**
   * Handles an error that occurred during workflow execution
   * @param error - The error that occurred
   * @param state - Current workflow state
   * @returns Updated state with error information
   */
  async handleError(
    error: Error,
    state: WorkflowState
  ): Promise<Partial<WorkflowState>> {
    // Classify the error
    const workflowError = this.classifyError(error, state);

    // Check if we should retry
    const shouldRetry = this.shouldRetry(state, workflowError);

    if (shouldRetry) {
      // Increment retry counter
      const key = this.getRetryKey(state);
      const attempts = (this.retryAttempts.get(key) || 0) + 1;
      this.retryAttempts.set(key, attempts);

      // Calculate delay
      const delay = this.calculateRetryDelay(attempts);

      // Wait before retry
      await this.sleep(delay);

      // Return state indicating retry
      return {
        error: `Retrying after error: ${workflowError.message} (attempt ${attempts}/${this.retryConfig.maxRetries})`,
        errorType: workflowError.type,
      };
    }

    // No retry, return error state
    return {
      error: workflowError.userMessage,
      errorType: workflowError.type,
    };
  }

  /**
   * Classifies an error into a WorkflowError with appropriate metadata
   * @param error - The error to classify
   * @param state - Current workflow state
   * @returns Classified workflow error
   */
  private classifyError(error: Error, state: WorkflowState): WorkflowError {
    const errorMessage = error.message.toLowerCase();

    // Check for network errors
    if (
      errorMessage.includes('network') ||
      errorMessage.includes('econnrefused') ||
      errorMessage.includes('timeout') ||
      errorMessage.includes('enotfound')
    ) {
      return {
        type: 'network',
        message: error.message,
        severity: ErrorSeverity.MEDIUM,
        retryable: true,
        userMessage:
          '🔌 Network error occurred. Please check your connection and try again.',
        originalError: error,
      };
    }

    // Check for timeout errors
    if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
      return {
        type: 'timeout',
        message: error.message,
        severity: ErrorSeverity.MEDIUM,
        retryable: true,
        userMessage:
          '⏱️ Request timed out. The service might be slow. Please try again.',
        originalError: error,
      };
    }

    // Check for extraction errors
    if (
      state.errorType === 'extraction' ||
      errorMessage.includes('extract') ||
      errorMessage.includes('vision')
    ) {
      return {
        type: 'extraction',
        message: error.message,
        severity: ErrorSeverity.MEDIUM,
        retryable: false,
        userMessage:
          '📷 Could not read the receipt clearly. Please send a clearer image with better lighting.',
        originalError: error,
      };
    }

    // Check for categorization errors
    if (
      state.errorType === 'categorization' ||
      errorMessage.includes('categoriz')
    ) {
      return {
        type: 'categorization',
        message: error.message,
        severity: ErrorSeverity.LOW,
        retryable: true,
        userMessage:
          '🏷️ Could not automatically categorize this transaction. Please select a category manually.',
        originalError: error,
      };
    }

    // Check for storage/database errors
    if (
      state.errorType === 'storage' ||
      errorMessage.includes('database') ||
      errorMessage.includes('supabase') ||
      errorMessage.includes('storage')
    ) {
      return {
        type: 'storage',
        message: error.message,
        severity: ErrorSeverity.HIGH,
        retryable: true,
        userMessage:
          '💾 Could not save the transaction. Please try again in a moment.',
        originalError: error,
      };
    }

    // Check for validation errors
    if (
      state.errorType === 'validation' ||
      errorMessage.includes('validation') ||
      errorMessage.includes('invalid') ||
      errorMessage.includes('missing')
    ) {
      return {
        type: 'validation',
        message: error.message,
        severity: ErrorSeverity.MEDIUM,
        retryable: false,
        userMessage:
          '⚠️ The receipt data is incomplete or invalid. Please send a different image.',
        originalError: error,
      };
    }

    // Default to unknown error
    return {
      type: 'unknown',
      message: error.message,
      severity: ErrorSeverity.MEDIUM,
      retryable: false,
      userMessage:
        '❌ An unexpected error occurred. Please try again or contact support if the issue persists.',
      originalError: error,
    };
  }

  /**
   * Determines if an error should be retried
   * @param state - Current workflow state
   * @param error - The classified error
   * @returns True if should retry, false otherwise
   */
  private shouldRetry(state: WorkflowState, error: WorkflowError): boolean {
    // Don't retry if error is not retryable
    if (!error.retryable) {
      return false;
    }

    // Don't retry if max retries exceeded
    const key = this.getRetryKey(state);
    const attempts = this.retryAttempts.get(key) || 0;

    if (attempts >= this.retryConfig.maxRetries) {
      return false;
    }

    return true;
  }

  /**
   * Calculates retry delay with optional exponential backoff
   * @param attempt - Current retry attempt number
   * @returns Delay in milliseconds
   */
  private calculateRetryDelay(attempt: number): number {
    if (this.retryConfig.exponentialBackoff) {
      // Exponential backoff: baseDelay * 2^(attempt-1)
      return this.retryConfig.retryDelay * Math.pow(2, attempt - 1);
    }
    return this.retryConfig.retryDelay;
  }

  /**
   * Generates a unique key for tracking retry attempts
   * @param state - Current workflow state
   * @returns Retry key
   */
  private getRetryKey(state: WorkflowState): string {
    // Use a stable key based on user and chat, not timestamp
    return `${state.telegramUserId}-${state.chatId}`;
  }

  /**
   * Sleep utility for retry delays
   * @param ms - Milliseconds to sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Resets retry attempts for a given state
   * @param state - Workflow state to reset
   */
  resetRetries(state: WorkflowState): void {
    const key = this.getRetryKey(state);
    this.retryAttempts.delete(key);
  }

  /**
   * Gets the number of retry attempts for a given state
   * @param state - Workflow state
   * @returns Number of retry attempts
   */
  getRetryAttempts(state: WorkflowState): number {
    const key = this.getRetryKey(state);
    return this.retryAttempts.get(key) || 0;
  }

  /**
   * Formats an error message for logging
   * @param error - The workflow error
   * @param state - Current workflow state
   * @returns Formatted error message
   */
  formatErrorForLogging(error: WorkflowError, state: WorkflowState): string {
    return `[${error.type.toUpperCase()}] ${error.message} | User: ${state.telegramUserId} | Chat: ${state.chatId} | Severity: ${error.severity}`;
  }

  /**
   * Creates a fallback state when all recovery attempts fail
   * @param error - The final error
   * @returns Fallback state
   */
  createFallbackState(
    error: WorkflowError
  ): Partial<WorkflowState> {
    return {
      error: error.userMessage,
      errorType: error.type,
      awaitingUserInput: false,
      needsClarification: false,
      extractionValid: false,
    };
  }
}

/**
 * Wraps a node function with error handling
 * @param nodeFunction - The node function to wrap
 * @param errorHandler - The error handler instance
 * @returns Wrapped node function with error handling
 */
export function withErrorHandling(
  nodeFunction: (state: WorkflowState, ...args: any[]) => Promise<Partial<WorkflowState>>,
  errorHandler: ErrorHandler
): (state: WorkflowState, ...args: any[]) => Promise<Partial<WorkflowState>> {
  return async (state: WorkflowState, ...args: any[]): Promise<Partial<WorkflowState>> => {
    try {
      return await nodeFunction(state, ...args);
    } catch (error) {
      console.error('Error in node function:', error);
      return await errorHandler.handleError(error as Error, state);
    }
  };
}

/**
 * Creates a default error handler with standard configuration
 * @param maxRetries - Maximum number of retries
 * @param retryDelay - Base retry delay in milliseconds
 * @returns Configured error handler
 */
export function createDefaultErrorHandler(
  maxRetries: number = 3,
  retryDelay: number = 2000
): ErrorHandler {
  return new ErrorHandler({
    maxRetries,
    retryDelay,
    exponentialBackoff: true,
  });
}
