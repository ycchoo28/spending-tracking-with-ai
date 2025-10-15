/**
 * Store transaction node - Stores transaction in database
 */

import { WorkflowState, WorkflowDependencies } from '../types';
import { TransactionInput } from '../../../../core/database/database';
import { logger } from '../../../../core/utils/logger';

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
  logger.info('💾 Store transaction node started', {
    userId: state.telegramUserId,
    merchant: state.extractedData?.merchantName,
    category: state.category,
    amount: state.extractedData?.amount,
  });

  const maxRetries = deps.maxRetries || 3;
  const retryDelay = deps.retryDelay || 2000;
  let lastError: Error | undefined;

  if (!state.extractedData || !state.category) {
    logger.error('Store transaction node: Missing required data', undefined, {
      hasExtractedData: !!state.extractedData,
      hasCategory: !!state.category,
      stateKeys: Object.keys(state),
    });
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

  logger.debug('Transaction input prepared', {
    merchant: transactionInput.merchant_name,
    amount: transactionInput.amount,
    category: transactionInput.category,
  });

  // Retry loop for transient database failures
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      logger.debug('Storing transaction in database', {
        attempt: attempt + 1,
      });

      // Store in database
      console.log('💾 Storing transaction:', JSON.stringify(transactionInput, null, 2));
      
      const transactionId = await deps.database.storeTransaction(transactionInput);

      logger.info('Store transaction node completed', {
        transactionId,
      });

      console.log('✅ Transaction stored successfully:', {
        transactionId,
        merchant: transactionInput.merchant_name,
        amount: transactionInput.amount,
        category: transactionInput.category,
      });

      return {
        transactionId,
        error: undefined,
        errorType: undefined,
      };
    } catch (error) {
      lastError = error as Error;
      logger.error('Store transaction attempt failed', error as Error, {
        attempt: attempt + 1,
        maxRetries: maxRetries + 1,
      });

      // Database errors are typically retryable
      if (attempt >= maxRetries) {
        break;
      }

      // Wait before retrying with exponential backoff
      const delay = retryDelay * Math.pow(2, attempt);
      logger.info(`Waiting ${delay}ms before retry...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // All retries exhausted
  logger.error('Store transaction node FAILED after all retries', lastError, {
    attempts: maxRetries + 1,
  });

  return {
    error: `Failed to store transaction after ${maxRetries + 1} attempts: ${lastError?.message || 'Unknown error'}`,
    errorType: 'storage',
  };
}
