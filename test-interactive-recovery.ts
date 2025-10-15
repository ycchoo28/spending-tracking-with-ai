/**
 * Test script for interactive error recovery
 * This script simulates various extraction failures to test the recovery flow
 */

import { config } from 'dotenv';
import { DatabaseClient } from './src/core/database/database';
import { VisionProcessor } from './src/features/receipt-processing/vision/vision-processor';
import { TransactionCategorizer } from './src/features/receipt-processing/categorizer/categorizer';
import { TelegramBotHandler } from './src/features/telegram-bot/telegram-bot';
import { WorkflowState } from './src/features/receipt-processing/workflow/types';
import { createWorkflowGraph } from './src/features/receipt-processing/workflow/graph';
import { logger } from './src/core/utils/logger';
import { validateConfig, config as appConfig } from './src/core/config';

// Load environment variables
config();

/**
 * Mock Vision Processor that returns intentionally bad data
 */
class MockVisionProcessor extends VisionProcessor {
  private testMode: 'unknown_merchant' | 'zero_amount' | 'extraction_failure';

  constructor(config: any, testMode: 'unknown_merchant' | 'zero_amount' | 'extraction_failure') {
    super(config);
    this.testMode = testMode;
  }

  async extractTransactionData(_imageData: Buffer): Promise<any> {
    logger.info(`🧪 Mock extraction running in mode: ${this.testMode}`);

    switch (this.testMode) {
      case 'unknown_merchant':
        // Return data with "Unknown Merchant"
        return {
          amount: 16.00,
          currency: 'MYR',
          merchantName: 'Unknown Merchant',
          dateTime: new Date().toISOString(),
          paymentMethod: 'eWallet Balance',
          transactionReference: 'test-ref-123',
          items: [],
          confidence: 0.95,
        };

      case 'zero_amount':
        // Return data with zero amount
        return {
          amount: 0,
          currency: 'MYR',
          merchantName: 'Test Merchant',
          dateTime: new Date().toISOString(),
          paymentMethod: 'eWallet Balance',
          transactionReference: 'test-ref-456',
          items: [],
          confidence: 0.95,
        };

      case 'extraction_failure':
        // Throw an error to simulate extraction failure
        throw new Error('Failed to extract transaction data from image');

      default:
        throw new Error('Unknown test mode');
    }
  }
}

/**
 * Test Application Class
 */
class TestApp {
  private database!: DatabaseClient;
  private visionProcessor!: VisionProcessor;
  private categorizer!: TransactionCategorizer;
  private telegramBot!: TelegramBotHandler;
  private workflowGraph!: ReturnType<typeof createWorkflowGraph>;
  private config!: any;
  private testMode: 'unknown_merchant' | 'zero_amount' | 'extraction_failure';

  constructor(testMode: 'unknown_merchant' | 'zero_amount' | 'extraction_failure') {
    this.testMode = testMode;
  }

