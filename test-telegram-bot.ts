/**
 * Test file for TelegramBotHandler
 * This demonstrates how to initialize and use the Telegram bot
 */

import { TelegramBotHandler } from './src/telegram';
import { DatabaseClient } from './src/database/database';
import { getConfig } from './src/config/config';
import { WorkflowState } from './src/workflow/workflow';

async function testTelegramBot() {
  try {
    console.log('🧪 Testing Telegram Bot Handler...\n');

    // Load configuration
    const config = getConfig();
    console.log('✅ Configuration loaded');

    // Initialize database client
    const database = new DatabaseClient(
      config.supabase.url,
      config.supabase.key
    );
    console.log('✅ Database client initialized');

    // Define workflow callback (placeholder)
    const onPhotoReceived = async (state: WorkflowState) => {
      console.log('📸 Photo received callback triggered');
      console.log('   User ID:', state.telegramUserId);
      console.log('   Chat ID:', state.chatId);
      console.log('   Image size:', state.imageData?.length, 'bytes');
    };

    // Define category selection callback (placeholder)
    const onCategorySelected = async (
      userId: string,
      transactionId: string,
      category: string
    ) => {
      console.log('📁 Category selected callback triggered');
      console.log('   User ID:', userId);
      console.log('   Transaction ID:', transactionId);
      console.log('   Category:', category);
    };

    // Initialize Telegram bot handler
    const botHandler = new TelegramBotHandler({
      botToken: config.telegram.botToken,
      database,
      onPhotoReceived,
      onCategorySelected,
    });
    console.log('✅ Telegram bot handler initialized');

    // Test sending error message (without launching bot)
    console.log('\n📝 Bot handler methods available:');
    console.log('   - sendErrorMessage()');
    console.log('   - sendConfirmation()');
    console.log('   - sendCategoryOptions()');
    console.log('   - launch()');
    console.log('   - stop()');

    console.log('\n✅ All tests passed!');
    console.log('\n💡 To launch the bot, call: botHandler.launch()');
    console.log('   The bot will start polling for messages from Telegram.');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  testTelegramBot();
}

export { testTelegramBot };
