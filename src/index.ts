import { config, validateConfig } from './core/config';
import { DatabaseClient } from './core/database/database';
import { VisionProcessor } from './features/receipt-processing/vision/vision-processor';
import { TransactionCategorizer } from './features/receipt-processing/categorizer/categorizer';
import { TelegramBotHandler } from './features/telegram-bot/telegram-bot';
import { WorkflowState } from './features/receipt-processing/workflow/types';
import { createWorkflowGraph } from './features/receipt-processing/workflow/graph';
import { logger } from './core/utils/logger';

/**
 * Main application class that orchestrates all components
 */
class ReceiptTrackerAgent {
  private database!: DatabaseClient;
  private visionProcessor!: VisionProcessor;
  private categorizer!: TransactionCategorizer;
  private telegramBot!: TelegramBotHandler;
  private workflowGraph!: ReturnType<typeof createWorkflowGraph>;

  /**
   * Initialize the Receipt Tracker Agent
   * Loads configuration and initializes all components
   */
  async initialize(): Promise<void> {
    try {
      logger.info('🚀 Initializing Receipt Tracker Agent...');

      // Load and validate configuration
      logger.info('📋 Loading configuration...');
      validateConfig();
      logger.info('✅ Configuration loaded successfully', {
        confidenceThreshold: config.workflow.confidenceThreshold,
      });

      // Initialize DatabaseClient
      logger.info('🗄️  Initializing database client...');
      this.database = new DatabaseClient(
        config.database.url,
        config.database.key
      );
      logger.info('✅ Database client initialized');

      // Initialize VisionProcessor
      logger.info('👁️  Initializing vision processor...');
      this.visionProcessor = new VisionProcessor({
        apiKey: config.openai.apiKey,
        apiBase: config.openai.apiBase,
        model: config.openai.visionModel,
        maxRetries: config.workflow.maxRetries,
        retryDelay: config.workflow.retryDelay,
      });
      logger.info('✅ Vision processor initialized', {
        model: config.openai.visionModel,
      });

      // Initialize TransactionCategorizer
      logger.info('🏷️  Initializing transaction categorizer...');
      this.categorizer = new TransactionCategorizer(
        {
          apiKey: config.openai.apiKey,
          apiBase: config.openai.apiBase,
          model: config.openai.categorizerModel,
          confidenceThreshold: config.workflow.confidenceThreshold,
        },
        this.database
      );
      logger.info('✅ Transaction categorizer initialized', {
        model: config.openai.categorizerModel,
      });

      // Initialize LangGraph workflow
      logger.info('🔄 Initializing workflow graph...');
      this.workflowGraph = createWorkflowGraph({
        visionProcessor: this.visionProcessor,
        categorizer: this.categorizer,
        database: this.database,
        confidenceThreshold: config.workflow.confidenceThreshold,
        maxRetries: config.workflow.maxRetries,
        retryDelay: config.workflow.retryDelay,
      });
      logger.info('✅ Workflow graph initialized');

      // Initialize TelegramBotHandler
      logger.info('🤖 Initializing Telegram bot...');
      this.telegramBot = new TelegramBotHandler({
        botToken: config.telegram.botToken,
        database: this.database,
        onPhotoReceived: this.handlePhotoReceived.bind(this),
        onCategorySelected: this.handleCategorySelected.bind(this),
      });
      logger.info('✅ Telegram bot initialized');

      logger.info('✨ Receipt Tracker Agent initialized successfully!');
    } catch (error) {
      logger.error('❌ Initialization error', error);
      console.error('\n💡 Please check your .env file and ensure all required variables are set.');
      console.error('   See .env.example for reference.');
      throw error;
    }
  }

