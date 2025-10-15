/**
 * Categorize node - Categorizes the transaction
 */

import { WorkflowState, WorkflowDependencies } from '../types';
import { logger } from '../../../../core/utils/logger';
import { CategorizationResult } from '../../categorizer/categorizer';

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
  logger.info('🏷️  Categorize node started', {
    userId: state.telegramUserId,
    hasMerchant: !!state.extractedData?.merchantName,
    merchant: state.extractedData?.merchantName,
  });

  const maxRetries = deps.maxRetries || 3;
  const retryDelay = deps.retryDelay || 2000;
  let lastError: Error | undefined;

  if (!state.extractedData) {
    logger.error('Categorize node: No extracted data', undefined, {
      userId: state.telegramUserId,
      stateKeys: Object.keys(state),
    });
    return {
      error: 'No extracted data available for categorization',
      errorType: 'validation',
    };
  }

  // Retry loop for transient failures
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      logger.debug('Calling categorizer', {
        attempt: attempt + 1,
        merchant: state.extractedData.merchantName,
      });

      // Call categorizer to classify the transaction
      const result: CategorizationResult = await deps.categorizer.categorize(
        state.extractedData,
        state.telegramUserId
      );

      console.log('📊 Categorization result:', JSON.stringify(result, null, 2));

      // Determine if clarification is needed based on confidence threshold
      const needsClarification = result.confidence < deps.confidenceThreshold;

      logger.info('Categorize node completed', {
        category: result.category,
        confidence: result.confidence,
        reasoning: result.reasoning,
        needsClarification,
        confidenceThreshold: deps.confidenceThreshold,
      });

      console.log('✅ Categorization complete:', {
        category: result.category,
        confidence: result.confidence,
        reasoning: result.reasoning,
        needsClarification,
        threshold: deps.confidenceThreshold,
      });

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
      logger.error('Categorize node attempt failed', error as Error, {
        attempt: attempt + 1,
        maxRetries: maxRetries + 1,
      });

      // Check if error is retryable
      const isRetryable = isRetryableError(error as Error);

      if (!isRetryable || attempt >= maxRetries) {
        break;
      }

      // Wait before retrying with exponential backoff
      const delay = retryDelay * Math.pow(2, attempt);
      logger.info(`Waiting ${delay}ms before retry...`);
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
