import { config, validateConfig } from './core/config';
import { DatabaseClient } from './core/database/database';
import { VisionProcessor } from './features/receipt-processing/vision/vision-processor';
import { TransactionCategorizer } from './features/receipt-processing/categorizer/categorizer';
import { createWorkflowGraph } from './features/receipt-processing/workflow/workflow';
import { WorkflowOrchestrator } from './features/receipt-processing/workflow/workflow-orchestrator';
import { ConsoleAdapter } from './core/messaging/console-adapter';
import { MessagingAdapter } from './core/messaging/messaging-adapter';
import { logger } from './core/utils/logger';
import { MemoryMonitor } from './core/utils/memory-monitor';

/**
 * Console version of Receipt Tracker Agent for testing
 */
class ConsoleReceiptTrackerAgent {
    private database!: DatabaseClient;
    private visionProcessor!: VisionProcessor;
    private categorizer!: TransactionCategorizer;
    private messagingAdapter!: MessagingAdapter;
    private orchestrator!: WorkflowOrchestrator;
    private workflowGraph!: ReturnType<typeof createWorkflowGraph>;
    private config!: any;
    private memoryMonitor!: MemoryMonitor;

    async initialize(): Promise<void> {
        try {
            logger.info('🚀 Initializing Console Receipt Tracker Agent...');

            // Load and validate configuration
            validateConfig();
            this.config = config;

            // Initialize core components
            this.database = new DatabaseClient(config.database.url, config.database.key);

            this.visionProcessor = new VisionProcessor({
                apiKey: config.openai.apiKey,
                apiBase: config.openai.apiBase,
                model: config.openai.visionModel,
                maxRetries: config.workflow.maxRetries,
                retryDelay: config.workflow.retryDelay,
            });

            this.categorizer = new TransactionCategorizer(
                {
                    apiKey: config.openai.apiKey,
                    apiBase: config.openai.apiBase,
                    model: config.openai.categorizerModel,
                    confidenceThreshold: config.workflow.confidenceThreshold,
                },
                this.database
            );

            this.workflowGraph = createWorkflowGraph({
                visionProcessor: this.visionProcessor,
                categorizer: this.categorizer,
                database: this.database,
                confidenceThreshold: config.workflow.confidenceThreshold,
                maxRetries: config.workflow.maxRetries,
                retryDelay: config.workflow.retryDelay,
            });

            this.orchestrator = new WorkflowOrchestrator(
                this.workflowGraph,
                this.database,
                this.categorizer,
                this.config
            );

            // Initialize ConsoleAdapter instead of TelegramAdapter
            logger.info('🖥️  Initializing Console adapter...');
            this.messagingAdapter = new ConsoleAdapter({
                callbacks: {
                    onImageReceived: this.orchestrator.handleImageReceived.bind(this.orchestrator),
                    onTextReceived: this.orchestrator.handleTextReceived.bind(this.orchestrator),
                    onOptionSelected: this.orchestrator.handleOptionSelected.bind(this.orchestrator),
                },
                userId: 'console-user'
            });

            this.orchestrator.setAdapter(this.messagingAdapter);

            this.memoryMonitor = new MemoryMonitor(30000);

            logger.info('✨ Console Receipt Tracker Agent initialized successfully!');
        } catch (error) {
            logger.error('❌ Initialization error', error);
            throw error;
        }
    }

    async start(): Promise<void> {
        try {
            logger.info('🚀 Starting Console Receipt Tracker Agent...');

            this.memoryMonitor.start();
            await this.messagingAdapter.start();

            logger.info('✅ Console Receipt Tracker Agent is running!');
            logger.info('💡 Commands: image <path>, text <message>, exit');
        } catch (error) {
            logger.error('❌ Failed to start console app', error);
            throw error;
        }
    }

    async stop(signal?: string): Promise<void> {
        logger.info(`\n🛑 Shutting down Console Receipt Tracker Agent... (${signal || 'manual'})`);

        try {
            this.memoryMonitor.stop();
            await this.messagingAdapter.stop(signal);
            logger.info('✅ Console Receipt Tracker Agent stopped successfully');
        } catch (error) {
            logger.error('❌ Error during shutdown', error);
            throw error;
        }
    }
}

async function main(): Promise<void> {
    const agent = new ConsoleReceiptTrackerAgent();

    try {
        await agent.initialize();

        // Graceful shutdown
        process.once('SIGINT', async () => {
            await agent.stop('SIGINT');
            process.exit(0);
        });

        await agent.start();
    } catch (error) {
        logger.error('❌ Fatal error', error as Error);
        process.exit(1);
    }
}

if (require.main === module) {
    main().catch((error) => {
        logger.error('❌ Application failed to start', error as Error);
        process.exit(1);
    });
}

export { ConsoleReceiptTrackerAgent };