  /**
   * Handle photo received from Telegram bot
   * Executes the workflow graph to process the receipt
   * @param state - Initial workflow state with image data
   */
  private async handlePhotoReceived(state: WorkflowState): Promise<void> {
    const operationId = `photo_${state.telegramUserId}_${Date.now()}`;

    try {
      // Log image received
      if (state.imageData) {
        logger.logImageReceived(state.telegramUserId, state.imageData.length);
      }

      // Start performance tracking
      logger.startPerformanceTracking(operationId, 'process_photo', {
        userId: state.telegramUserId,
      });

      logger.info(`📸 Processing photo for user ${state.telegramUserId}...`);

      // Execute the workflow graph
      logger.debug('Invoking workflow graph', {
        userId: state.telegramUserId,
        hasImageData: !!state.imageData,
        imageSize: state.imageData?.length,
      });

      const result = await this.workflowGraph.invoke(state);

      logger.info('📊 Workflow execution completed', {
        userId: state.telegramUserId,
        hasError: !!result.error,
        errorType: result.errorType,
        extractionValid: result.extractionValid,
        needsClarification: result.needsClarification,
        hasExtractedData: !!result.extractedData,
        hasCategory: !!result.category,
        hasTransactionId: !!result.transactionId,
        extractedData: result.extractedData ? {
          merchant: result.extractedData.merchantName,
          amount: result.extractedData.amount,
          currency: result.extractedData.currency,
          confidence: result.extractedData.confidence,
        } : null,
      });

      // Handle workflow result
      if (result.error) {
        logger.error(`❌ Workflow error for user ${state.telegramUserId}`, undefined, {
          errorType: result.errorType,
          errorMessage: result.error,
          userId: state.telegramUserId,
          // Log full workflow state for debugging
          fullWorkflowResult: {
            error: result.error,
            errorType: result.errorType,
            extractionValid: result.extractionValid,
            needsClarification: result.needsClarification,
            hasExtractedData: !!result.extractedData,
            extractedData: result.extractedData,
            hasCategory: !!result.category,
            category: result.category,
            confidence: result.confidence,
            hasTransactionId: !!result.transactionId,
            transactionId: result.transactionId,
            awaitingUserInput: result.awaitingUserInput,
          },
        });

        // End performance tracking with failure
        logger.endPerformanceTracking(operationId, false, result.error);

        // Send error message to user
        await this.telegramBot.sendErrorMessage(
          state.chatId,
          result.error,
          result.errorType
        );
        return;
      }

      // Log extraction results
      if (result.extractedData) {
        logger.logExtractionComplete(
          state.telegramUserId,
          true,
          result.extractedData.confidence,
          result.extractedData.merchantName
        );
      }

      // Check if clarification is needed
      if (result.needsClarification && result.extractedData) {
        logger.info(`🤔 Requesting clarification for user ${state.telegramUserId}...`, {
          category: result.category,
          confidence: result.confidence,
        });

        // Log categorization
        if (result.category && result.confidence !== undefined) {
          logger.logCategorization(
            state.telegramUserId,
            result.category,
            result.confidence,
            true
          );
        }

        // Send category options to user
        await this.telegramBot.sendCategoryOptions(
          state.chatId,
          result.extractedData,
          result.suggestedCategories,
          result.transactionId
        );

        // End performance tracking
        logger.endPerformanceTracking(operationId, true, undefined, {
          needsClarification: true,
        });
        return;
      }

      // Send confirmation if transaction was stored successfully
      if (result.transactionId && result.extractedData && result.category) {
        // Log categorization
        if (result.confidence !== undefined) {
          logger.logCategorization(
            state.telegramUserId,
            result.category,
            result.confidence,
            false
          );
        }

        // Log storage
        logger.logStorage(
          state.telegramUserId,
          result.transactionId,
          result.extractedData.amount,
          result.category
        );

        logger.info(`✅ Transaction stored for user ${state.telegramUserId}: ${result.transactionId}`);

        await this.telegramBot.sendConfirmation(
          state.chatId,
          result.extractedData,
          result.category,
          result.transactionId
        );

        // End performance tracking with success
        logger.endPerformanceTracking(operationId, true, undefined, {
          transactionId: result.transactionId,
        });
      }
    } catch (error) {
      logger.error('❌ Error handling photo', error, {
        userId: state.telegramUserId,
      });

      // End performance tracking with failure
      logger.endPerformanceTracking(operationId, false, (error as Error).message);

      // Send generic error message to user
      await this.telegramBot.sendErrorMessage(
        state.chatId,
        'An unexpected error occurred while processing your photo.',
        'unknown'
      );
    }
  }

