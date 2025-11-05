import { config, validateConfig } from "./core/config";
import { DatabaseClient } from "./core/database/database";
import { VisionProcessor } from "./features/receipt-processing/vision/vision-processor";
import { TransactionCategorizer } from "./features/receipt-processing/categorizer/categorizer";
import { TelegramAdapter } from "./core/messaging/telegram-adapter";
import { MessagingAdapter } from "./core/messaging/messaging-adapter";
import { logger } from "./core/utils/logger";
import { MemoryMonitor } from "./core/utils/memory-monitor";
import { ChatOpenAI } from "@langchain/openai";

// v2: Agent Loop imports
import { createMainAgent } from "./features/receipt-processing/main-agent/main-agent";
import { createTransactionAgent } from "./features/receipt-processing/transaction-agent/transaction-agent";
import { ConversationOrchestrator } from "./features/receipt-processing/orchestrator";
import { ConversationManager } from "./core/conversation/conversation-manager";
import { getCheckpointer } from "./core/checkpointing";

/**
 * Main application class that orchestrates all components
 */
class ReceiptTrackerAgent {
  private database!: DatabaseClient;
  private visionProcessor!: VisionProcessor;
  private categorizer!: TransactionCategorizer;
  private messagingAdapter!: MessagingAdapter;

  // v2: Agent Loop components
  private conversationOrchestrator!: ConversationOrchestrator;
  private conversationManager!: ConversationManager;
  private mainAgent!: any;
  private transactionAgent!: any;
  private llm!: ChatOpenAI;

  private memoryMonitor?: MemoryMonitor;

  /**
   * Initialize the Receipt Tracker Agent
   * Loads configuration and initializes all components
   */
  async initialize(): Promise<void> {
    try {
      logger.info("🚀 Initializing Receipt Tracker Agent...");

      // Load and validate configuration
      logger.info("📋 Loading configuration...");
      validateConfig();
      logger.info("✅ Configuration loaded successfully", {
        confidenceThreshold: config.workflow.confidenceThreshold,
      });

      // Initialize DatabaseClient
      logger.info("🗄️  Initializing database client...");
      this.database = new DatabaseClient(
        config.database.url,
        config.database.key
      );
      logger.info("✅ Database client initialized");

      // Initialize VisionProcessor
      logger.info("👁️  Initializing vision processor...");
      this.visionProcessor = new VisionProcessor({
        apiKey: config.openai.apiKey,
        apiBase: config.openai.apiBase,
        model: config.openai.visionModel,
        maxRetries: config.workflow.maxRetries,
        retryDelay: config.workflow.retryDelay,
      });
      logger.info("✅ Vision processor initialized", {
        model: config.openai.visionModel,
      });

      // Initialize TransactionCategorizer
      logger.info("🏷️  Initializing transaction categorizer...");
      this.categorizer = new TransactionCategorizer(
        {
          apiKey: config.openai.apiKey,
          apiBase: config.openai.apiBase,
          model: config.openai.categorizerModel,
          confidenceThreshold: config.workflow.confidenceThreshold,
        },
        this.database
      );
      logger.info("✅ Transaction categorizer initialized", {
        model: config.openai.categorizerModel,
      });

      // v2: Initialize LLM
      logger.info("🤖 Initializing LLM...");
      this.llm = new ChatOpenAI({
        modelName: config.agentLoop.llmModel,
        temperature: config.agentLoop.llmTemperature,
        maxTokens: config.agentLoop.llmMaxTokens,
        openAIApiKey: config.openai.apiKey,
        configuration: {
          baseURL: config.openai.apiBase,
        },
      });
      logger.info("✅ LLM initialized", {
        model: config.agentLoop.llmModel,
        baseURL: config.openai.apiBase,
      });

      // v2: Initialize PostgreSQL checkpointer
      logger.info("💾 Initializing checkpointer...");
      const checkpointer = await getCheckpointer();
      logger.info("✅ Checkpointer initialized");

      // v2: Initialize Transaction Sub-Agent
      logger.info("🔄 Initializing transaction sub-agent...");
      this.transactionAgent = createTransactionAgent({
        llm: this.llm,
        visionProcessor: this.visionProcessor,
        categorizer: this.categorizer,
        database: this.database,
        confidenceThreshold: config.workflow.confidenceThreshold,
      });
      logger.info("✅ Transaction sub-agent initialized");

      // v2: Initialize Main Conversation Agent
      logger.info("🔄 Initializing main conversation agent...");
      this.mainAgent = createMainAgent({
        llm: this.llm,
        transactionAgent: this.transactionAgent,
        checkpointer,
      });
      logger.info("✅ Main conversation agent initialized");

      // v2: Initialize Conversation Manager
      logger.info("💬 Initializing conversation manager...");
      this.conversationManager = new ConversationManager(24); // 24 hour expiration
      this.conversationManager.startCleanupJob(6); // Cleanup every 6 hours
      logger.info("✅ Conversation manager initialized");

      // v2: Initialize Conversation Orchestrator
      logger.info("🎭 Initializing conversation orchestrator...");
      this.conversationOrchestrator = new ConversationOrchestrator(
        this.mainAgent,
        this.conversationManager
      );
      logger.info("✅ Conversation orchestrator initialized");

      // v2: Initialize TelegramAdapter with new callback
      logger.info("🤖 Initializing Telegram adapter...");
      this.messagingAdapter = new TelegramAdapter({
        botToken: config.telegram.botToken,
        callbacks: {
          // v2: Use onMessage callback for multi-turn conversations
          onMessage: async (context, message, imageData) => {
            const chatId =
              context.metadata?.chatId || parseInt(context.sessionId);
            return await this.conversationOrchestrator.handleMessage(
              context.userId,
              chatId,
              {
                content: message,
                imageData,
              }
            );
          },
          // Keep legacy callbacks for backward compatibility
          onImageReceived: async () => {},
          onTextReceived: async () => {},
          onOptionSelected: async () => {},
        },
      });
      logger.info("✅ Telegram adapter initialized");

      // Initialize Memory Monitor (check every 30 seconds by default, 0 to disable)
      const monitorInterval = config.monitoring?.memoryIntervalMs || 30000;
      if (monitorInterval > 0) {
        this.memoryMonitor = new MemoryMonitor(monitorInterval);
      }

      logger.info("✨ Receipt Tracker Agent initialized successfully!");
    } catch (error) {
      logger.error("❌ Initialization error", error);
      console.error(
        "\n💡 Please check your .env file and ensure all required variables are set."
      );
      console.error("   See .env.example for reference.");
      throw error;
    }
  }

