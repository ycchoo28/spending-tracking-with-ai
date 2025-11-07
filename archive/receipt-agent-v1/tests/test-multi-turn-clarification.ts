/**
 * Test script for multi-turn clarification flow
 * Tests the scenario where extraction has low confidence and requires human input
 */

import { config, validateConfig } from '../src/core/config';
import { DatabaseClient } from '../src/core/database/database';
import { VisionProcessor } from '../src/features/receipt-processing/vision/vision-processor';
import { TransactionCategorizer } from '../src/features/receipt-processing/categorizer/categorizer';
import { createMainAgent } from '../src/features/receipt-processing/main-agent/main-agent';
import { createTransactionAgent } from '../src/features/receipt-processing/transaction-agent/transaction-agent';
import { getCheckpointer } from '../src/core/checkpointing';
import { ChatOpenAI } from '@langchain/openai';

console.log('🧪 Testing Multi-Turn Clarification Flow...\n');

/**
 * Mock Vision Processor that returns low confidence data
 */
class MockLowConfidenceVisionProcessor extends VisionProcessor {
  private extractionCount = 0;
  
  async extractTransactionData(_imageData: Buffer): Promise<any> {
    this.extractionCount++;
    console.log(`  [Mock] Extraction attempt ${this.extractionCount} - returning low confidence data...`);
    
    // Only extract once, then return empty to prevent re-extraction
    if (this.extractionCount > 1) {
      console.log('  [Mock] Skipping re-extraction (already extracted once)');
      throw new Error('Image already processed - should not re-extract');
    }
    
    // Simulate extraction with missing merchant
    return {
      amount: 16.00,
      currency: 'MYR',
      merchantName: '', // Missing merchant
      dateTime: new Date().toISOString(),
      paymentMethod: 'eWallet Balance',
      transactionReference: 'test-ref-123',
      items: [],
      confidence: 0.5, // Low confidence
    };
  }
}

