import { Telegraf, Context } from 'telegraf';
import { Markup } from 'telegraf';
import { 
  MessagingAdapter, 
  MessagingAdapterCallbacks
} from './messaging-adapter';
import {
  UserContext,
  ImageInput,
  TextMessage,
  OptionsMessage,
  TransactionSummary,
  ErrorMessage
} from './types';
import { logger } from '../utils/logger';

export interface TelegramAdapterConfig {
  botToken: string;
  callbacks: MessagingAdapterCallbacks;
}

export class TelegramAdapter implements MessagingAdapter {
  private bot: Telegraf;
  private callbacks: MessagingAdapterCallbacks;
  private botToken: string;

  constructor(config: TelegramAdapterConfig) {
    this.botToken = config.botToken;
    this.bot = new Telegraf(config.botToken);
    this.callbacks = config.callbacks;
    
    this.registerHandlers();
  }

  async start(): Promise<void> {
    try {
      const env = process.env.NODE_ENV || 'development';
      logger.info('🚀 Starting Telegram adapter...');
      logger.info(`Environment: ${env}`);
      logger.info(`Bot token: ${this.botToken.substring(0, 10)}...`);
      
      // Launch with dropPendingUpdates to clear any pending updates
      await this.bot.launch({
        dropPendingUpdates: true
      });
      
      logger.info('✅ Telegram adapter started');
      logger.info('📱 Bot is ready to receive messages');
    } catch (error) {
      logger.error('❌ Failed to launch Telegram bot');
      if (error instanceof Error) {
        logger.error(`Error name: ${error.name}`);
        logger.error(`Error message: ${error.message}`);
        logger.error(`Stack trace: ${error.stack}`);
      } else {
        logger.error(`Unknown error type: ${typeof error}`);
        logger.error(`Error value: ${JSON.stringify(error)}`);
      }
      throw error;
    }
  }

  async stop(signal?: string): Promise<void> {
    logger.info(`🛑 Stopping Telegram adapter... (${signal || 'manual'})`);
    await this.bot.stop(signal);
  }  /**

   * Register all command and message handlers
   * @private
   */
  private registerHandlers(): void {
    // Photo handler
    this.bot.on('photo', async (ctx) => {
      const context = this.createUserContext(ctx);
      
      try {
        const photos = ctx.message.photo;
        const largestPhoto = photos[photos.length - 1];
        
        const file = await ctx.telegram.getFile(largestPhoto.file_id);
        const fileUrl = `https://api.telegram.org/file/bot${this.botToken}/${file.file_path}`;
        
        const response = await fetch(fileUrl);
        const imageBuffer = Buffer.from(await response.arrayBuffer());
        
        // v2: Use onMessage callback if available (multi-turn support)
        if (this.callbacks.onMessage) {
          const caption = 'caption' in ctx.message ? ctx.message.caption || '' : '';
          const responseMessage = await this.callbacks.onMessage(context, caption, imageBuffer);
          await ctx.reply(responseMessage);
        } else {
          // Fallback to v1 callback
          const image: ImageInput = {
            data: imageBuffer,
            url: fileUrl,
            mimeType: 'image/jpeg'
          };
          await this.callbacks.onImageReceived(context, image);
        }
      } catch (error) {
        logger.error('Error handling photo', error as Error);
        await ctx.reply('❌ Failed to process image. Please try again.');
      }
    });

    // Text handler
    this.bot.on('text', async (ctx) => {
      const text = ctx.message.text;
      
      // Skip commands
      if (text.startsWith('/')) {
        if (this.callbacks.onCommand) {
          const parts = text.slice(1).split(' ');
          const command = parts[0];
          const args = parts.slice(1);
          await this.callbacks.onCommand(this.createUserContext(ctx), command, args);
        }
        return;
      }
      
      const context = this.createUserContext(ctx);
      
      // v2: Use onMessage callback if available (multi-turn support)
      if (this.callbacks.onMessage) {
        try {
          const responseMessage = await this.callbacks.onMessage(context, text);
          await ctx.reply(responseMessage);
        } catch (error) {
          logger.error('Error handling text message', error as Error);
          await ctx.reply('❌ An error occurred. Please try again.');
        }
      } else {
        // Fallback to v1 callback
        await this.callbacks.onTextReceived(context, text);
      }
    });

    // Callback query handler (for buttons)
    this.bot.on('callback_query', async (ctx) => {
      if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) {
        return;
      }

      const data = ctx.callbackQuery.data;
      const parts = data.split(':');
      
      if (parts[0] === 'option' && parts.length === 3) {
        const optionId = parts[1];
        const optionValue = parts[2];
        
        await ctx.answerCbQuery(`Selected: ${optionValue}`);
        
        // Delete the options message
        if (ctx.callbackQuery.message) {
          await ctx.telegram.deleteMessage(
            ctx.chat!.id,
            ctx.callbackQuery.message.message_id
          );
        }
        
        const context = this.createUserContext(ctx);
        await this.callbacks.onOptionSelected(context, optionId, optionValue);
      }
    });

