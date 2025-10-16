import { ConsoleAdapter } from './src/core/messaging/console-adapter';
import { UserContext, ImageInput } from './src/core/messaging/types';

// Simple test for console adapter
async function testConsoleAdapter() {
  console.log('🧪 Testing Console Adapter...');

  const adapter = new ConsoleAdapter({
    callbacks: {
      onImageReceived: async (context: UserContext, image: ImageInput) => {
        console.log(`📸 Image received from ${context.userId}: ${image.data.length} bytes`);
        
        // Simulate processing
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        await adapter.sendMessage(context, {
          text: '✅ Image processed successfully!'
        });

        await adapter.sendOptions(context, {
          text: 'Please select a category:',
          options: [
            { id: 'food', label: 'Food & Dining', value: 'food' },
            { id: 'transport', label: 'Transportation', value: 'transport' },
            { id: 'shopping', label: 'Shopping', value: 'shopping' }
          ]
        });
      },
      onTextReceived: async (context: UserContext, text: string) => {
        console.log(`💬 Text received from ${context.userId}: ${text}`);
        
        await adapter.sendMessage(context, {
          text: `You said: "${text}"`
        });
      },
      onOptionSelected: async (context: UserContext, optionId: string, optionValue: string) => {
        console.log(`🎯 Option selected: ${optionValue}`);
        
        await adapter.sendTransactionConfirmation(context, {
          amount: 15.50,
          currency: 'MYR',
          merchantName: 'Test Merchant',
          category: optionValue,
          dateTime: new Date().toISOString(),
          transactionId: 'test-123'
        });
      }
    }
  });

  console.log('✅ Console adapter test setup complete');
  console.log('💡 Try commands: image test.jpg, text hello, exit');
  
  await adapter.start();
}

testConsoleAdapter().catch(console.error);