/**
 * Transaction Categorization Module
 * 
 * Provides intelligent categorization of transactions using LLM-based classification
 * with historical learning capabilities.
 */

export {
  TransactionCategorizer,
  CategorizationError,
  CATEGORIES,
  type Category,
  type CategorizationResult,
  type CategorizerConfig,
} from './categorizer';
