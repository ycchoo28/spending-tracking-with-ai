import * as readline from 'readline';
import { 
  MessagingAdapter, 
  MessagingAdapterCallbacks,
  UserContext,
  ImageInput,
  TextMessage,
  OptionsMessage,
  TransactionSummary,
  ErrorMessage
} from './messaging-adapter';
import * as fs from 'fs';

export interface ConsoleAdapterConfig {
  callbacks: MessagingAdapterCallbacks;
  userId?: string;
}

export class ConsoleAdapter implements MessagingAdapter {
  private callbacks: MessagingAdapterCallbacks;
  private rl: readline.Interface;
  private context: UserContext;

  constructor(config: ConsoleAdapterConfig) {
    this.callbacks = config.callbacks;
    this.context = {
      userId: config.userId || 'console-user',
      sessionId: 'console-session',
      metadata: { platform: 'console' }
    };
    
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  async start(): Promise<void> {
    console.log('🖥️  Console adapter started');
    console.log('Commands:');
    console.log('  image <path>  - Process an image file');
    console.log('  text <msg>    - Send text message');
    console.log('  exit          - Exit the application');
    console.log('');
    
    this.promptUser();
  }

  async stop(): Promise<void> {
    this.rl.close();
    console.log('👋 Console adapter stopped');
  }

  async sendMessage(_context: UserContext, message: TextMessage): Promise<void> {
    console.log(`\n📨 ${message.text}\n`);
  }

  async sendOptions(context: UserContext, message: OptionsMessage): Promise<void> {
    console.log(`\n${message.text}`);
    console.log('Options:');
    message.options.forEach((opt: any, idx: number) => {
      console.log(`  ${idx + 1}. ${opt.label}`);
    });
    console.log('');
    
    this.rl.question('Select option (number): ', async (answer) => {
      const idx = parseInt(answer) - 1;
      if (idx >= 0 && idx < message.options.length) {
        const option = message.options[idx];
        await this.callbacks.onOptionSelected(context, option.id, option.value);
      }
      this.promptUser();
    });
  }

  async sendTransactionConfirmation(_context: UserContext, transaction: TransactionSummary): Promise<void> {
    console.log('\n✅ Transaction Recorded:');
    console.log(`   Amount: ${transaction.currency} ${transaction.amount.toFixed(2)}`);
    console.log(`   Merchant: ${transaction.merchantName}`);
    console.log(`   Category: ${transaction.category}`);
    console.log(`   Date: ${transaction.dateTime}`);
    if (transaction.transactionId) {
      console.log(`   ID: ${transaction.transactionId}`);
    }
    console.log('');
  }

  async sendError(_context: UserContext, error: ErrorMessage): Promise<void> {
    console.log(`\n❌ Error: ${error.message}`);
    if (error.suggestions) {
      console.log('Suggestions:');
      error.suggestions.forEach((s: any) => console.log(`  • ${s}`));
    }
    console.log('');
  }

  async requestTextInput(context: UserContext, prompt: string): Promise<void> {
    this.rl.question(`${prompt}: `, async (answer) => {
      await this.callbacks.onTextReceived(context, answer);
      this.promptUser();
    });
  }

  private promptUser(): void {
    this.rl.question('> ', async (input) => {
      const parts = input.trim().split(' ');
      const command = parts[0].toLowerCase();
      const args = parts.slice(1);

      switch (command) {
        case 'image':
          if (args.length > 0) {
            const imagePath = args.join(' ');
            try {
              const imageData = fs.readFileSync(imagePath);
              const image: ImageInput = {
                data: imageData,
                url: `file://${imagePath}`
              };
              await this.callbacks.onImageReceived(this.context, image);
            } catch (error) {
              console.log(`❌ Failed to read image: ${error}`);
            }
          }
          this.promptUser();
          break;

        case 'text':
          if (args.length > 0) {
            await this.callbacks.onTextReceived(this.context, args.join(' '));
          }
          this.promptUser();
          break;

        case 'exit':
          await this.stop();
          process.exit(0);
          break;

        default:
          console.log('Unknown command. Use: image <path>, text <msg>, or exit');
          this.promptUser();
      }
    });
  }
}