  /**
   * Handle category selected by user
   * Updates the transaction and sends confirmation
   * @param userId - The user ID
   * @param transactionId - The transaction ID to update
   * @param category - The selected category
   */
  private async handleCategorySelected(
    userId: string,
    transactionId: string,
    category: string
  ): Promise<void> {
    try {
      logger.logUserInteraction(userId, 'category_selected', {
        transactionId,
        category,
      });

      logger.info(`📁 User ${userId} selected category "${category}" for transaction ${transactionId}`);

      // Update the transaction category and learn from correction
      await this.categorizer.learnFromCorrection(transactionId, category);

      // Fetch the updated transaction to send confirmation
      const transactions = await this.database.getUserTransactions(userId, 1);

      if (transactions.length > 0 && transactions[0].id === transactionId) {
        // Category updated successfully
        logger.info(`✅ Category updated successfully for transaction ${transactionId}`);
      }
    } catch (error) {
      logger.error('❌ Error handling category selection', error, {
        userId,
        transactionId,
        category,
      });
    }
  }

  /**
   * Start the application
   * Launches the Telegram bot and begins processing messages
   */
  async start(): Promise<void> {
    try {
      logger.info('🚀 Starting Receipt Tracker Agent...');

      // Launch the Telegram bot
      await this.telegramBot.launch();

      logger.info('✅ Receipt Tracker Agent is running!');
      logger.info('📱 Send receipts to your Telegram bot to start tracking expenses.');
      logger.info('');
      logger.info('Press Ctrl+C to stop the bot.');
    } catch (error) {
      logger.error('❌ Failed to start bot', error);
      throw error;
    }
  }

  /**
   * Stop the application gracefully
   * @param signal - The signal that triggered the stop
   */
  async stop(signal?: string): Promise<void> {
    logger.info(`\n🛑 Shutting down Receipt Tracker Agent... (${signal || 'manual'})`);

    try {
      // Stop the Telegram bot
      await this.telegramBot.stop(signal);

      logger.info('✅ Receipt Tracker Agent stopped successfully');
    } catch (error) {
      logger.error('❌ Error during shutdown', error);
      throw error;
    }
  }
}

/**
 * Main entry point
 * Initializes and starts the Receipt Tracker Agent
 */
async function main(): Promise<void> {
  const agent = new ReceiptTrackerAgent();

  try {
    // Initialize all components
    await agent.initialize();

    // Set up graceful shutdown handlers
    process.once('SIGINT', async () => {
      await agent.stop('SIGINT');
      process.exit(0);
    });

    process.once('SIGTERM', async () => {
      await agent.stop('SIGTERM');
      process.exit(0);
    });

    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
      logger.error('❌ Uncaught exception', error);
      agent.stop('uncaughtException').then(() => {
        process.exit(1);
      });
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('❌ Unhandled rejection', reason as Error, {
        promise: String(promise),
      });
      agent.stop('unhandledRejection').then(() => {
        process.exit(1);
      });
    });

    // Start the application
    await agent.start();
  } catch (error) {
    logger.error('❌ Fatal error', error as Error);
    process.exit(1);
  }
}

// Run the application if this file is executed directly
if (require.main === module) {
  main().catch((error) => {
    logger.error('❌ Application failed to start', error as Error);
    process.exit(1);
  });
}

// Export for testing
export { ReceiptTrackerAgent, main };
