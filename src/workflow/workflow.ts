import { VisionProcessor, ExtractedTransaction } from '../vision/vision-processor';
import { TransactionCategorizer, CategorizationResult } from '../categorizer/categorizer';
import { DatabaseClient, TransactionInput } from '../database/database';

/**
 * Workflow state interface that tracks the processing of a receipt/transaction
 * This state is passed through all nodes in the LangGraph state machine
 */
export interface WorkflowState {
  // User identification
  telegramUserId: string;
  chatId: number;

  // Image data
  imageUrl?: string;
  imageData?: Buffer;

  // Extracted transaction data
  extractedData?: ExtractedTransaction;

  // Categorization results
  category?: string;
  confidence?: number;
  suggestedCategories?: string[];

  // Transaction storage
  transactionId?: string;

  // Error handling
  error?: string;
  errorType?: 'extraction' | 'categorization' | 'storage' | 'validation' | 'network' | 'timeout' | 'unknown';

  // Workflow control
  awaitingUserInput: boolean;
  needsClarification: boolean;
  extractionValid: boolean;

  // Confirmation message
  confirmationMessage?: string;
}

/**
 * Dependencies required by workflow nodes
 */
export interface WorkflowDependencies {
  visionProcessor: VisionProcessor;
  categorizer: TransactionCategorizer;
  database: DatabaseClient;
  confidenceThreshold: number;
  maxRetries?: number;
  retryDelay?: number;
}

/**
 * Initialize state with image data
 * This is the entry point node for the workflow
 * @param state - Current workflow state
 * @returns Updated state with image data initialized
 */
export async function receiveImageNode(
  state: WorkflowState
): Promise<Partial<WorkflowState>> {
  try {
    // Validate that we have image data
    if (!state.imageData) {
      return {
        error: 'No image data provided',
        errorType: 'validation',
        extractionValid: false,
      };
    }

    // Initialize workflow flags
    return {
      awaitingUserInput: false,
      needsClarification: false,
      extractionValid: false,
      error: undefined,
      errorType: undefined,
    };
  } catch (error) {
    return {
      error: `Failed to receive image: ${(error as Error).message}`,
      errorType: 'unknown',
      extractionValid: false,
    };
  }
}

/**
 * Extract transaction data from image using VisionProcessor
 * Includes retry logic for transient failures
 * @param state - Current workflow state
 * @param deps - Workflow dependencies
 * @returns Updated state with extracted transaction data
 */
export async function extractDataNode(
  state: WorkflowState,
  deps: WorkflowDependencies
): Promise<Partial<WorkflowState>> {
  const maxRetries = deps.maxRetries || 3;
  const retryDelay = deps.retryDelay || 2000;
  let lastError: Error | undefined;

  if (!state.imageData) {
    return {
      error: 'No image data available for extraction',
      errorType: 'validation',
      extractionValid: false,
    };
  }

  // Retry loop for transient failures
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Call vision processor to extract transaction data
      const extractedData = await deps.visionProcessor.extractTransactionData(
        state.imageData
      );

      // Validate extracted data
      const isValid = validateExtractedData(extractedData);

      return {
        extractedData,
        extractionValid: isValid,
        error: isValid ? undefined : 'Extracted data is incomplete or invalid',
        errorType: isValid ? undefined : 'extraction',
      };
    } catch (error) {
      lastError = error as Error;

      // Check if error is retryable (network/timeout errors)
      const isRetryable = isRetryableError(error as Error);

      if (!isRetryable || attempt >= maxRetries) {
        // Don't retry, return error
        break;
      }

      // Wait before retrying with exponential backoff
      const delay = retryDelay * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // All retries exhausted or non-retryable error
  return {
    error: `Failed to extract transaction data: ${lastError?.message || 'Unknown error'}`,
    errorType: 'extraction',
    extractionValid: false,
  };
}

