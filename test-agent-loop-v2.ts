/**
 * Test script for v2 Agent Loop
 * Tests the multi-turn conversation flow with adaptive decision-making
 */

import { config, validateConfig } from './src/core/config';
import { DatabaseClient } from './src/core/database/database';
import { VisionProcessor } from './src/features/receipt-processing/vision/vision-processor';
import { TransactionCategorizer } from './src/features/receipt-processing/categorizer/categorizer';
import { createMainAgent } from './src/features/receipt-processing/main-agent/main-agent';
import { createTransactionAgent } from './src/features/receipt-processing/transaction-agent/transaction-agent';
import { getCheckpointer } from './src/core/checkpointing';
import { ChatOpenAI } from '@langchain/openai';
import * as fs from 'fs';

console.log('🧪 Testing v2 Agent Loop...\n');

async function testAgentLoop() {
  try {
    // Validate config
    validateConfig();
    console.log('✅ Configuration validated\n');

    // Initialize components
    console.log('📋 Initializing components...');
    
    const database = new DatabaseClient(config.database.url, config.database.key);
    console.log('  ✓ Database client');

    const visionProcessor = new VisionProcessor({
      apiKey: config.openai.apiKey,
      apiBase: config.openai.apiBase,
      model: config.openai.visionModel,
      maxRetries: config.workflow.maxRetries,
      retryDelay: config.workflow.retryDelay,
    });
    console.log('  ✓ Vision processor');

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
    console.log('  ✓ Main conversation agent\n');

    // Test 1: Simple intent analysis
    console.log('═'.repeat(80));
    console.log('TEST 1: Intent Analysis');
    console.log('═'.repeat(80));
    
    const conversationId = `test_${Date.now()}`;
    const userId = 'test_user_123';
    const chatId = 123456;

    const testState1 = {
      conversationId,
      userId,
      chatId,
      createdAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      conversationHistory: [],
      currentUserMessage: 'Hello, how are you?',
      currentImageData: null,
      injectedContext: [],
      currentIntent: null,
      activeSubAgent: null,
      subAgentState: null,
      subAgentThreadId: null,
      responseMessage: '',
      shouldContinue: false,
    };

    console.log('Input: "Hello, how are you?"');
    console.log('Expected: general intent\n');

    const result1 = await mainAgent.invoke(testState1, {
      configurable: { thread_id: conversationId },
    });

    console.log('Result:');
    console.log(`  Intent: ${result1.currentIntent}`);
    console.log(`  Response: ${result1.responseMessage?.substring(0, 100)}...`);
    console.log(`  Should Continue: ${result1.shouldContinue}`);
    console.log(`  ✓ Test 1 ${result1.currentIntent === 'general' ? 'PASSED' : 'FAILED'}\n`);

    // Test 2: Transaction intent with image marker (without actual processing)
    console.log('═'.repeat(80));
    console.log('TEST 2: Transaction Intent Detection');
    console.log('═'.repeat(80));

    const testState2 = {
      conversationId: `test_${Date.now()}`,
      userId,
      chatId,
      createdAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      conversationHistory: [],
      currentUserMessage: '[IMAGE] Here is my receipt',
      currentImageData: null, // Set to null to skip actual image processing
      injectedContext: [],
      currentIntent: null,
      activeSubAgent: null,
      subAgentState: null,
      subAgentThreadId: null,
      responseMessage: '',
      shouldContinue: false,
    };

    console.log('Input: "[IMAGE] Here is my receipt"');
    console.log('Expected: transaction intent (routing only, no image processing)\n');

    // We'll only test intent analysis and routing, not the full transaction flow
    // since that would require a real image
    const result2 = await mainAgent.invoke(testState2, {
      configurable: { thread_id: testState2.conversationId },
    });

    console.log('Result:');
    console.log(`  Intent: ${result2.currentIntent}`);
    console.log(`  Active Sub-Agent: ${result2.activeSubAgent || 'none'}`);
    console.log(`  Sub-Agent Thread ID: ${result2.subAgentThreadId ? '✓ Set' : '✗ Not set'}`);
    console.log(`  Response: ${result2.responseMessage?.substring(0, 100) || 'N/A'}...`);
    console.log(`  ✓ Test 2 ${result2.currentIntent === 'transaction' ? 'PASSED' : 'FAILED'}\n`);

    // Test 3: Command handling
    console.log('═'.repeat(80));
    console.log('TEST 3: Command Handling');
    console.log('═'.repeat(80));

    const testState3 = {
      conversationId: `test_${Date.now()}`,
      userId,
      chatId,
      createdAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      conversationHistory: [],
      currentUserMessage: 'help',
      currentImageData: null,
      injectedContext: [],
      currentIntent: null,
      activeSubAgent: null,
      subAgentState: null,
      subAgentThreadId: null,
      responseMessage: '',
      shouldContinue: false,
    };

    console.log('Input: "help"');
    console.log('Expected: command intent with help message\n');

    const result3 = await mainAgent.invoke(testState3, {
      configurable: { thread_id: testState3.conversationId },
    });

    console.log('Result:');
    console.log(`  Intent: ${result3.currentIntent}`);
    console.log(`  Response includes "help": ${result3.responseMessage?.toLowerCase().includes('help') ? '✓ Yes' : '✗ No'}`);
    console.log(`  Should Continue: ${result3.shouldContinue}`);
    console.log(`  ✓ Test 3 ${result3.currentIntent === 'command' ? 'PASSED' : 'FAILED'}\n`);

    // Test 4: Conversation history persistence
    console.log('═'.repeat(80));
    console.log('TEST 4: Conversation History Persistence');
    console.log('═'.repeat(80));

    const persistConvId = `test_persist_${Date.now()}`;
    
    // First message
    const testState4a = {
      conversationId: persistConvId,
      userId,
      chatId,
      createdAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      conversationHistory: [],
      currentUserMessage: 'My name is Alice',
      currentImageData: null,
      injectedContext: [],
      currentIntent: null,
      activeSubAgent: null,
      subAgentState: null,
      subAgentThreadId: null,
      responseMessage: '',
      shouldContinue: false,
    };

    console.log('Message 1: "My name is Alice"');
    const result4a = await mainAgent.invoke(testState4a, {
      configurable: { thread_id: persistConvId },
    });
    console.log(`  Response: ${result4a.responseMessage?.substring(0, 80)}...`);
    console.log(`  History length: ${result4a.conversationHistory?.length || 0}`);

    // Second message (should have context from first)
    const testState4b = {
      ...result4a,
      currentUserMessage: 'What is my name?',
      currentIntent: null,
      responseMessage: '',
    };

    console.log('\nMessage 2: "What is my name?"');
    console.log('Expected: Response should reference "Alice"\n');
    
    const result4b = await mainAgent.invoke(testState4b, {
      configurable: { thread_id: persistConvId },
    });

    console.log('Result:');
    console.log(`  Response: ${result4b.responseMessage?.substring(0, 100)}...`);
    console.log(`  History length: ${result4b.conversationHistory?.length || 0}`);
    console.log(`  Contains "Alice": ${result4b.responseMessage?.includes('Alice') ? '✓ Yes' : '✗ No'}`);
    console.log(`  ✓ Test 4 ${result4b.responseMessage?.includes('Alice') ? 'PASSED' : 'FAILED'}\n`);

    // Summary
    console.log('═'.repeat(80));
    console.log('TEST SUMMARY');
    console.log('═'.repeat(80));
    console.log('✅ All basic agent loop tests completed');
    console.log('\n💡 Next steps:');
    console.log('  1. Test with real receipt images');
    console.log('  2. Test multi-turn transaction flow');
    console.log('  3. Test context injection during processing');
    console.log('  4. Test error handling and recovery');
    console.log('\n📝 To test with real images, use the Telegram bot or console adapter');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testAgentLoop();