  async initialize(): Promise<void> {
    try {
      logger.info('🧪 Initializing Test App...');
      logger.info(`📋 Test Mode: ${this.testMode}`);

      // Load and validate configuration
      validateConfig();
      this.config = appConfig;

      // Initialize DatabaseClient
      this.database = new DatabaseClient(
        appConfig.database.url,
        appConfig.database.key
      );

      // Initialize MOCK VisionProcessor
      logger.info(`👁️  Initializing MOCK vision processor (mode: ${this.testMode})...`);
      this.visionProcessor = new MockVisionProcessor(
        {
          apiKey: appConfig.openai.apiKey,
          apiBase: appConfig.openai.apiBase,
          model: appConfig.openai.visionModel,
          maxRetries: appConfig.workflow.maxRetries,
          retryDelay: appConfig.workflow.retryDelay,
        },
        this.testMode
      );
      logger.info('✅ MOCK Vision processor initialized');

      // Initialize TransactionCategorizer
      this.categorizer = new TransactionCategorizer(
        {
          apiKey: appConfig.openai.apiKey,
          apiBase: appConfig.openai.apiBase,
          model: appConfig.openai.categorizerModel,
          confidenceThreshold: appConfig.workflow.confidenceThreshold,
        },
        this.database
      );

      // Initialize workflow graph
      this.workflowGraph = createWorkflowGraph({
        visionProcessor: this.visionProcessor,
        categorizer: this.categorizer,
        database: this.database,
        confidenceThreshold: appConfig.workflow.confidenceThreshold,
        maxRetries: appConfig.workflow.maxRetries,
        retryDelay: appConfig.workflow.retryDelay,
      });

      // Initialize TelegramBotHandler
      this.telegramBot = new TelegramBotHandler({
        botToken: appConfig.telegram.botToken,
        database: this.database,
        onPhotoReceived: this.handlePhotoReceived.bind(this),
        onCategorySelected: this.handleCategorySelected.bind(this),
        onUserTextInput: this.handleUserTextInput.bind(this),
      });

      logger.info('✅ Test App initialized successfully!');
      logger.info('');
      logger.info('🧪 TEST MODE ACTIVE');
      logger.info(`📋 Mode: ${this.testMode}`);
      logger.info('');
      logger.info('Expected behavior:');
      switch (this.testMode) {
        case 'unknown_merchant':
          logger.info('  - Bot will extract amount correctly but merchant as "Unknown Merchant"');
          logger.info('  - Bot will ask you to provide the correct merchant name');
          logger.info('  - Reply with the merchant name to continue');
          break;
        case 'zero_amount':
          logger.info('  - Bot will extract merchant correctly but amount as 0');
          logger.info('  - Bot will ask you to provide the correct amount');
          logger.info('  - Reply with the amount (e.g., "16.50") to continue');
          break;
        case 'extraction_failure':
          logger.info('  - Bot will fail to extract any data');
          logger.info('  - Bot will ask you to retry or provide details manually');
          logger.info('  - Reply with merchant name, then amount to continue');
          break;
      }
      logger.info('');
    } catch (error) {
      logger.error('❌ Initialization error', error);
      throw error;
    }
  }

  private async handlePhotoReceived(state: WorkflowState): Promise<void> {
    const operationId = `photo_${state.telegramUserId}_${Date.now()}`;

    try {
      logger.startPerformanceTracking(operationId, 'process_photo', {
        userId: state.telegramUserId,
      });

      logger.info(`📸 Processing photo for user ${state.telegramUserId}...`);

      const result = await this.workflowGraph.invoke(state);

      logger.info('📊 Workflow execution completed', {
        userId: state.telegramUserId,
        hasError: !!result.error,
        errorType: result.errorType,
      });

      // Handle workflow result
      if (result.error) {
        logger.error(`❌ Workflow error for user ${state.telegramUserId}`, undefined, {
          errorType: result.errorType,
          errorMessage: result.error,
          userId: state.telegramUserId,
        });

        logger.endPerformanceTracking(operationId, false, result.error);

        // Interactive error recovery based on error type
        if (result.errorType === 'validation' && result.extractedData) {
          // Check what's invalid
          if (result.extractedData.merchantName === 'Unknown Merchant' || !result.extractedData.merchantName) {
            await this.telegramBot.requestMerchantCorrection(
              state.chatId,
              state,
              result.extractedData
            );
            return;
          } else if (result.extractedData.amount === 0 || !result.extractedData.amount) {
            await this.telegramBot.requestAmountCorrection(
              state.chatId,
              state,
              result.extractedData
            );
            return;
          }
        } else if (result.errorType === 'extraction') {
          // Extraction failed, ask user for guidance
          await this.telegramBot.requestRetryWithGuidance(
            state.chatId,
            state,
            result.error
          );
          return;
        }

        // For other errors, send standard error message
        await this.telegramBot.sendErrorMessage(
          state.chatId,
          result.error,
          result.errorType
        );
        return;
      }

      // Success path (same as main app)
      if (result.needsClarification && result.extractedData) {
        await this.telegramBot.sendCategoryOptions(
          state.chatId,
          result.extractedData,
          result.suggestedCategories
        );
      } else if (result.transactionId && result.extractedData && result.category) {
        await this.telegramBot.sendConfirmation(
          state.chatId,
          result.extractedData,
          result.category,
          result.transactionId
        );
      }

      logger.endPerformanceTracking(operationId, true);
    } catch (error) {
      logger.error('❌ Error handling photo', error, {
        userId: state.telegramUserId,
      });

      logger.endPerformanceTracking(operationId, false, (error as Error).message);

      await this.telegramBot.sendErrorMessage(
        state.chatId,
        'An unexpected error occurred while processing your photo.',
        'unknown'
      );
    }
  }

