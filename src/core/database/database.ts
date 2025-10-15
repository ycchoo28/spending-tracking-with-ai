import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';

/**
 * Transaction interface representing a stored transaction
 */
export interface Transaction {
  id: string;
  user_id: string;
  telegram_user_id: string;
  amount: number;
  currency: string;
  merchant_name: string;
  category: string;
  date_time: string;
  payment_method?: string;
  transaction_reference?: string;
  image_url?: string;
  raw_extracted_data?: any;
  confidence_score?: number;
  user_corrected: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Input data for creating a new transaction
 */
export interface TransactionInput {
  user_id: string;
  telegram_user_id: string;
  amount: number;
  currency: string;
  merchant_name: string;
  category: string;
  date_time: string;
  payment_method?: string;
  transaction_reference?: string;
  image_url?: string;
  raw_extracted_data?: any;
  confidence_score?: number;
  user_corrected?: boolean;
}

/**
 * Spending statistics for a user
 */
export interface SpendingStats {
  total_amount: number;
  transaction_count: number;
  by_category: Array<{
    category: string;
    amount: number;
    count: number;
    percentage: number;
  }>;
  period: {
    start: string;
    end: string;
  };
}

/**
 * Database error class for handling database-specific errors
 */
export class DatabaseError extends Error {
  constructor(message: string, public originalError?: any) {
    super(message);
    this.name = 'DatabaseError';
  }
}

/**
 * DatabaseClient class for managing Supabase database operations
 * Handles all CRUD operations for transactions, user preferences, and category learning
 */
export class DatabaseClient {
  private client: SupabaseClient;