    // Command handlers
    this.bot.command('start', async (ctx) => {
      const welcomeMessage = `
👋 Welcome to Receipt Tracker Bot!

📸 Send me a photo of your receipt to get started.
💡 Use /help for more information.
      `.trim();
      
      await ctx.reply(welcomeMessage);
    });

    this.bot.command('help', async (ctx) => {
      const helpMessage = `
📖 Receipt Tracker Bot - Help

🔍 Send photos of receipts or e-wallet transactions
📊 Use /stats to view your spending summary
❌ Use /cancel to cancel current operation
      `.trim();
      
      await ctx.reply(helpMessage);
    });

    this.bot.command('cancel', async (ctx) => {
      await ctx.reply('✅ Cancelled. You can send a new receipt or photo.');
    });

    // Error handler
    this.bot.catch((error, ctx) => {
      console.error('Bot error:', error);
      this.sendError(
        this.createUserContext(ctx),
        {
          message: 'An unexpected error occurred. Please try again later.',
          errorType: 'unknown'
        }
      ).catch(console.error);
    });
  }

  async sendMessage(context: UserContext, message: TextMessage): Promise<void> {
    const chatId = this.getChatId(context);
    const parseMode = message.format === 'html' ? 'HTML' : 
                      message.format === 'markdown' ? 'Markdown' : undefined;
    
    await this.bot.telegram.sendMessage(chatId, message.text, {
      parse_mode: parseMode as any
    });
  }

  async sendOptions(context: UserContext, message: OptionsMessage): Promise<void> {
    const chatId = this.getChatId(context);
    
    // Create inline keyboard with 2 buttons per row
    const buttons = [];
    for (let i = 0; i < message.options.length; i += 2) {
      const row = [];
      
      row.push(
        Markup.button.callback(
          message.options[i].label,
          `option:${message.options[i].id}:${message.options[i].value}`
        )
      );

      if (i + 1 < message.options.length) {
        row.push(
          Markup.button.callback(
            message.options[i + 1].label,
            `option:${message.options[i + 1].id}:${message.options[i + 1].value}`
          )
        );
      }

      buttons.push(row);
    }

    await this.bot.telegram.sendMessage(
      chatId,
      message.text,
      Markup.inlineKeyboard(buttons)
    );
  }

  async sendTransactionConfirmation(context: UserContext, transaction: TransactionSummary): Promise<void> {
    const chatId = this.getChatId(context);
    
    const dateTime = new Date(transaction.dateTime);
    const formattedDate = dateTime.toLocaleDateString('en-MY', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
    const formattedTime = dateTime.toLocaleTimeString('en-MY', {
      hour: '2-digit',
      minute: '2-digit',
    });

    let message = '✅ Transaction recorded successfully!\n\n';
    message += `💰 Amount: ${transaction.currency} ${transaction.amount.toFixed(2)}\n`;
    message += `🏪 Merchant: ${transaction.merchantName}\n`;
    message += `📁 Category: ${transaction.category}\n`;
    message += `📅 Date: ${formattedDate}\n`;
    message += `🕐 Time: ${formattedTime}\n`;

    if (transaction.paymentMethod) {
      message += `💳 Payment: ${transaction.paymentMethod}\n`;
    }

    if (transaction.transactionReference) {
      message += `🔖 Reference: ${transaction.transactionReference}\n`;
    }

    if (transaction.transactionId) {
      message += `\n🆔 Transaction ID: ${transaction.transactionId}`;
    }

    message += '\n\n💡 Send another receipt to track more spending!';

    await this.bot.telegram.sendMessage(chatId, message);
  }

  async sendError(context: UserContext, error: ErrorMessage): Promise<void> {
    const chatId = this.getChatId(context);
    
    let message = `❌ ${error.message}`;
    
    if (error.suggestions && error.suggestions.length > 0) {
      message += '\n\n💡 Suggestions:\n';
      error.suggestions.forEach(suggestion => {
        message += `• ${suggestion}\n`;
      });
    }

    await this.bot.telegram.sendMessage(chatId, message);
  }

  async requestTextInput(context: UserContext, prompt: string): Promise<void> {
    const chatId = this.getChatId(context);
    await this.bot.telegram.sendMessage(chatId, prompt);
  }

  private createUserContext(ctx: Context): UserContext {
    return {
      userId: ctx.from!.id.toString(),
      sessionId: ctx.chat!.id.toString(),
      metadata: {
        chatId: ctx.chat!.id,
        username: ctx.from?.username,
        firstName: ctx.from?.first_name
      }
    };
  }

  private getChatId(context: UserContext): number {
    return context.metadata?.chatId || parseInt(context.sessionId);
  }
}