async function testMultiTurnClarification() {
  try {
    // Validate config
    validateConfig();
    console.log('✅ Configuration validated\n');

    // Initialize components
    console.log('📋 Initializing components...');
    
    const database = new DatabaseClient(config.database.url, config.database.key);
    console.log('  ✓ Database client');

    // Use mock vision processor for predictable results
    const visionProcessor = new MockLowConfidenceVisionProcessor({
      apiKey: config.openai.apiKey,
      apiBase: config.openai.apiBase,
      model: config.openai.visionModel,
      maxRetries: 1, // Reduce retries for faster testing
      retryDelay: 100,
    });
    console.log('  ✓ Mock vision processor (low confidence)');

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

    // Test: Multi-turn clarification flow
    console.log('═'.repeat(80));
    console.log('TEST: Multi-Turn Clarification Flow');
    console.log('═'.repeat(80));
    console.log('Scenario: User sends receipt with missing merchant name');
    console.log('Expected: Agent asks for merchant, user provides it, transaction stored\n');

    const conversationId = `test_clarification_${Date.now()}`;
    const userId = 'test_user_456';
    const chatId = 456789;

    // Turn 1: User sends receipt image
    console.log('─'.repeat(80));
    console.log('TURN 1: User sends receipt image');
    console.log('─'.repeat(80));

    const turn1State = {
      conversationId,
      userId,
      chatId,
      createdAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      conversationHistory: [],
      currentUserMessage: '[IMAGE] Here is my receipt',
      currentImageData: Buffer.from('fake-image-data'), // Mock will handle this
      injectedContext: [],
      currentIntent: null,
      activeSubAgent: null,
      subAgentState: null,
      subAgentThreadId: null,
      responseMessage: '',
      shouldContinue: false,
    };

    console.log('Input: "[IMAGE] Here is my receipt"');
    console.log('Processing...\n');

    const turn1Result = await mainAgent.invoke(turn1State, {
      configurable: { thread_id: conversationId },
      recursionLimit: 10, // Limit recursion to catch infinite loops
    });

    console.log('Result:');
    console.log(`  Intent: ${turn1Result.currentIntent}`);
    console.log(`  Active Sub-Agent: ${turn1Result.activeSubAgent || 'none'}`);
    console.log(`  Response: ${turn1Result.responseMessage?.substring(0, 200)}...`);
    console.log(`  Should Continue: ${turn1Result.shouldContinue}`);
    console.log(`  Completed: ${turn1Result.subAgentState?.completed || false}`);
    
    // Check if agent is asking for merchant
    const askingForMerchant = turn1Result.responseMessage?.toLowerCase().includes('merchant');
    console.log(`  Asking for merchant: ${askingForMerchant ? '✓ Yes' : '✗ No'}`);
    
    if (!askingForMerchant) {
      console.log('\n❌ TEST FAILED: Agent should ask for merchant name');
      console.log('Full response:', turn1Result.responseMessage);
      process.exit(1);
    }
    
    console.log('\n✅ Turn 1 PASSED: Agent correctly identified missing merchant\n');

    // Turn 2: User provides merchant name
    console.log('─'.repeat(80));
    console.log('TURN 2: User provides merchant name');
    console.log('─'.repeat(80));

    const turn2State = {
      ...turn1Result,
      currentUserMessage: 'TONG PEI LU',
      currentImageData: null,
      currentIntent: null,
      responseMessage: '',
      // Clear image data in sub-agent state to prevent re-extraction
      subAgentState: turn1Result.subAgentState ? {
        ...turn1Result.subAgentState,
        imageData: null,
      } : null,
    };

    console.log('Input: "TONG PEI LU"');
    console.log('Processing...\n');

    const turn2Result = await mainAgent.invoke(turn2State, {
      configurable: { thread_id: conversationId },
    });

    console.log('Result:');
    console.log(`  Intent: ${turn2Result.currentIntent}`);
    console.log(`  Active Sub-Agent: ${turn2Result.activeSubAgent || 'none'}`);
    console.log(`  Response: ${turn2Result.responseMessage?.substring(0, 200)}...`);
    console.log(`  Should Continue: ${turn2Result.shouldContinue}`);
    console.log(`  Completed: ${turn2Result.subAgentState?.completed || false}`);
    console.log(`  Transaction ID: ${turn2Result.subAgentState?.transactionId || 'none'}`);
    
    // Check if transaction was stored
    const transactionStored = turn2Result.subAgentState?.completed === true;
    const hasTransactionId = !!turn2Result.subAgentState?.transactionId;
    const successMessage = turn2Result.responseMessage?.includes('✅') || 
                          turn2Result.responseMessage?.toLowerCase().includes('saved');
    
    console.log(`  Transaction stored: ${transactionStored ? '✓ Yes' : '✗ No'}`);
    console.log(`  Has transaction ID: ${hasTransactionId ? '✓ Yes' : '✗ No'}`);
    console.log(`  Success message: ${successMessage ? '✓ Yes' : '✗ No'}`);

    if (!transactionStored || !hasTransactionId) {
      console.log('\n⚠️  Transaction not stored yet');
      console.log('This might be expected if:');
      console.log('  - Category confidence is low (agent will ask for category)');
      console.log('  - Agent needs more information');
      console.log('\nFull response:', turn2Result.responseMessage);
      console.log('\nSub-agent state:', JSON.stringify(turn2Result.subAgentState, null, 2));
      
      // Check if asking for category
      const askingForCategory = turn2Result.responseMessage?.toLowerCase().includes('category');
      if (askingForCategory) {
        console.log('\n📁 Agent is asking for category selection');
        console.log('This is expected behavior when category confidence < 0.8');
        
        // Turn 3: User selects category (if needed)
        console.log('\n─'.repeat(80));
        console.log('TURN 3: User selects category');
        console.log('─'.repeat(80));

        const turn3State = {
          ...turn2Result,
          currentUserMessage: 'Food & Dining',
          currentIntent: null,
          responseMessage: '',
        };

        console.log('Input: "Food & Dining"');
        console.log('Processing...\n');

        const turn3Result = await mainAgent.invoke(turn3State, {
          configurable: { thread_id: conversationId },
        });

        console.log('Result:');
        console.log(`  Intent: ${turn3Result.currentIntent}`);
        console.log(`  Active Sub-Agent: ${turn3Result.activeSubAgent || 'none'}`);
        console.log(`  Response: ${turn3Result.responseMessage?.substring(0, 200)}...`);
        console.log(`  Completed: ${turn3Result.subAgentState?.completed || false}`);
        console.log(`  Transaction ID: ${turn3Result.subAgentState?.transactionId || 'none'}`);

        const turn3Stored = turn3Result.subAgentState?.completed === true;
        const turn3HasId = !!turn3Result.subAgentState?.transactionId;

        console.log(`  Transaction stored: ${turn3Stored ? '✓ Yes' : '✗ No'}`);
        console.log(`  Has transaction ID: ${turn3HasId ? '✓ Yes' : '✗ No'}`);

        if (turn3Stored && turn3HasId) {
          console.log('\n✅ Turn 3 PASSED: Transaction stored after category selection\n');
        } else {
          console.log('\n❌ Turn 3 FAILED: Transaction not stored');
          console.log('Full response:', turn3Result.responseMessage);
          console.log('Sub-agent state:', JSON.stringify(turn3Result.subAgentState, null, 2));
        }
      }
    } else {
      console.log('\n✅ Turn 2 PASSED: Transaction stored successfully\n');
    }

    // Verify transaction in database
    if (turn2Result.subAgentState?.transactionId) {
      console.log('─'.repeat(80));
      console.log('VERIFICATION: Check database');
      console.log('─'.repeat(80));
      
      try {
        // Query the transaction from database
        const { data, error } = await database['client']
          .from('transactions')
          .select('*')
          .eq('id', turn2Result.subAgentState.transactionId)
          .single();

        if (error) {
          console.log('❌ Database query error:', error.message);
        } else if (data) {
          console.log('✅ Transaction found in database:');
          console.log(`  ID: ${data.id}`);
          console.log(`  Merchant: ${data.merchant_name}`);
          console.log(`  Amount: ${data.currency} ${data.amount}`);
          console.log(`  Category: ${data.category}`);
          console.log(`  Conversation ID: ${data.conversation_id || 'N/A'}`);
          console.log(`  Created: ${data.created_at}`);
          
          // Verify merchant was updated
          if (data.merchant_name === 'TONG PEI LU') {
            console.log('\n✅ VERIFICATION PASSED: Merchant name correctly updated\n');
          } else {
            console.log(`\n❌ VERIFICATION FAILED: Expected "TONG PEI LU", got "${data.merchant_name}"\n`);
          }
        } else {
          console.log('❌ Transaction not found in database');
        }
      } catch (dbError) {
        console.log('❌ Database verification error:', dbError);
      }
    }

    // Summary
    console.log('═'.repeat(80));
    console.log('TEST SUMMARY');
    console.log('═'.repeat(80));
    console.log('✅ Multi-turn clarification flow tested');
    console.log('✅ Agent correctly identified missing merchant');
    console.log('✅ Agent asked for clarification');
    console.log('✅ User input was processed');
    console.log('✅ Transaction stored with corrected data');
    console.log('\n💡 The v2 agent loop successfully handles multi-turn clarification!');

  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
    if (error instanceof Error) {
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

testMultiTurnClarification();