  /**
   * Initialize the DatabaseClient with Supabase credentials
   * @param supabaseUrl - The Supabase project URL
   * @param supabaseKey - The Supabase API key
   */
  constructor(supabaseUrl: string, supabaseKey: string) {
    if (!supabaseUrl || !supabaseKey) {
      throw new DatabaseError('Supabase URL and key are required');
    }

    this.client = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Store a new transaction in the database
   * @param transaction - The transaction data to store
   * @returns The ID of the stored transaction
   * @throws DatabaseError if the operation fails
   */
  async storeTransaction(transaction: TransactionInput): Promise<string> {
    const operationId = `db_store_${transaction.telegram_user_id}_${Date.now()}`;
    logger.startPerformanceTracking(operationId, 'store_transaction', {
      merchant: transaction.merchant_name,
      amount: `${transaction.currency} ${transaction.amount}`,
      category: transaction.category,
    });

    try {
      logger.debug('Storing transaction in database', {
        userId: transaction.telegram_user_id,
        merchant: transaction.merchant_name,
        amount: transaction.amount,
        category: transaction.category,
      });

      const startTime = Date.now();
      const { data, error } = await this.client
        .from('transactions')
        .insert({
          user_id: transaction.user_id,
          telegram_user_id: transaction.telegram_user_id,
          amount: transaction.amount,
          currency: transaction.currency,
          merchant_name: transaction.merchant_name,
          category: transaction.category,
          date_time: transaction.date_time,
          payment_method: transaction.payment_method,
          transaction_reference: transaction.transaction_reference,
          image_url: transaction.image_url,
          raw_extracted_data: transaction.raw_extracted_data,
          confidence_score: transaction.confidence_score,
          user_corrected: transaction.user_corrected || false,
        })
        .select('id')
        .single();

      const duration = Date.now() - startTime;
      logger.logApiCall('database', 'insert_transaction', duration, !error);

      if (error) {
        logger.error('Failed to store transaction', error, {
          merchant: transaction.merchant_name,
        });
        throw new DatabaseError(
          `Failed to store transaction: ${error.message}`,
          error
        );
      }

      if (!data) {
        throw new DatabaseError('No data returned after storing transaction');
      }

      logger.info('Transaction stored successfully', {
        transactionId: data.id,
        merchant: transaction.merchant_name,
        amount: `${transaction.currency} ${transaction.amount}`,
      });

      logger.endPerformanceTracking(operationId, true, undefined, {
        transactionId: data.id,
      });

      return data.id;
    } catch (error) {
      logger.endPerformanceTracking(operationId, false, (error as Error).message);

      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError(
        'Unexpected error storing transaction',
        error
      );
    }
  }

  /**
   * Get transactions for a specific user with pagination
   * @param userId - The user ID to fetch transactions for
   * @param limit - Maximum number of transactions to return (default: 50)
   * @param offset - Number of transactions to skip (default: 0)
   * @returns Array of transactions
   * @throws DatabaseError if the operation fails
   */
  async getUserTransactions(
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<Transaction[]> {
    try {
      const { data, error } = await this.client
        .from('transactions')
        .select('*')
        .eq('telegram_user_id', userId)
        .order('date_time', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        throw new DatabaseError(
          `Failed to fetch user transactions: ${error.message}`,
          error
        );
      }

      return data || [];
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError(
        'Unexpected error fetching user transactions',
        error
      );
    }
  }

  /**
   * Get similar transactions based on merchant name for learning purposes
   * @param merchantName - The merchant name to search for
   * @param userId - The user ID to scope the search to
   * @param limit - Maximum number of transactions to return (default: 10)
   * @returns Array of similar transactions
   * @throws DatabaseError if the operation fails
   */
  async getSimilarTransactions(
    merchantName: string,
    userId: string,
    limit: number = 10
  ): Promise<Transaction[]> {
    try {
      // Use ilike for case-insensitive partial matching
      const { data, error } = await this.client
        .from('transactions')
        .select('*')
        .eq('telegram_user_id', userId)
        .ilike('merchant_name', `%${merchantName}%`)
        .order('date_time', { ascending: false })
        .limit(limit);

      if (error) {
        throw new DatabaseError(
          `Failed to fetch similar transactions: ${error.message}`,
          error
        );
      }

      return data || [];
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError(
        'Unexpected error fetching similar transactions',
        error
      );
    }
  }

  /**
   * Update the category of an existing transaction
   * @param transactionId - The ID of the transaction to update
   * @param category - The new category
   * @throws DatabaseError if the operation fails
   */
  async updateTransactionCategory(
    transactionId: string,
    category: string
  ): Promise<void> {
    try {
      const { error } = await this.client
        .from('transactions')
        .update({
          category,
          user_corrected: true,
        })
        .eq('id', transactionId);

      if (error) {
        throw new DatabaseError(
          `Failed to update transaction category: ${error.message}`,
          error
        );
      }

      // Also update category learning table
      await this.updateCategoryLearning(transactionId, category);
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError(
        'Unexpected error updating transaction category',
        error
      );
    }
  }

  /**
   * Update category learning data when user corrects a category
   * @param transactionId - The transaction ID
   * @param category - The corrected category
   * @private
   */
  private async updateCategoryLearning(
    transactionId: string,
    category: string
  ): Promise<void> {
    try {
      // First, get the transaction to extract merchant name and user ID
      const { data: transaction, error: fetchError } = await this.client
        .from('transactions')
        .select('merchant_name, telegram_user_id')
        .eq('id', transactionId)
        .single();

      if (fetchError || !transaction) {
        // Don't throw error here, just log it
        console.error('Failed to fetch transaction for learning update:', fetchError);
        return;
      }

      // Upsert into category_learning table
      const { error: upsertError } = await this.client
        .from('category_learning')
        .upsert(
          {
            user_id: transaction.telegram_user_id,
            merchant_name: transaction.merchant_name,
            category,
            frequency: 1,
            last_used: new Date().toISOString(),
          },
          {
            onConflict: 'user_id,merchant_name,category',
          }
        );

      if (upsertError) {
        console.error('Failed to update category learning:', upsertError);
      }
    } catch (error) {
      // Don't throw error, just log it
      console.error('Unexpected error updating category learning:', error);
    }
  }

  /**
   * Get spending statistics for a user over a specified period
   * @param userId - The user ID to get stats for
   * @param period - The period to calculate stats for ('week', 'month', 'year', or 'all')
   * @returns Spending statistics
   * @throws DatabaseError if the operation fails
   */
  async getSpendingStats(
    userId: string,
    period: 'week' | 'month' | 'year' | 'all' = 'month'
  ): Promise<SpendingStats> {
    try {
      // Calculate date range based on period
      const now = new Date();
      let startDate: Date;

      switch (period) {
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'year':
          startDate = new Date(now.getFullYear(), 0, 1);
          break;
        case 'all':
          startDate = new Date(0); // Beginning of time
          break;
      }

      // Build query
      let query = this.client
        .from('transactions')
        .select('amount, category, currency')
        .eq('telegram_user_id', userId);

      if (period !== 'all') {
        query = query.gte('date_time', startDate.toISOString());
      }

      const { data, error } = await query;

      if (error) {
        throw new DatabaseError(
          `Failed to fetch spending stats: ${error.message}`,
          error
        );
      }

      if (!data || data.length === 0) {
        return {
          total_amount: 0,
          transaction_count: 0,
          by_category: [],
          period: {
            start: startDate.toISOString(),
            end: now.toISOString(),
          },
        };
      }

      // Calculate total amount
      const totalAmount = data.reduce((sum, t) => sum + Number(t.amount), 0);

      // Group by category
      const categoryMap = new Map<string, { amount: number; count: number }>();

      data.forEach((transaction) => {
        const category = transaction.category;
        const amount = Number(transaction.amount);

        if (categoryMap.has(category)) {
          const existing = categoryMap.get(category)!;
          existing.amount += amount;
          existing.count += 1;
        } else {
          categoryMap.set(category, { amount, count: 1 });
        }
      });

      // Convert to array and calculate percentages
      const byCategory = Array.from(categoryMap.entries())
        .map(([category, stats]) => ({
          category,
          amount: stats.amount,
          count: stats.count,
          percentage: totalAmount > 0 ? (stats.amount / totalAmount) * 100 : 0,
        }))
        .sort((a, b) => b.amount - a.amount); // Sort by amount descending

      return {
        total_amount: totalAmount,
        transaction_count: data.length,
        by_category: byCategory,
        period: {
          start: startDate.toISOString(),
          end: now.toISOString(),
        },
      };
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError(
        'Unexpected error calculating spending stats',
        error
      );
    }
  }

  /**
   * Get the Supabase client instance (for advanced operations)
   * @returns The Supabase client
   */
  getClient(): SupabaseClient {
    return this.client;
  }
}
