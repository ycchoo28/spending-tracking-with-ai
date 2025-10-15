import { ChatOpenAI } from '@langchain/openai';
import { DatabaseClient, Transaction } from '../database/database';
import { ExtractedTransaction } from '../vision/vision-processor';
import { logger } from '../utils/logger';

/**
 * Supported spending categories for transaction classification
 */
export const CATEGORIES = [
  'Food & Dining',
  'Transportation',
  'Shopping',
  'Entertainment',
  'Bills & Utilities',
  'Healthcare',
  'Groceries',
  'Personal Care',
  'Education',
  'Travel & Vacation',
  'Tech Gadgets',
  'Subscriptions',
  'Others',
] as const;

export type Category = typeof CATEGORIES[number];

/**
 * Result of transaction categorization
 */
export interface CategorizationResult {
  category: Category;
  confidence: number; // 0-1 scale
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
   * Builds the categorization prompt with transaction details and historical context
   * @param transactionData - The extracted transaction data
   * @param history - Similar transactions from user's history
   * @returns Structured prompt for the LLM
   */
  private buildCategorizationPrompt(
    transactionData: ExtractedTransaction,
    history: Transaction[]
  ): string {
    const historyContext = history.length > 0
      ? `\n\n**User's Transaction History for Similar Merchants:**\n${history
        .map(
          (t, i) =>
            `${i + 1}. ${t.merchant_name} - ${t.category} (${t.currency} ${t.amount})`
        )
        .join('\n')}`
      : '\n\n**No previous transactions found for this merchant.**';

    return `You are an expert at categorizing spending transactions. Analyze the transaction details and assign it to the most appropriate category.

**Transaction Details:**
- Merchant: ${transactionData.merchantName}
- Amount: ${transactionData.currency} ${transactionData.amount}
- Payment Method: ${transactionData.paymentMethod}
- Date/Time: ${transactionData.dateTime}
${transactionData.items && transactionData.items.length > 0
        ? `- Items: ${transactionData.items.map(item => item.name).join(', ')}`
        : ''}
${historyContext}

**Available Categories:**
${CATEGORIES.map((cat, i) => `${i + 1}. ${cat}`).join('\n')}

**Categorization Guidelines:**
- Use the merchant name as the primary indicator
- Consider the items purchased if available
- Learn from the user's history - if they've categorized this merchant before, strongly prefer that category
- Be consistent with similar merchants (e.g., all restaurants should be "Food & Dining")
- Use "Groceries" for supermarkets and grocery stores
- Use "Food & Dining" for restaurants, cafes, and food delivery
- Use "Transportation" for ride-sharing, public transport, fuel, parking
- Use "Bills & Utilities" for recurring services like electricity, water, internet, phone
- Use "Shopping" for retail purchases, clothing, general merchandise
- Use "Entertainment" for movies, games, concerts, events
- Use "Healthcare" for medical, dental, pharmacy, insurance
- Use "Personal Care" for salons, spas, cosmetics
- Use "Education" for courses, books, tuition
- Use "Travel & Vacation" for flights, hotels, travel agencies, vacation packages, tourist attractions
- Use "Tech Gadgets" for electronics, computers, smartphones, tablets, tech accessories, software purchases
- Use "Subscriptions" for recurring digital services like Netflix, Spotify, cloud storage, software subscriptions, memberships
- Use "Others" only when no other category fits

**Confidence Scoring:**
- High confidence (0.8-1.0): Clear merchant type, matches history, or obvious category
- Medium confidence (0.5-0.8): Reasonable guess but some ambiguity
- Low confidence (0.0-0.5): Unclear merchant type or conflicting signals

**Response Format:**
Return ONLY a valid JSON object with this exact structure (no markdown, no code blocks):

{
  "category": "Category Name",
  "confidence": 0.95,
  "reasoning": "Brief explanation of why this category was chosen",
  "alternativeCategories": ["Alternative 1", "Alternative 2"]
}

The "alternativeCategories" should contain 2-3 other plausible categories, ordered by likelihood.

Now categorize this transaction:`;
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

      // Build the prompt
      const prompt = this.buildCategorizationPrompt(transactionData, history);

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
   * Parses the LLM response into a CategorizationResult
   * @param response - Raw response string from the LLM
   * @returns Parsed categorization result
   */
  private parseCategorizationResponse(response: string): CategorizationResult {
    try {
      // Clean up response - remove markdown code blocks if present
      let cleanedResponse = response.trim();
      cleanedResponse = cleanedResponse.replace(/```json\s*/g, '');
      cleanedResponse = cleanedResponse.replace(/```\s*/g, '');
      cleanedResponse = cleanedResponse.trim();

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

      return {
        category: parsed.category as Category,
        confidence,
      };
    } catch (error) {
      throw new CategorizationError(
        `Failed to parse categorization response: ${(error as Error).message}`,
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
      // Build a simpler prompt for suggestions
      const prompt = `Given this transaction, suggest 3 most likely spending categories in order of likelihood:

Merchant: ${transactionData.merchantName}
Amount: ${transactionData.currency} ${transactionData.amount}
${transactionData.items && transactionData.items.length > 0
          ? `Items: ${transactionData.items.map(item => item.name).join(', ')}`
          : ''}

Available categories: ${CATEGORIES.join(', ')}

Return ONLY a JSON array of 3 category names, like: ["Category1", "Category2", "Category3"]`;

      const response = await this.llm.invoke(prompt);
      const content = response.content as string;

      // Parse the response
      let cleanedResponse = content.trim();
      cleanedResponse = cleanedResponse.replace(/```json\s*/g, '');
      cleanedResponse = cleanedResponse.replace(/```\s*/g, '');
      cleanedResponse = cleanedResponse.trim();

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
