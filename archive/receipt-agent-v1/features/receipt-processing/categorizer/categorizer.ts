import { ChatOpenAI } from '@langchain/openai';
import { DatabaseClient, Transaction } from '../../../core/database/database';
import { ExtractedTransaction } from '../vision/vision-processor';
import { logger } from '../../../core/utils/logger';
import { 
  buildCategorizationPrompt,
  CATEGORIES,
  type Category 
} from '../../../prompts/receipt/categorization';
import { buildSuggestionPrompt } from '../../../prompts/receipt/suggestion';
import { cleanJsonResponse } from '../../../prompts/shared/formatters';

// Re-export for convenience
export { CATEGORIES, type Category };

/**
 * Result of transaction categorization
 */
export interface CategorizationResult {
  category: Category;
  confidence: number; // 0-1 scale
  reasoning?: string; // Explanation of why this category was chosen
  suggestedCategories?: Category[]; // Alternative suggestions for low confidence
}

/**
 * Error thrown when categorization operations fail
 */
export class CategorizationError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'CategorizationError';
  }
}

/**
 * Configuration for TransactionCategorizer
 */
export interface CategorizerConfig {
  apiKey: string;
  apiBase: string;
  model: string;
  confidenceThreshold: number;
}

/**
 * TransactionCategorizer handles intelligent categorization of transactions
 * using LLM-based classification with historical learning
 */
export class TransactionCategorizer {
  private llm: ChatOpenAI;
  private db: DatabaseClient;
  private confidenceThreshold: number;

  /**
   * Creates a new TransactionCategorizer instance
   * @param config - Configuration for API access and thresholds
   * @param db - Database client for accessing transaction history
   */
  constructor(config: CategorizerConfig, db: DatabaseClient) {
    this.llm = new ChatOpenAI({
      openAIApiKey: config.apiKey,
      configuration: {
        baseURL: config.apiBase,
      },
      modelName: config.model,
      temperature: 0.3, // Low temperature for more consistent categorization
    });

    this.db = db;
    this.confidenceThreshold = config.confidenceThreshold;
  }

  /**
   * Fetches similar transactions from user's history for context
   * @param merchantName - The merchant name to search for
   * @param userId - The user ID to scope the search
   * @returns Array of similar transactions
   */
  async getSimilarTransactions(
    merchantName: string,
    userId: string
  ): Promise<Transaction[]> {
    try {
      return await this.db.getSimilarTransactions(merchantName, userId, 5);
    } catch (error) {
      // Log error but don't fail categorization if history fetch fails
      console.error('Failed to fetch similar transactions:', error);
      return [];
    }
  }