  private async handleCategorySelected(
    userId: string,
    transactionId: string,
    category: string
  ): Promise<void> {
    // Same as main app
    logger.info('Category selected by user', {
      userId,
      transactionId,
      category,
    });
  }

  private async handleUserTextInput(
    userId: string,
    chatId: number,
    text: string,
    pendingWorkflow: any
  ): Promise<void> {
    try {
      logger.info('Processing user text input', {
        userId,
        workflowType: pendingWorkflow.type,
        textPreview: text.substring(0, 50),
      });

      switch (pendingWorkflow.type) {
        case 'merchant_correction':
          await this.handleMerchantCorrection(userId, chatId, text, pendingWorkflow);
          break;

        case 'amount_correction':
          await this.handleAmountCorrection(userId, chatId, text, pendingWorkflow);
          break;

        case 'retry_extraction':
          await this.handleRetryExtraction(userId, chatId, text, pendingWorkflow);
          break;

        default:
          await this.telegramBot.sendSimpleError(chatId, 'Unknown workflow type. Please send a new receipt.');
          this.telegramBot.getWorkflowStateManager().clearPending(userId);
      }
    } catch (error) {
      logger.error('Error handling user text input', error as Error, { userId });
      await this.telegramBot.sendSimpleError(chatId, 'Failed to process your input. Please try again.');
    }
  }

  private async handleMerchantCorrection(
    userId: string,
    chatId: number,
    merchantName: string,
    pendingWorkflow: any
  ): Promise<void> {
    try {
      if (!pendingWorkflow.extractedData) {
        throw new Error('No extracted data in pending workflow');
      }

      pendingWorkflow.extractedData.merchantName = merchantName.trim();

      await this.telegramBot.sendSimpleError(chatId, `✅ Merchant updated to: ${merchantName}\n\n🔄 Categorizing transaction...`);

      this.telegramBot.getWorkflowStateManager().clearPending(userId);

      const categorizationResult = await this.categorizer.categorize(
        pendingWorkflow.extractedData,
        userId
      );

      logger.info('Transaction categorized after merchant correction', {
        userId,
        category: categorizationResult.category,
        confidence: categorizationResult.confidence,
        reasoning: categorizationResult.reasoning,
      });

      if (categorizationResult.confidence < this.config.workflow.confidenceThreshold) {
        await this.telegramBot.sendCategoryOptions(
          chatId,
          pendingWorkflow.extractedData,
          categorizationResult.suggestedCategories
        );
      } else {
        const transactionId = await this.database.storeTransaction({
          user_id: userId,
          telegram_user_id: userId,
          amount: pendingWorkflow.extractedData.amount,
          currency: pendingWorkflow.extractedData.currency,
          merchant_name: pendingWorkflow.extractedData.merchantName,
          category: categorizationResult.category,
          date_time: pendingWorkflow.extractedData.dateTime,
          payment_method: pendingWorkflow.extractedData.paymentMethod,
          transaction_reference: pendingWorkflow.extractedData.transactionReference,
          confidence_score: categorizationResult.confidence,
        });

        await this.telegramBot.sendConfirmation(
          chatId,
          pendingWorkflow.extractedData,
          categorizationResult.category,
          transactionId
        );
      }
    } catch (error) {
      logger.error('Error handling merchant correction', error as Error, { userId });
      await this.telegramBot.sendSimpleError(chatId, 'Failed to process merchant correction. Please try again.');
    }
  }

