import { Telegraf, Context } from 'telegraf';
import { Markup } from 'telegraf';
import { DatabaseClient, SpendingStats } from '../../core/database/database';
import { WorkflowState } from '../receipt-processing/workflow/types';
import { ExtractedTransaction } from '../receipt-processing/vision/vision-processor';
import { CATEGORIES, Category } from '../receipt-processing/categorizer/categorizer';
import { logger } from '../../core/utils/logger';
import { WorkflowStateManager, PendingWorkflow } from './workflow-state-manager';

/**
 * Configuration for TelegramBotHandler
 */
export interface TelegramBotConfig {
  botToken: string;
  database: DatabaseClient;
  onPhotoReceived?: (state: WorkflowState) => Promise<void>;
  onCategorySelected?: (userId: string, transactionId: string, category: string) => Promise<void>;
  onUserTextInput?: (userId: string, chatId: number, text: string, pendingWorkflow: PendingWorkflow) => Promise<void>;
}

/**
 * Error class for Telegram bot errors
 */
export class TelegramBotError extends Error {
  constructor(message: string, public originalError?: any) {
    super(message);
    this.name = 'TelegramBotError';
  }
}

/**
 * TelegramBotHandler class manages all Telegram bot interactions
 * Handles commands, photo messages, and callback queries
 */
export class TelegramBotHandler {
  private bot: Telegraf;
  private botToken: string;
  private database: DatabaseClient;
  private workflowStateManager: WorkflowStateManager;
  private onPhotoReceived?: (state: WorkflowState) => Promise<void>;
  private onCategorySelected?: (userId: string, transactionId: string, category: string) => Promise<void>;
  private onUserTextInput?: (userId: string, chatId: number, text: string, pendingWorkflow: PendingWorkflow) => Promise<void>;

  /**
   * Initialize the Telegram bot handler
   * @param config - Configuration object
   * @throws TelegramBotError if initialization fails
   */
  constructor(config: TelegramBotConfig) {
    if (!config.botToken) {
      throw new TelegramBotError('Bot token is required');
    }

    if (!config.database) {
      throw new TelegramBotError('Database client is required');
    }

    try {
      this.botToken = config.botToken;
      this.bot = new Telegraf(config.botToken);
      this.database = config.database;
      this.workflowStateManager = new WorkflowStateManager();
      this.onPhotoReceived = config.onPhotoReceived;
      this.onCategorySelected = config.onCategorySelected;
      this.onUserTextInput = config.onUserTextInput;

      // Register command handlers
      this.registerHandlers();

      // Start cleanup interval (every 30 minutes)
      setInterval(() => this.workflowStateManager.cleanup(), 30 * 60 * 1000);
    } catch (error) {
      throw new TelegramBotError(
        'Failed to initialize Telegram bot',
        error
      );
    }
  }

  /**
   * Register all command and message handlers
   * @private
   */
  private registerHandlers(): void {
    // Command handlers
    this.bot.command('start', (ctx) => this.handleStartCommand(ctx));
    this.bot.command('help', (ctx) => this.handleHelpCommand(ctx));
    this.bot.command('stats', (ctx) => this.handleStatsCommand(ctx));
    this.bot.command('cancel', (ctx) => this.handleCancelCommand(ctx));

    // Photo message handler
    this.bot.on('photo', (ctx) => this.handlePhoto(ctx));

    // Text message handler (for user corrections)
    this.bot.on('text', (ctx) => this.handleTextMessage(ctx));

    // Callback query handler for category selection
    this.bot.on('callback_query', (ctx) => this.handleCallbackQuery(ctx));

    // Error handler
    this.bot.catch((error, ctx) => {
      console.error('Bot error:', error);
      this.sendErrorMessage(
        ctx.chat?.id || 0,
        'An unexpected error occurred. Please try again later.',
        'unknown'
      ).catch(console.error);
    });
  }