  /**
   * Parses the LLM response into a CategorizationResult
   * @param response - Raw response string from the LLM
   * @returns Parsed categorization result
   */
  private parseCategorizationResponse(response: string): CategorizationResult {
    try {
      // Clean up response using shared formatter
      const cleanedResponse = cleanJsonResponse(response);

      // Parse JSON
      const parsed = JSON.parse(cleanedResponse);

      // Validate category
      if (!CATEGORIES.includes(parsed.category)) {
        // Try to find closest match or default to "Others"
        console.warn(`Invalid category "${parsed.category}", defaulting to "Others"`);
        parsed.category = 'Others';
        parsed.confidence = Math.min(parsed.confidence || 0.5, 0.5);
      }

      // Validate confidence
      const confidence = typeof parsed.confidence === 'number'
        ? Math.max(0, Math.min(1, parsed.confidence))
        : 0.5;

      // Extract reasoning if available
      const reasoning = typeof parsed.reasoning === 'string' 
        ? parsed.reasoning 
        : undefined;

      // Extract alternative categories if available
      const alternativeCategories = Array.isArray(parsed.alternativeCategories)
        ? parsed.alternativeCategories.filter((cat: string) => CATEGORIES.includes(cat as Category))
        : undefined;

      return {
        category: parsed.category as Category,
        confidence,
        reasoning,
        suggestedCategories: alternativeCategories,
      };
    } catch (error) {
      throw new CategorizationError(
        `Failed to parse categorization response: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  /**
   * Categorizes a transaction and returns category with confidence score
   * @param transactionData - The extracted transaction data
   * @param userId - The user ID for historical context
   * @returns Categorization result with category and confidence
   * @throws CategorizationError if categorization fails
   */
  async categorize(
    transactionData: ExtractedTransaction,
    userId: string
  ): Promise<CategorizationResult> {
    const operationId = `categorize_${userId}_${Date.now()}`;
    logger.startPerformanceTracking(operationId, 'categorization', {
      merchant: transactionData.merchantName,
      userId,
    });

    try {
      logger.debug('Starting categorization', {
        merchant: transactionData.merchantName,
        amount: `${transactionData.currency} ${transactionData.amount}`,
      });

      // Fetch similar transactions for context
      const history = await this.getSimilarTransactions(
        transactionData.merchantName,
        userId
      );

      if (history.length > 0) {
        logger.debug('Found similar transactions in history', {
          count: history.length,
          categories: history.map(t => t.category),
        });
      }

      // Build the prompt using centralized prompt builder
      const prompt = buildCategorizationPrompt(transactionData, history);

      // Call the LLM
      logger.debug('Calling categorization API', {
        model: this.llm.modelName,
      });

      const apiStartTime = Date.now();
      const response = await this.llm.invoke(prompt);
      const apiDuration = Date.now() - apiStartTime;

      logger.debug('Categorization API response received', {
        duration: `${apiDuration}ms`,
      });

      const content = response.content as string;

      // Parse the response
      const result = this.parseCategorizationResponse(content);

      logger.info('Transaction categorized', {
        category: result.category,
        confidence: result.confidence,
        reasoning: result.reasoning,
        needsClarification: result.confidence < this.confidenceThreshold,
      });

      // If confidence is below threshold, include suggested categories
      if (result.confidence < this.confidenceThreshold) {
        logger.debug('Confidence below threshold, suggesting alternatives', {
          threshold: this.confidenceThreshold,
          confidence: result.confidence,
        });

        result.suggestedCategories = await this.suggestCategories(
          transactionData,
          result.category
        );

        logger.debug('Alternative categories suggested', {
          suggestions: result.suggestedCategories,
        });
      }

      logger.endPerformanceTracking(operationId, true, undefined, {
        category: result.category,
        confidence: result.confidence,
      });

      return result;
    } catch (error) {
      logger.error('Categorization failed', error as Error, {
        merchant: transactionData.merchantName,
      });

      logger.endPerformanceTracking(operationId, false, (error as Error).message);

      throw new CategorizationError(
        `Failed to categorize transaction: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  /**
   * Suggests alternative categories for low-confidence scenarios
   * @param transactionData - The extracted transaction data
   * @param primaryCategory - The primary category assigned
   * @returns Array of suggested categories
   */
  async suggestCategories(
    transactionData: ExtractedTransaction,
    primaryCategory: Category
  ): Promise<Category[]> {
    try {
      // Build suggestion prompt using centralized prompt builder
      const prompt = buildSuggestionPrompt(transactionData);

      const response = await this.llm.invoke(prompt);
      const content = response.content as string;

      // Parse the response
      const cleanedResponse = cleanJsonResponse(content);
      const suggestions = JSON.parse(cleanedResponse);

      // Validate and filter suggestions
      const validSuggestions = suggestions
        .filter((cat: string) => CATEGORIES.includes(cat as Category))
        .slice(0, 3) as Category[];

      // Ensure primary category is included if not already
      if (!validSuggestions.includes(primaryCategory)) {
        validSuggestions.unshift(primaryCategory);
      }

      return validSuggestions.slice(0, 3);
    } catch (error) {
      // Fallback to primary category and common alternatives
      console.error('Failed to suggest categories:', error);
      return [primaryCategory, 'Others', 'Shopping'].slice(0, 3) as Category[];
    }
  }

  /**
   * Updates category learning data when user corrects a category
   * This is called after a user manually selects a category
   * @param transactionId - The transaction ID that was corrected
   * @param category - The user-selected category
   */
  async learnFromCorrection(
    transactionId: string,
    category: string
  ): Promise<void> {
    try {
      // Update the transaction with the corrected category
      await this.db.updateTransactionCategory(transactionId, category);

      // The database client handles updating the category_learning table
      console.log(
        `Learned from user correction: Transaction ${transactionId} -> ${category}`
      );
    } catch (error) {
      console.error('Failed to learn from correction:', error);
      // Don't throw error - learning failure shouldn't break the flow
    }
  }
}