  private async handleAmountCorrection(
    userId: string,
    chatId: number,
    amountText: string,
    pendingWorkflow: any
  ): Promise<void> {
    try {
      if (!pendingWorkflow.extractedData) {
        throw new Error('No extracted data in pending workflow');
      }

      const amount = parseFloat(amountText.replace(/[^0-9.]/g, ''));

      if (isNaN(amount) || amount <= 0) {
        await this.telegramBot.sendSimpleError(
          chatId,
          '❌ Invalid amount. Please enter a valid number (e.g., "16.50").'
        );
        return;
      }

      pendingWorkflow.extractedData.amount = amount;

      await this.telegramBot.sendSimpleError(chatId, `✅ Amount updated to: ${pendingWorkflow.extractedData.currency} ${amount.toFixed(2)}\n\n🔄 Categorizing transaction...`);

      this.telegramBot.getWorkflowStateManager().clearPending(userId);

      const categorizationResult = await this.categorizer.categorize(
        pendingWorkflow.extractedData,
        userId
      );

      if (categorizationResult.confidence < this.config.workflow.confidenceThreshold) {
        await this.telegramBot.sendCategoryOptions(
          chatId,
          pendingWorkflow.extractedData,
          categorizationResult.suggestedCategories
        );
      } else {
        const transactionId = await this.database.storeTransaction({
          user_id: userId,
          telegram_user_id: userId,
          amount: pendingWorkflow.extractedData.amount,
          currency: pendingWorkflow.extractedData.currency,
          merchant_name: pendingWorkflow.extractedData.merchantName,
          category: categorizationResult.category,
          date_time: pendingWorkflow.extractedData.dateTime,
          payment_method: pendingWorkflow.extractedData.paymentMethod,
          transaction_reference: pendingWorkflow.extractedData.transactionReference,
          confidence_score: categorizationResult.confidence,
        });

        await this.telegramBot.sendConfirmation(
          chatId,
          pendingWorkflow.extractedData,
          categorizationResult.category,
          transactionId
        );
      }
    } catch (error) {
      logger.error('Error handling amount correction', error as Error, { userId });
      await this.telegramBot.sendSimpleError(chatId, 'Failed to process amount correction. Please try again.');
    }
  }

  private async handleRetryExtraction(
    userId: string,
    chatId: number,
    text: string,
    pendingWorkflow: any
  ): Promise<void> {
    try {
      await this.telegramBot.sendSimpleError(chatId, `✅ Got it! Merchant: ${text}\n\n📝 Now please reply with the amount (e.g., "16.50")`);

      pendingWorkflow.type = 'amount_correction';
      pendingWorkflow.extractedData = {
        merchantName: text.trim(),
        amount: 0,
        currency: 'MYR',
        dateTime: new Date().toISOString(),
        paymentMethod: 'Unknown',
        confidence: 0.5,
      };
      pendingWorkflow.timestamp = Date.now();

      this.telegramBot.getWorkflowStateManager().setPending(userId, pendingWorkflow);
    } catch (error) {
      logger.error('Error handling retry extraction', error as Error, { userId });
      await this.telegramBot.sendSimpleError(chatId, 'Failed to process your input. Please try again.');
    }
  }

  async start(): Promise<void> {
    try {
      logger.info('🚀 Starting Test App...');
      await this.telegramBot.launch();
      logger.info('✅ Test App is running!');
      logger.info('📱 Send a photo to your Telegram bot to test the error recovery flow.');
      logger.info('');
      logger.info('Press Ctrl+C to stop the bot.');
    } catch (error) {
      logger.error('Failed to start test app', error);
      throw error;
    }
  }

  async stop(signal?: string): Promise<void> {
    logger.info(`🛑 Stopping Test App... (${signal || 'manual'})`);

    try {
      await this.telegramBot.stop(signal);
      logger.info('✅ Test App stopped successfully');
      process.exit(0);
    } catch (error) {
      logger.error('Error stopping test app', error);
      process.exit(1);
    }
  }
}

// Main execution
async function main() {
  // Get test mode from command line argument
  const testMode = process.argv[2] as 'unknown_merchant' | 'zero_amount' | 'extraction_failure';

  if (!testMode || !['unknown_merchant', 'zero_amount', 'extraction_failure'].includes(testMode)) {
    console.error('❌ Invalid test mode. Usage:');
    console.error('');
    console.error('  npm run test:recovery unknown_merchant   - Test merchant name correction');
    console.error('  npm run test:recovery zero_amount        - Test amount correction');
    console.error('  npm run test:recovery extraction_failure - Test full manual entry');
    console.error('');
    process.exit(1);
  }

  const app = new TestApp(testMode);

  // Handle graceful shutdown
  process.on('SIGINT', () => app.stop('SIGINT'));
  process.on('SIGTERM', () => app.stop('SIGTERM'));

  try {
    await app.initialize();
    await app.start();
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main();