/**
 * Validate extracted transaction data
 * @param data - Extracted transaction data
 * @returns True if data is valid, false otherwise
 */
function validateExtractedData(data: ExtractedTransaction): boolean {
  // Check required fields
  if (!data.merchantName || data.merchantName === 'Unknown Merchant') {
    return false;
  }

  if (!data.amount || data.amount <= 0) {
    return false;
  }

  // Check confidence threshold for extraction
  if (data.confidence < 0.3) {
    return false;
  }

  return true;
}

/**
 * Check if an error is retryable (network/timeout errors)
 * @param error - The error to check
 * @returns True if error is retryable, false otherwise
 */
function isRetryableError(error: Error): boolean {
  const errorMessage = error.message.toLowerCase();

  // Network errors
  if (
    errorMessage.includes('network') ||
    errorMessage.includes('econnrefused') ||
    errorMessage.includes('enotfound') ||
    errorMessage.includes('timeout') ||
    errorMessage.includes('timed out') ||
    errorMessage.includes('etimedout') ||
    errorMessage.includes('rate limit') ||
    errorMessage.includes('429') ||
    errorMessage.includes('503') ||
    errorMessage.includes('502')
  ) {
    return true;
  }

  return false;
}

/**
 * Categorize the transaction using TransactionCategorizer
 * Includes retry logic for transient failures
 * @param state - Current workflow state
 * @param deps - Workflow dependencies
 * @returns Updated state with categorization results
 */
export async function categorizeNode(
  state: WorkflowState,
  deps: WorkflowDependencies
): Promise<Partial<WorkflowState>> {
  const maxRetries = deps.maxRetries || 3;
  const retryDelay = deps.retryDelay || 2000;
  let lastError: Error | undefined;

  if (!state.extractedData) {
    return {
      error: 'No extracted data available for categorization',
      errorType: 'validation',
    };
  }

  // Retry loop for transient failures
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Call categorizer to classify the transaction
      const result: CategorizationResult = await deps.categorizer.categorize(
        state.extractedData,
        state.telegramUserId
      );

      // Determine if clarification is needed based on confidence threshold
      const needsClarification = result.confidence < deps.confidenceThreshold;

      return {
        category: result.category,
        confidence: result.confidence,
        suggestedCategories: result.suggestedCategories,
        needsClarification,
        error: undefined,
        errorType: undefined,
      };
    } catch (error) {
      lastError = error as Error;

      // Check if error is retryable
      const isRetryable = isRetryableError(error as Error);

      if (!isRetryable || attempt >= maxRetries) {
        break;
      }

      // Wait before retrying with exponential backoff
      const delay = retryDelay * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // All retries exhausted or non-retryable error
  return {
    error: `Failed to categorize transaction: ${lastError?.message || 'Unknown error'}`,
    errorType: 'categorization',
    needsClarification: false,
  };
}

/**
 * Prepare clarification message for user when confidence is low
 * This node sets up the state for requesting user input
 * @param state - Current workflow state
 * @returns Updated state with clarification request prepared
 */
export async function requestClarificationNode(
  state: WorkflowState
): Promise<Partial<WorkflowState>> {
  try {
    if (!state.extractedData) {
      return {
        error: 'No extracted data available for clarification',
        errorType: 'validation',
      };
    }

    // Set flag to indicate we're waiting for user input
    // The Telegram bot handler will use this to send interactive message
    return {
      awaitingUserInput: true,
      error: undefined,
      errorType: undefined,
    };
  } catch (error) {
    return {
      error: `Failed to prepare clarification request: ${(error as Error).message}`,
      errorType: 'unknown',
      awaitingUserInput: false,
    };
  }
}

/**
 * Store the transaction in the database
 * Includes retry logic for transient database failures
 * @param state - Current workflow state
 * @param deps - Workflow dependencies
 * @returns Updated state with transaction ID
 */
