/**
 * Extract data node - Extracts transaction data from image
 */

import { WorkflowState, WorkflowDependencies } from '../types';
import { ExtractedTransaction } from '../../vision/vision-processor';

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

      console.log('📊 Extracted data from vision processor:', JSON.stringify(extractedData, null, 2));

      // Validate extracted data
      const isValid = validateExtractedData(extractedData);

      console.log('✅ Validation result:', {
        isValid,
        merchantName: extractedData.merchantName,
        amount: extractedData.amount,
        confidence: extractedData.confidence,
      });

      if (!isValid) {
        console.log('❌ Validation failed:', {
          merchantName: extractedData.merchantName,
          merchantNameValid: extractedData.merchantName && extractedData.merchantName !== 'Unknown Merchant',
          amount: extractedData.amount,
          amountValid: extractedData.amount && extractedData.amount > 0,
          confidence: extractedData.confidence,
          confidenceValid: extractedData.confidence >= 0.3,
        });
      }

      return {
        extractedData,
        extractionValid: isValid,
        error: isValid ? undefined : 'Extracted data is incomplete or invalid',
        errorType: isValid ? undefined : 'extraction',
      };
    } catch (error) {
      lastError = error as Error;
      console.error('❌ Extract data node error:', error);

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