  /**
   * Handle /start command - welcome message
   * @param ctx - Telegram context
   */
  private async handleStartCommand(ctx: Context): Promise<void> {
    const userId = ctx.from?.id.toString() || 'unknown';
    
    try {
      logger.logUserInteraction(userId, 'command', {
        command: '/start',
        username: ctx.from?.username,
      });

      logger.info('User started bot', {
        userId,
        username: ctx.from?.username,
        firstName: ctx.from?.first_name,
      });

      const welcomeMessage = `
👋 Welcome to Receipt Tracker Bot!

I help you track your spending by processing receipt images and e-wallet transaction screenshots.

🎯 What I can do:
• Extract transaction details from images
• Automatically categorize your expenses
• Store your spending history
• Provide spending statistics

📸 How to use:
1. Send me a photo of your receipt or e-wallet transaction
2. I'll extract the details and categorize it
3. If I'm unsure about the category, I'll ask you to confirm
4. Your transaction will be saved automatically

💡 Commands:
/start - Show this welcome message
/help - Get detailed usage instructions
/stats - View your spending summary

Let's get started! Send me your first receipt or transaction screenshot.
      `.trim();

      await ctx.reply(welcomeMessage);
      logger.debug('Welcome message sent', { userId });
    } catch (error) {
      logger.error('Error in start command', error as Error, { userId });
      await this.sendErrorMessage(
        ctx.chat?.id || 0,
        'Failed to send welcome message. Please try again.',
        'unknown'
      );
    }
  }

  /**
   * Handle /cancel command - cancel pending workflow
   * @param ctx - Telegram context
   */
  private async handleCancelCommand(ctx: Context): Promise<void> {
    const userId = ctx.from?.id.toString();
    
    if (!userId) {
      await ctx.reply('Unable to identify user.');
      return;
    }

    if (this.workflowStateManager.hasPending(userId)) {
      this.workflowStateManager.clearPending(userId);
      await ctx.reply('✅ Cancelled. You can send a new receipt or photo.');
    } else {
      await ctx.reply('No pending operation to cancel.');
    }
  }

  /**
   * Handle /help command - usage instructions
   * @param ctx - Telegram context
   */
  private async handleHelpCommand(ctx: Context): Promise<void> {
    try {
      const helpMessage = `
📖 Receipt Tracker Bot - Help Guide

🔍 Supported Image Types:
• Physical receipts (restaurant, retail, services)
• E-wallet screenshots (DuitNow, GrabPay, Touch 'n Go, etc.)
• Bank transaction notifications
• Any image with transaction details

📁 Spending Categories:
• Food & Dining
• Transportation
• Shopping
• Entertainment
• Bills & Utilities
• Healthcare
• Groceries
• Personal Care
• Education
• Travel & Vacation
• Tech Gadgets
• Subscriptions
• Others

💬 How It Works:
1. Send a photo of your receipt or transaction
2. I'll analyze it and extract:
   - Amount and currency
   - Merchant name
   - Date and time
   - Payment method
   - Transaction reference (if available)

3. I'll automatically categorize the transaction
4. If I'm confident, I'll save it immediately
5. If I'm unsure, I'll show you category options to choose from

📊 Commands:
/start - Welcome message and quick start
/help - This help guide
/stats - View spending summary (week/month/year)

💡 Tips:
• Make sure images are clear and well-lit
• Include the full transaction details in the photo
• You can send multiple receipts one after another

❓ Having issues?
• Try taking a clearer photo
• Ensure all text is visible and readable
• Check that the amount and merchant name are visible

Need more help? Contact support or check our documentation.
      `.trim();

      await ctx.reply(helpMessage);
    } catch (error) {
      console.error('Error in help command:', error);
      await this.sendErrorMessage(
        ctx.chat?.id || 0,
        'Failed to send help message. Please try again.',
        'unknown'
      );
    }
  }