  /**
   * Start the application
   * Launches the messaging adapter and begins processing messages
   */
  async start(): Promise<void> {
    try {
      logger.info("🚀 Starting Receipt Tracker Agent...");

      // Start memory monitoring (if enabled)
      if (this.memoryMonitor) {
        this.memoryMonitor.start();
      }

      // Start the messaging adapter
      await this.messagingAdapter.start();

      logger.info("✅ Receipt Tracker Agent is running!");
      logger.info(
        "📱 Send receipts to your Telegram bot to start tracking expenses."
      );
      logger.info("");
      logger.info("Press Ctrl+C to stop the bot.");
    } catch (error) {
      logger.error("❌ Failed to start bot", error);
      throw error;
    }
  }

  /**
   * Stop the application gracefully
   * @param signal - The signal that triggered the stop
   */
  async stop(signal?: string): Promise<void> {
    logger.info(
      `\n🛑 Shutting down Receipt Tracker Agent... (${signal || "manual"})`
    );

    try {
      // Stop memory monitoring (if enabled)
      if (this.memoryMonitor) {
        this.memoryMonitor.stop();
      }

      // v2: Stop conversation manager cleanup job
      if (this.conversationManager) {
        this.conversationManager.stopCleanupJob();
      }

      // Stop the messaging adapter
      await this.messagingAdapter.stop(signal);

      logger.info("✅ Receipt Tracker Agent stopped successfully");
    } catch (error) {
      logger.error("❌ Error during shutdown", error);
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
    process.once("SIGINT", async () => {
      await agent.stop("SIGINT");
      process.exit(0);
    });

    process.once("SIGTERM", async () => {
      await agent.stop("SIGTERM");
      process.exit(0);
    });

    // Handle uncaught errors
    process.on("uncaughtException", (error) => {
      logger.error("❌ Uncaught exception", error);
      agent.stop("uncaughtException").then(() => {
        process.exit(1);
      });
    });

    process.on("unhandledRejection", (reason, promise) => {
      logger.error("❌ Unhandled rejection", reason as Error, {
        promise: String(promise),
      });
      agent.stop("unhandledRejection").then(() => {
        process.exit(1);
      });
    });

    // Start the application
    await agent.start();
  } catch (error) {
    logger.error("❌ Fatal error", error as Error);
    process.exit(1);
  }
}

// Run the application if this file is executed directly
if (require.main === module) {
  main().catch((error) => {
    logger.error("❌ Application failed to start", error as Error);
    process.exit(1);
  });
}

// Export for testing
export { ReceiptTrackerAgent, main };
