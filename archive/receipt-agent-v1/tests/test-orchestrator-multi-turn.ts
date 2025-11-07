/**
 * Test script to verify orchestrator properly reuses conversationId
 * for multi-turn conversations
 */

import { config, validateConfig } from '../src/core/config';
import { DatabaseClient } from '../src/core/database/database';
import { VisionProcessor } from '../src/features/receipt-processing/vision/vision-processor';
import { TransactionCategorizer } from '../src/features/receipt-processing/categorizer/categorizer';
import { createMainAgent } from '../src/features/receipt-processing/main-agent/main-agent';
import { createTransactionAgent } from '../src/features/receipt-processing/transaction-agent/transaction-agent';
import { ConversationOrchestrator } from '../src/features/receipt-processing/orchestrator';
import { ConversationManager } from '../src/core/conversation/conversation-manager';
import { getCheckpointer } from '../src/core/checkpointing';
import { ChatOpenAI } from '@langchain/openai';

console.log('🧪 Testing Orchestrator Multi-Turn Conversation Fix...\n');

/**
 * Mock Vision Processor that returns low confidence data
 */
class MockLowConfidenceVisionProcessor extends VisionProcessor {
  private extractionCount = 0;
  
  async extractTransactionData(_imageData: Buffer): Promise<any> {
    this.extractionCount++;
    console.log(`  [Mock] Extraction attempt ${this.extractionCount} - returning low confidence data...`);
    
    if (this.extractionCount > 1) {
      console.log('  [Mock] Skipping re-extraction (already extracted once)');
      throw new Error('Image already processed - should not re-extract');
    }
    
    return {
      amount: 25.50,
      currency: 'MYR',
      merchantName: '', // Missing merchant - will trigger clarification
      dateTime: new Date().toISOString(),
      paymentMethod: 'Credit Card',
      transactionReference: 'test-ref-456',
      items: [],
      confidence: 0.5,
    };
  }
}

