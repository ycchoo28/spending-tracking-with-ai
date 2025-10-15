/**
 * Test script for TransactionCategorizer
 * 
 * This script tests the categorization functionality with sample data
 */

import { TransactionCategorizer, CATEGORIES } from './src/categorizer';
import { DatabaseClient } from './src/database';
import { ExtractedTransaction } from './src/vision';
import { getConfig } from './src/config/config';

async function testCategorizer() {
  console.log('🧪 Testing TransactionCategorizer...\n');

  try {
    // Load configuration
    const config = getConfig();

    // Initialize database client
    const db = new DatabaseClient(
      config.supabase.url,
      config.supabase.key
    );

    // Initialize categorizer
    const categorizer = new TransactionCategorizer(
      {
        apiKey: config.openai.apiKey,
        apiBase: config.openai.apiBase,
        model: config.openai.textModel,
        confidenceThreshold: config.app.confidenceThreshold,
      },
      db
    );

    console.log('✅ TransactionCategorizer initialized successfully\n');
    console.log(`📋 Available categories: ${CATEGORIES.join(', ')}\n`);

    // Test case 1: Restaurant transaction
    console.log('Test 1: Restaurant Transaction');
    console.log('--------------------------------');
    const restaurantTransaction: ExtractedTransaction = {
      amount: 45.50,
      currency: 'MYR',
      merchantName: 'Nando\'s Restaurant',
      dateTime: new Date().toISOString(),
      paymentMethod: 'Credit Card',
      items: [
        { name: 'Peri-Peri Chicken', price: 28.00, quantity: 1 },
        { name: 'Coleslaw', price: 8.50, quantity: 1 },
        { name: 'Soft Drink', price: 9.00, quantity: 1 },
      ],
      confidence: 0.95,
    };

    const result1 = await categorizer.categorize(
      restaurantTransaction,
      'test_user_123'
    );

    console.log(`Merchant: ${restaurantTransaction.merchantName}`);
    console.log(`Amount: ${restaurantTransaction.currency} ${restaurantTransaction.amount}`);
    console.log(`Category: ${result1.category}`);
    console.log(`Confidence: ${(result1.confidence * 100).toFixed(1)}%`);
    if (result1.suggestedCategories) {
      console.log(`Suggestions: ${result1.suggestedCategories.join(', ')}`);
    }
    console.log();

    // Test case 2: E-wallet transaction (Grab)
    console.log('Test 2: E-wallet Transaction (Grab)');
    console.log('------------------------------------');
    const grabTransaction: ExtractedTransaction = {
      amount: 12.30,
      currency: 'MYR',
      merchantName: 'Grab',
      dateTime: new Date().toISOString(),
      paymentMethod: 'GrabPay',
      confidence: 0.90,
    };

    const result2 = await categorizer.categorize(
      grabTransaction,
      'test_user_123'
    );

    console.log(`Merchant: ${grabTransaction.merchantName}`);
    console.log(`Amount: ${grabTransaction.currency} ${grabTransaction.amount}`);
    console.log(`Category: ${result2.category}`);
    console.log(`Confidence: ${(result2.confidence * 100).toFixed(1)}%`);
    if (result2.suggestedCategories) {
      console.log(`Suggestions: ${result2.suggestedCategories.join(', ')}`);
    }
    console.log();

    // Test case 3: Ambiguous merchant
    console.log('Test 3: Ambiguous Merchant');
    console.log('--------------------------');
    const ambiguousTransaction: ExtractedTransaction = {
      amount: 89.90,
      currency: 'MYR',
      merchantName: 'ABC Store',
      dateTime: new Date().toISOString(),
      paymentMethod: 'DuitNow',
      confidence: 0.85,
    };

    const result3 = await categorizer.categorize(
      ambiguousTransaction,
      'test_user_123'
    );

    console.log(`Merchant: ${ambiguousTransaction.merchantName}`);
    console.log(`Amount: ${ambiguousTransaction.currency} ${ambiguousTransaction.amount}`);
    console.log(`Category: ${result3.category}`);
    console.log(`Confidence: ${(result3.confidence * 100).toFixed(1)}%`);
    if (result3.suggestedCategories) {
      console.log(`Suggestions: ${result3.suggestedCategories.join(', ')}`);
    }
    console.log();

    console.log('✅ All tests completed successfully!');
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testCategorizer();
