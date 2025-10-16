import { config, validateConfig } from './core/config';
import { DatabaseClient } from './core/database/database';
import { VisionProcessor } from './features/receipt-processing/vision/vision-processor';
import { TransactionCategorizer } from './features/receipt-processing/categorizer/categorizer';
import { createWorkflowGraph } from './features/receipt-processing/workflow';
import { WorkflowOrchestrator } from './features/receipt-processing/workflow/workflow-orchestrator';
import { TelegramAdapter } from './core/messaging/telegram-adapter';
import { MessagingAdapter } from './core/messaging/messaging-adapter';
import { logger } from './core/utils/logger';
import { MemoryMonitor } from './core/utils/memory-monitor';

/**
 * Main application class that orchestrates all components
 */
class ReceiptTrackerAgent {
  private database!: DatabaseClient;
  private visionProcessor!: VisionProcessor;
  private categorizer!: TransactionCategorizer;
  private messagingAdapter!: MessagingAdapter;
  private orchestrator!: WorkflowOrchestrator;
  private workflowGraph!: ReturnType<typeof createWorkflowGraph>;

  private memoryMonitor!: MemoryMonitor;

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

      // Initialize WorkflowOrchestrator
      logger.info('🔄 Initializing workflow orchestrator...');
      this.orchestrator = new WorkflowOrchestrator(
        this.workflowGraph,
        this.database,
        this.categorizer,
        config
      );
      logger.info('✅ Workflow orchestrator initialized');

      // Initialize TelegramAdapter
      logger.info('🤖 Initializing Telegram adapter...');
      this.messagingAdapter = new TelegramAdapter({
        botToken: config.telegram.botToken,
        callbacks: {
          onImageReceived: this.orchestrator.handleImageReceived.bind(this.orchestrator),
          onTextReceived: this.orchestrator.handleTextReceived.bind(this.orchestrator),
          onOptionSelected: this.orchestrator.handleOptionSelected.bind(this.orchestrator),
        }
      });

      // Inject adapter into orchestrator
      this.orchestrator.setAdapter(this.messagingAdapter);
      logger.info('✅ Telegram adapter initialized');

      // Initialize Memory Monitor (check every 30 seconds by default)
      const monitorInterval = config.monitoring?.memoryIntervalMs || 30000;
      this.memoryMonitor = new MemoryMonitor(monitorInterval);

      logger.info('✨ Receipt Tracker Agent initialized successfully!');
    } catch (error) {
      logger.error('❌ Initialization error', error);
      console.error('\n💡 Please check your .env file and ensure all required variables are set.');
      console.error('   See .env.example for reference.');
      throw error;
    }
  }

  /**
   * Start the application
   * Launches the messaging adapter and begins processing messages
   */
  async start(): Promise<void> {
    try {
      logger.info('🚀 Starting Receipt Tracker Agent...');

      // Start memory monitoring
      this.memoryMonitor.start();

      // Start the messaging adapter
      await this.messagingAdapter.start();

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
      // Stop memory monitoring
      this.memoryMonitor.stop();

      // Stop the messaging adapter
      await this.messagingAdapter.stop(signal);

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