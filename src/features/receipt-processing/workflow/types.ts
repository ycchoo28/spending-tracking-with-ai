/**
 * Workflow types and interfaces
 */

import { VisionProcessor, ExtractedTransaction } from '../vision/vision-processor';
import { TransactionCategorizer } from '../categorizer/categorizer';
import { DatabaseClient } from '../../../core/database/database';

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