  /**
   * Handle /stats command - display spending summary
   * @param ctx - Telegram context
   */
  private async handleStatsCommand(ctx: Context): Promise<void> {
    try {
      const userId = ctx.from?.id.toString();
      if (!userId) {
        await ctx.reply('Unable to identify user. Please try again.');
        return;
      }

      // Send "processing" message
      const processingMsg = await ctx.reply('📊 Calculating your spending statistics...');

      try {
        // Fetch stats for different periods
        const monthStats = await this.database.getSpendingStats(userId, 'month');
        const yearStats = await this.database.getSpendingStats(userId, 'year');

        // Format and send stats message
        const statsMessage = this.formatStatsMessage(monthStats, yearStats);
        
        // Delete processing message
        await ctx.telegram.deleteMessage(ctx.chat!.id, processingMsg.message_id);
        
        // Send stats
        await ctx.reply(statsMessage, { parse_mode: 'HTML' });
      } catch (error) {
        // Delete processing message
        await ctx.telegram.deleteMessage(ctx.chat!.id, processingMsg.message_id);
        
        console.error('Error fetching stats:', error);
        await ctx.reply(
          '❌ Failed to fetch spending statistics. Please try again later.'
        );
      }
    } catch (error) {
      console.error('Error in stats command:', error);
      await this.sendErrorMessage(
        ctx.chat?.id || 0,
        'Failed to process stats command. Please try again.',
        'unknown'
      );
    }
  }

  /**
   * Format spending statistics into a user-friendly message
   * @param monthStats - Statistics for the current month
   * @param yearStats - Statistics for the current year
   * @returns Formatted message string
   * @private
   */
  private formatStatsMessage(monthStats: SpendingStats, yearStats: SpendingStats): string {
    let message = '<b>📊 Your Spending Summary</b>\n\n';

    // Month stats
    message += '<b>📅 This Month</b>\n';
    if (monthStats.transaction_count === 0) {
      message += 'No transactions recorded this month.\n\n';
    } else {
      message += `💰 Total: MYR ${monthStats.total_amount.toFixed(2)}\n`;
      message += `📝 Transactions: ${monthStats.transaction_count}\n\n`;

      if (monthStats.by_category.length > 0) {
        message += '<b>By Category:</b>\n';
        monthStats.by_category.slice(0, 5).forEach((cat) => {
          const bar = this.createProgressBar(cat.percentage);
          message += `${bar} ${cat.category}\n`;
          message += `   MYR ${cat.amount.toFixed(2)} (${cat.percentage.toFixed(1)}%) • ${cat.count} transactions\n`;
        });
        message += '\n';
      }
    }

    // Year stats
    message += '<b>📆 This Year</b>\n';
    if (yearStats.transaction_count === 0) {
      message += 'No transactions recorded this year.\n';
    } else {
      message += `💰 Total: MYR ${yearStats.total_amount.toFixed(2)}\n`;
      message += `📝 Transactions: ${yearStats.transaction_count}\n`;

      if (yearStats.by_category.length > 0) {
        const avgPerMonth = yearStats.total_amount / 12;
        message += `📊 Avg/Month: MYR ${avgPerMonth.toFixed(2)}\n`;
      }
    }

    message += '\n💡 <i>Send more receipts to track your spending!</i>';

    return message;
  }

  /**
   * Create a visual progress bar for percentages
   * @param percentage - The percentage value (0-100)
   * @returns Progress bar string
   * @private
   */
  private createProgressBar(percentage: number): string {
    const filled = Math.round(percentage / 10);
    const empty = 10 - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
  }