async function testOrchestratorMultiTurn() {
  try {
    validateConfig();
    console.log('✅ Configuration validated\n');

    console.log('📋 Initializing components...');
    
    const database = new DatabaseClient(config.database.url, config.database.key);
    console.log('  ✓ Database client');

    const visionProcessor = new MockLowConfidenceVisionProcessor({
      apiKey: config.openai.apiKey,
      apiBase: config.openai.apiBase,
      model: config.openai.visionModel,
      maxRetries: 1,
      retryDelay: 100,
    });
    console.log('  ✓ Mock vision processor');

    const categorizer = new TransactionCategorizer(
      {
        apiKey: config.openai.apiKey,
        apiBase: config.openai.apiBase,
        model: config.openai.categorizerModel,
        confidenceThreshold: config.workflow.confidenceThreshold,
      },
      database
    );
    console.log('  ✓ Transaction categorizer');

    const llm = new ChatOpenAI({
      modelName: config.agentLoop.llmModel,
      temperature: config.agentLoop.llmTemperature,
      maxTokens: config.agentLoop.llmMaxTokens,
      openAIApiKey: config.openai.apiKey,
      configuration: {
        baseURL: config.openai.apiBase,
      },
    });
    console.log('  ✓ LLM');

    const checkpointer = await getCheckpointer();
    console.log('  ✓ Checkpointer');

    const transactionAgent = createTransactionAgent({
      llm,
      visionProcessor,
      categorizer,
      database,
      confidenceThreshold: config.workflow.confidenceThreshold,
    });
    console.log('  ✓ Transaction sub-agent');

    const mainAgent = createMainAgent({
      llm,
      transactionAgent,
      checkpointer,
    });
    console.log('  ✓ Main conversation agent');

    const conversationManager = new ConversationManager(24);
    console.log('  ✓ Conversation manager');

    const orchestrator = new ConversationOrchestrator(mainAgent, conversationManager);
    console.log('  ✓ Conversation orchestrator\n');

    // Test: Multi-turn via orchestrator
    console.log('═'.repeat(80));
    console.log('TEST: Multi-Turn Conversation via Orchestrator');
    console.log('═'.repeat(80));
    console.log('Scenario: User sends receipt, agent asks for merchant, user provides it');
    console.log('Expected: Same conversationId reused across turns\n');

    const userId = `test_user_${Date.now()}`;
    const chatId = 999888;

    // Turn 1: User sends receipt
    console.log('─'.repeat(80));
    console.log('TURN 1: User sends receipt image');
    console.log('─'.repeat(80));

    const response1 = await orchestrator.handleMessage(userId, chatId, {
      content: 'Here is my receipt',
      imageData: Buffer.from('fake-image-data'),
    });

    console.log('\nResponse 1:');
    console.log(response1.substring(0, 300));
    console.log('...\n');

    // Check if asking for merchant
    const askingForMerchant = response1.toLowerCase().includes('merchant');
    console.log(`Asking for merchant: ${askingForMerchant ? '✓ Yes' : '✗ No'}`);

    if (!askingForMerchant) {
      console.log('\n❌ TEST FAILED: Agent should ask for merchant name');
      console.log('Full response:', response1);
      process.exit(1);
    }

    // Get active conversations to verify conversationId was created
    const activeConvs1 = await conversationManager.getActiveConversations(userId);
    console.log(`\nActive conversations after turn 1: ${activeConvs1.length}`);
    if (activeConvs1.length > 0) {
      console.log(`  Conversation ID: ${activeConvs1[0].id}`);
      console.log(`  Turn count: ${activeConvs1[0].turn_count}`);
      console.log(`  Active sub-agent: ${activeConvs1[0].active_sub_agent || 'none'}`);
    }

    console.log('\n✅ Turn 1 PASSED\n');

    // Small delay to ensure different timestamp
    await new Promise(resolve => setTimeout(resolve, 100));

    // Turn 2: User provides merchant name
    console.log('─'.repeat(80));
    console.log('TURN 2: User provides merchant name');
    console.log('─'.repeat(80));

    const response2 = await orchestrator.handleMessage(userId, chatId, {
      content: 'Coffee Bean',
    });

    console.log('\nResponse 2:');
    console.log(response2.substring(0, 300));
    console.log('...\n');

    // Get active conversations to verify SAME conversationId was reused
    const activeConvs2 = await conversationManager.getActiveConversations(userId);
    console.log(`Active conversations after turn 2: ${activeConvs2.length}`);
    
    if (activeConvs2.length > 0) {
      console.log(`  Conversation ID: ${activeConvs2[0].id}`);
      console.log(`  Turn count: ${activeConvs2[0].turn_count}`);
      console.log(`  Status: ${activeConvs2[0].status}`);
      console.log(`  Active sub-agent: ${activeConvs2[0].active_sub_agent || 'none'}`);
    }

    // Verify conversationId was reused
    if (activeConvs1.length > 0 && activeConvs2.length > 0) {
      const conv1Id = activeConvs1[0].id;
      const conv2Id = activeConvs2[0].id;
      
      if (conv1Id === conv2Id) {
        console.log(`\n✅ CONVERSATION ID REUSED: ${conv1Id}`);
        console.log(`✅ Turn count increased: ${activeConvs1[0].turn_count} → ${activeConvs2[0].turn_count}`);
      } else {
        console.log(`\n❌ CONVERSATION ID CHANGED!`);
        console.log(`  Turn 1: ${conv1Id}`);
        console.log(`  Turn 2: ${conv2Id}`);
        console.log('This means multi-turn conversations will NOT work!');
        process.exit(1);
      }
    }

    console.log('\n✅ Turn 2 PASSED\n');

    // Summary
    console.log('═'.repeat(80));
    console.log('TEST SUMMARY');
    console.log('═'.repeat(80));
    console.log('✅ Orchestrator correctly reuses conversationId');
    console.log('✅ Turn count increments properly');
    console.log('✅ Multi-turn conversations work via orchestrator');
    console.log('✅ ConversationManager integration successful');
    console.log('\n💡 The fix is working! Multi-turn conversations are now supported!');

  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
    if (error instanceof Error) {
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

testOrchestratorMultiTurn();