export async function storeTransactionNode(
  state: WorkflowState,
  deps: WorkflowDependencies
): Promise<Partial<WorkflowState>> {
  const maxRetries = deps.maxRetries || 3;
  const retryDelay = deps.retryDelay || 2000;
  let lastError: Error | undefined;

  if (!state.extractedData || !state.category) {
    return {
      error: 'Missing required data for storing transaction',
      errorType: 'validation',
    };
  }

  // Prepare transaction input
  const transactionInput: TransactionInput = {
    user_id: state.telegramUserId,
    telegram_user_id: state.telegramUserId,
    amount: state.extractedData.amount,
    currency: state.extractedData.currency,
    merchant_name: state.extractedData.merchantName,
    category: state.category,
    date_time: state.extractedData.dateTime,
    payment_method: state.extractedData.paymentMethod,
    transaction_reference: state.extractedData.transactionReference,
    image_url: state.imageUrl,
    raw_extracted_data: state.extractedData,
    confidence_score: state.confidence,
    user_corrected: state.awaitingUserInput, // True if user provided category
  };

  // Retry loop for transient database failures
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Store in database
      const transactionId = await deps.database.storeTransaction(transactionInput);

      return {
        transactionId,
        error: undefined,
        errorType: undefined,
      };
    } catch (error) {
      lastError = error as Error;

      // Database errors are typically retryable
      if (attempt >= maxRetries) {
        break;
      }

      // Wait before retrying with exponential backoff
      const delay = retryDelay * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // All retries exhausted
  return {
    error: `Failed to store transaction after ${maxRetries + 1} attempts: ${lastError?.message || 'Unknown error'}`,
    errorType: 'storage',
  };
}

/**
 * Format confirmation message for the user
 * @param state - Current workflow state
 * @returns Updated state with confirmation message
 */
export async function sendConfirmationNode(
  state: WorkflowState
): Promise<Partial<WorkflowState>> {
  try {
    if (!state.extractedData || !state.category) {
      return {
        error: 'Missing required data for confirmation',
        errorType: 'validation',
      };
    }

    // Format the confirmation message
    const message = formatConfirmationMessage(state);

    return {
      confirmationMessage: message,
      error: undefined,
      errorType: undefined,
    };
  } catch (error) {
    return {
      error: `Failed to format confirmation: ${(error as Error).message}`,
      errorType: 'unknown',
    };
  }
}

/**
 * Format a user-friendly confirmation message
 * @param state - Current workflow state
 * @returns Formatted confirmation message
 */
function formatConfirmationMessage(state: WorkflowState): string {
  const data = state.extractedData!;
  const category = state.category!;

  // Format date/time
  const dateTime = new Date(data.dateTime);
  const formattedDate = dateTime.toLocaleDateString('en-MY', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  const formattedTime = dateTime.toLocaleTimeString('en-MY', {
    hour: '2-digit',
    minute: '2-digit',
  });

  // Build message
  let message = '✅ Transaction recorded successfully!\n\n';
  message += `💰 Amount: ${data.currency} ${data.amount.toFixed(2)}\n`;
  message += `🏪 Merchant: ${data.merchantName}\n`;
  message += `📁 Category: ${category}\n`;
  message += `📅 Date: ${formattedDate}\n`;
  message += `🕐 Time: ${formattedTime}\n`;

  if (data.paymentMethod) {
    message += `💳 Payment: ${data.paymentMethod}\n`;
  }

  if (data.transactionReference) {
    message += `🔖 Reference: ${data.transactionReference}\n`;
  }

  // Add items if available
  if (data.items && data.items.length > 0) {
    message += '\n📝 Items:\n';
    data.items.forEach((item) => {
      message += `  • ${item.name} (${item.quantity}x) - ${data.currency} ${item.price.toFixed(2)}\n`;
    });
  }

  if (state.transactionId) {
    message += `\n🆔 Transaction ID: ${state.transactionId}`;
  }

  return message;
}