  /**
   * Handle photo messages - download and trigger workflow
   * @param ctx - Telegram context with photo message
   */
  private async handlePhoto(ctx: Context): Promise<void> {
    try {
      // Check if message contains photos
      if (!ctx.message || !('photo' in ctx.message)) {
        await ctx.reply('❌ No photo found in message. Please send a photo.');
        return;
      }

      const userId = ctx.from?.id.toString();
      const chatId = ctx.chat?.id;

      if (!userId || !chatId) {
        await ctx.reply('❌ Unable to identify user. Please try again.');
        return;
      }

      logger.logUserInteraction(userId, 'photo_sent', {
        username: ctx.from?.username,
        chatId,
      });

      logger.info('Photo received from user', {
        userId,
        username: ctx.from?.username,
        photoCount: ctx.message.photo.length,
      });

      // Send acknowledgment message
      const ackMsg = await ctx.reply('📸 Photo received! Processing your receipt...');

      try {
        // Get the largest photo (best quality)
        const photos = ctx.message.photo;
        const largestPhoto = photos[photos.length - 1];

        logger.debug('Downloading photo from Telegram', {
          userId,
          fileId: largestPhoto.file_id,
          fileSize: largestPhoto.file_size,
        });

        // Get file link from Telegram
        const file = await ctx.telegram.getFile(largestPhoto.file_id);
        const fileUrl = `https://api.telegram.org/file/bot${this.botToken}/${file.file_path}`;

        // Download the image
        const response = await fetch(fileUrl);
        if (!response.ok) {
          throw new Error(`Failed to download image: ${response.statusText}`);
        }

        const imageBuffer = Buffer.from(await response.arrayBuffer());

        logger.debug('Photo downloaded successfully', {
          userId,
          size: `${(imageBuffer.length / 1024).toFixed(2)} KB`,
        });

        // Create initial workflow state
        const workflowState: WorkflowState = {
          telegramUserId: userId,
          chatId: chatId,
          imageUrl: fileUrl,
          imageData: imageBuffer,
          awaitingUserInput: false,
          needsClarification: false,
          extractionValid: false,
        };

        // Delete acknowledgment message
        await ctx.telegram.deleteMessage(chatId, ackMsg.message_id);

        // Send processing message
        await ctx.reply('🔍 Extracting transaction details...');

        logger.info('Starting workflow for photo', { userId });

        // Trigger workflow if callback is provided
        if (this.onPhotoReceived) {
          await this.onPhotoReceived(workflowState);
        } else {
          // If no workflow callback, just acknowledge
          await ctx.reply(
            '✅ Photo received and stored. Workflow processing will be implemented soon.'
          );
        }
      } catch (error) {
        // Delete acknowledgment message if it exists
        try {
          await ctx.telegram.deleteMessage(chatId, ackMsg.message_id);
        } catch (e) {
          // Ignore deletion errors
        }

        console.error('Error processing photo:', error);
        await this.sendErrorMessage(
          chatId,
          'Failed to process your photo. Please ensure the image is clear and try again.',
          'extraction'
        );
      }
    } catch (error) {
      console.error('Error in photo handler:', error);
      await this.sendErrorMessage(
        ctx.chat?.id || 0,
        'An error occurred while handling your photo. Please try again.',
        'unknown'
      );
    }
  }

  /**
   * Send category options to user with inline keyboard
   * @param chatId - The chat ID to send the message to
   * @param transactionData - The extracted transaction data
   * @param suggestedCategories - Suggested categories (optional)
   * @param transactionId - The transaction ID for callback data
   */
  async sendCategoryOptions(
    chatId: number,
    transactionData: ExtractedTransaction,
    suggestedCategories?: string[],
    transactionId?: string
  ): Promise<void> {
    try {
      // Format transaction details
      const dateTime = new Date(transactionData.dateTime);
      const formattedDate = dateTime.toLocaleDateString('en-MY', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });

      let message = '🤔 I need your help categorizing this transaction:\n\n';
      message += `💰 Amount: ${transactionData.currency} ${transactionData.amount.toFixed(2)}\n`;
      message += `🏪 Merchant: ${transactionData.merchantName}\n`;
      message += `📅 Date: ${formattedDate}\n`;

      if (transactionData.paymentMethod) {
        message += `💳 Payment: ${transactionData.paymentMethod}\n`;
      }

      if (transactionData.items && transactionData.items.length > 0) {
        message += `\n📝 Items: ${transactionData.items.map(item => item.name).join(', ')}\n`;
      }

      message += '\n📁 Please select the appropriate category:';

      // Determine which categories to show
      const categoriesToShow = suggestedCategories && suggestedCategories.length > 0
        ? suggestedCategories
        : Array.from(CATEGORIES);

      // Create inline keyboard with category buttons
      // Show 2 buttons per row for better mobile UX
      const buttons = [];
      for (let i = 0; i < categoriesToShow.length; i += 2) {
        const row = [];
        
        // First button in row
        const category1 = categoriesToShow[i];
        row.push(
          Markup.button.callback(
            category1,
            `category:${transactionId || 'temp'}:${category1}`
          )
        );

        // Second button in row (if exists)
        if (i + 1 < categoriesToShow.length) {
          const category2 = categoriesToShow[i + 1];
          row.push(
            Markup.button.callback(
              category2,
              `category:${transactionId || 'temp'}:${category2}`
            )
          );
        }

        buttons.push(row);
      }

      // If showing suggested categories, add "Show all categories" button
      if (suggestedCategories && suggestedCategories.length > 0 && suggestedCategories.length < CATEGORIES.length) {
        buttons.push([
          Markup.button.callback(
            '📋 Show all categories',
            `category:${transactionId || 'temp'}:show_all`
          ),
        ]);
      }

      await this.bot.telegram.sendMessage(
        chatId,
        message,
        Markup.inlineKeyboard(buttons)
      );
    } catch (error) {
      console.error('Failed to send category options:', error);
      await this.sendErrorMessage(
        chatId,
        'Failed to send category options. Please try again.',
        'unknown'
      );
    }
  }

  /**
   * Handle text messages - check for pending workflows that need user input
   * @param ctx - Telegram context with text message
   */
  private async handleTextMessage(ctx: Context): Promise<void> {
    try {
      if (!ctx.message || !('text' in ctx.message)) {
        return;
      }

      const userId = ctx.from?.id.toString();
      const chatId = ctx.chat?.id;
      const text = ctx.message.text;

      if (!userId || !chatId) {
        return;
      }

      // Check if this is a command (starts with /)
      if (text.startsWith('/')) {
        // Commands are handled by their specific handlers
        return;
      }

      // Check if user has a pending workflow
      const pendingWorkflow = this.workflowStateManager.getPending(userId);

      if (!pendingWorkflow) {
        // No pending workflow, send helpful message
        await ctx.reply(
          '📸 Please send me a photo of your receipt or e-wallet transaction screenshot.\n\n' +
          'Use /help to see what I can do.'
        );
        return;
      }

      // User has a pending workflow, process their input
      logger.info('Processing user text input for pending workflow', {
        userId,
        workflowType: pendingWorkflow.type,
        textLength: text.length,
      });

      // Trigger the text input callback
      if (this.onUserTextInput) {
        await this.onUserTextInput(userId, chatId, text, pendingWorkflow);
      } else {
        // Fallback if no handler
        await ctx.reply('✅ Input received. Processing...');
        this.workflowStateManager.clearPending(userId);
      }
    } catch (error) {
      console.error('Error handling text message:', error);
      await ctx.reply('❌ An error occurred processing your message. Please try again.');
    }
  }

  /**
   * Handle callback queries from inline keyboard buttons
   * @param ctx - Telegram context with callback query
   */
  private async handleCallbackQuery(ctx: Context): Promise<void> {
    try {
      if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) {
        return;
      }

      const callbackData = ctx.callbackQuery.data;
      const userId = ctx.from?.id.toString();
      const chatId = ctx.chat?.id;

      if (!userId || !chatId) {
        await ctx.answerCbQuery('Unable to identify user');
        return;
      }

      // Parse callback data: "category:transactionId:categoryName"
      const parts = callbackData.split(':');
      if (parts.length !== 3 || parts[0] !== 'category') {
        await ctx.answerCbQuery('Invalid callback data');
        return;
      }

      const transactionId = parts[1];
      const selectedCategory = parts[2];

      // Handle "show all categories" button
      if (selectedCategory === 'show_all') {
        // Delete the previous message
        if (ctx.callbackQuery.message) {
          await ctx.telegram.deleteMessage(
            chatId,
            ctx.callbackQuery.message.message_id
          );
        }

        // Get transaction data from the message (we'll need to store this temporarily)
        // For now, send all categories without transaction details
        await ctx.answerCbQuery('Showing all categories...');
        
        // Create buttons for all categories
        const buttons = [];
        for (let i = 0; i < CATEGORIES.length; i += 2) {
          const row = [];
          
          row.push(
            Markup.button.callback(
              CATEGORIES[i],
              `category:${transactionId}:${CATEGORIES[i]}`
            )
          );

          if (i + 1 < CATEGORIES.length) {
            row.push(
              Markup.button.callback(
                CATEGORIES[i + 1],
                `category:${transactionId}:${CATEGORIES[i + 1]}`
              )
            );
          }

          buttons.push(row);
        }

        await ctx.telegram.sendMessage(
          chatId,
          '📁 Select a category:',
          Markup.inlineKeyboard(buttons)
        );

        return;
      }

      // Validate category
      if (!CATEGORIES.includes(selectedCategory as Category)) {
        await ctx.answerCbQuery('Invalid category selected');
        return;
      }

      // Answer the callback query to remove loading state
      await ctx.answerCbQuery(`Selected: ${selectedCategory}`);

      // Delete the category selection message
      if (ctx.callbackQuery.message) {
        await ctx.telegram.deleteMessage(
          chatId,
          ctx.callbackQuery.message.message_id
        );
      }

      // Send confirmation message
      await ctx.telegram.sendMessage(
        chatId,
        `✅ Category set to: ${selectedCategory}\n\nProcessing transaction...`
      );

      // Trigger category selection callback if provided
      if (this.onCategorySelected && transactionId !== 'temp') {
        await this.onCategorySelected(userId, transactionId, selectedCategory);
      } else {
        // If no callback or temp ID, just acknowledge
        await ctx.telegram.sendMessage(
          chatId,
          '✅ Category recorded. Transaction will be saved.'
        );
      }
    } catch (error) {
      console.error('Error handling callback query:', error);
      await ctx.answerCbQuery('An error occurred. Please try again.');
    }
  }

  /**
   * Send confirmation message with formatted transaction details
   * @param chatId - The chat ID to send the message to
   * @param transactionData - The extracted transaction data
   * @param category - The assigned category
   * @param transactionId - The transaction ID (optional)
   */
  async sendConfirmation(
    chatId: number,
    transactionData: ExtractedTransaction,
    category: string,
    transactionId?: string
  ): Promise<void> {
    try {
      // Format date/time
      const dateTime = new Date(transactionData.dateTime);
      const formattedDate = dateTime.toLocaleDateString('en-MY', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
      const formattedTime = dateTime.toLocaleTimeString('en-MY', {
        hour: '2-digit',
        minute: '2-digit',
      });

      // Build confirmation message
      let message = '✅ Transaction recorded successfully!\n\n';
      message += `💰 Amount: ${transactionData.currency} ${transactionData.amount.toFixed(2)}\n`;
      message += `🏪 Merchant: ${transactionData.merchantName}\n`;
      message += `📁 Category: ${category}\n`;
      message += `📅 Date: ${formattedDate}\n`;
      message += `🕐 Time: ${formattedTime}\n`;

      if (transactionData.paymentMethod) {
        message += `💳 Payment: ${transactionData.paymentMethod}\n`;
      }

      if (transactionData.transactionReference) {
        message += `🔖 Reference: ${transactionData.transactionReference}\n`;
      }

      // Add items if available
      if (transactionData.items && transactionData.items.length > 0) {
        message += '\n📝 Items:\n';
        transactionData.items.forEach((item) => {
          message += `  • ${item.name} (${item.quantity}x) - ${transactionData.currency} ${item.price.toFixed(2)}\n`;
        });
      }

      if (transactionId) {
        message += `\n🆔 Transaction ID: ${transactionId}`;
      }

      message += '\n\n💡 Send another receipt to track more spending!';

      await this.bot.telegram.sendMessage(chatId, message);
    } catch (error) {
      console.error('Failed to send confirmation:', error);
      // Still try to send a basic confirmation
      await this.bot.telegram.sendMessage(
        chatId,
        '✅ Transaction recorded successfully!'
      ).catch(console.error);
    }
  }

  /**
   * Send an error message to a user with context-specific explanations
   * @param chatId - The chat ID to send the message to
   * @param errorType - The type of error that occurred
   * @param errorMessage - Optional detailed error message
   */
  async sendErrorMessage(
    chatId: number,
    errorMessage: string,
    errorType?: 'extraction' | 'categorization' | 'storage' | 'validation' | 'network' | 'timeout' | 'unknown'
  ): Promise<void> {
    try {
      let message = '❌ ';
      let explanation = '';

      // Provide user-friendly explanations based on error type
      switch (errorType) {
        case 'extraction':
          message += 'Failed to extract transaction details from the image.';
          explanation = '\n\n💡 Tips:\n';
          explanation += '• Ensure the image is clear and well-lit\n';
          explanation += '• Make sure all text is visible and readable\n';
          explanation += '• Try taking a new photo with better focus\n';
          explanation += '• Avoid blurry or partially cropped images';
          break;

        case 'categorization':
          message += 'Failed to categorize the transaction.';
          explanation = '\n\n💡 This is usually a temporary issue. Please try again in a moment.';
          break;

        case 'storage':
          message += 'Failed to save the transaction to the database.';
          explanation = '\n\n💡 Your transaction data was processed but not saved. Please try sending the receipt again.';
          break;

        case 'validation':
          message += 'The transaction data is incomplete or invalid.';
          explanation = '\n\n💡 Tips:\n';
          explanation += '• Ensure the receipt shows the amount clearly\n';
          explanation += '• Make sure the merchant name is visible\n';
          explanation += '• Try taking a photo of the complete receipt';
          break;

        case 'network':
          message += 'Network connection issue.';
          explanation = '\n\n💡 Please check your internet connection and try again.';
          break;

        case 'timeout':
          message += 'The request took too long to process.';
          explanation = '\n\n💡 The image might be too large or the service is busy. Please try again.';
          break;

        case 'unknown':
        default:
          message += errorMessage || 'An unexpected error occurred.';
          explanation = '\n\n💡 Please try again. If the problem persists, contact support.';
          break;
      }

      // Add detailed error message if provided and different from type
      if (errorMessage && errorType && errorMessage !== 'An unexpected error occurred.') {
        message += `\n\n📋 Details: ${errorMessage}`;
      }

      message += explanation;

      await this.bot.telegram.sendMessage(chatId, message);
    } catch (error) {
      console.error('Failed to send error message:', error);
      // Last resort - try to send a basic error message
      try {
        await this.bot.telegram.sendMessage(
          chatId,
          '❌ An error occurred. Please try again.'
        );
      } catch (e) {
        console.error('Failed to send fallback error message:', e);
      }
    }
  }

  /**
   * Send a simple error message without error type context
   * @param chatId - The chat ID to send the message to
   * @param message - The error message
   */
  async sendSimpleError(chatId: number, message: string): Promise<void> {
    await this.sendErrorMessage(chatId, message);
  }

  /**
   * Launch the bot and start polling for updates
   * @throws TelegramBotError if launch fails
   */
  async launch(): Promise<void> {
    try {
      logger.info('🚀 Launching Telegram bot...');
      await this.bot.launch();
      logger.info('✅ Telegram bot launched successfully');
      logger.info('📱 Bot is ready to receive messages');

      // Enable graceful stop
      process.once('SIGINT', () => this.stop('SIGINT'));
      process.once('SIGTERM', () => this.stop('SIGTERM'));
    } catch (error) {
      logger.error('Failed to launch Telegram bot', error as Error);
      throw new TelegramBotError('Failed to launch bot', error);
    }
  }

  /**
   * Stop the bot gracefully
   * @param signal - The signal that triggered the stop
   */
  async stop(signal?: string): Promise<void> {
    logger.info(`🛑 Stopping Telegram bot... (${signal || 'manual'})`);
    await this.bot.stop(signal);
    logger.info('✅ Telegram bot stopped');
  }

  /**
   * Request merchant name correction from user
   * @param chatId - The chat ID
   * @param state - The workflow state
   * @param extractedData - The extracted transaction data
   */
  async requestMerchantCorrection(
    chatId: number,
    state: WorkflowState,
    extractedData: ExtractedTransaction
  ): Promise<void> {
    try {
      const message = 
        `❌ I couldn't identify the merchant name from your receipt.\n\n` +
        `💰 Amount: ${extractedData.currency} ${extractedData.amount.toFixed(2)}\n` +
        `🏪 Merchant: ${extractedData.merchantName}\n\n` +
        `📝 Please reply with the correct merchant name, or send /cancel to start over.`;

      await this.bot.telegram.sendMessage(chatId, message);

      // Store pending workflow
      this.workflowStateManager.setPending(state.telegramUserId, {
        userId: state.telegramUserId,
        chatId,
        type: 'merchant_correction',
        state,
        extractedData,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error('Failed to request merchant correction:', error);
    }
  }

  /**
   * Request amount correction from user
   * @param chatId - The chat ID
   * @param state - The workflow state
   * @param extractedData - The extracted transaction data
   */
  async requestAmountCorrection(
    chatId: number,
    state: WorkflowState,
    extractedData: ExtractedTransaction
  ): Promise<void> {
    try {
      const message = 
        `❌ I couldn't extract the amount from your receipt.\n\n` +
        `🏪 Merchant: ${extractedData.merchantName}\n` +
        `💰 Amount: ${extractedData.currency} ${extractedData.amount.toFixed(2)}\n\n` +
        `📝 Please reply with the correct amount (e.g., "16.50"), or send /cancel to start over.`;

      await this.bot.telegram.sendMessage(chatId, message);

      // Store pending workflow
      this.workflowStateManager.setPending(state.telegramUserId, {
        userId: state.telegramUserId,
        chatId,
        type: 'amount_correction',
        state,
        extractedData,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error('Failed to request amount correction:', error);
    }
  }

  /**
   * Request retry with user guidance
   * @param chatId - The chat ID
   * @param state - The workflow state
   * @param errorMessage - The error message
   */
  async requestRetryWithGuidance(
    chatId: number,
    state: WorkflowState,
    errorMessage: string
  ): Promise<void> {
    try {
      const message = 
        `❌ ${errorMessage}\n\n` +
        `💡 What would you like to do?\n\n` +
        `1️⃣ Send a clearer photo of the receipt\n` +
        `2️⃣ Type the transaction details manually (reply with merchant name)\n` +
        `3️⃣ /cancel to start over`;

      await this.bot.telegram.sendMessage(chatId, message);

      // Store pending workflow
      this.workflowStateManager.setPending(state.telegramUserId, {
        userId: state.telegramUserId,
        chatId,
        type: 'retry_extraction',
        state,
        errorMessage,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error('Failed to request retry with guidance:', error);
    }
  }

  /**
   * Get the workflow state manager
   * @returns The workflow state manager instance
   */
  getWorkflowStateManager(): WorkflowStateManager {
    return this.workflowStateManager;
  }

  /**
   * Get the bot instance (for testing or advanced usage)
   * @returns The Telegraf bot instance
   */
  getBot(): Telegraf {
    return this.bot;
  }
}
