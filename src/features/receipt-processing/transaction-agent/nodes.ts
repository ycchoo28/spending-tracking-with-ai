/**
 * Transaction Sub-Agent Nodes
 * 
 * Node functions for the transaction processing sub-agent workflow.
 */

import { TransactionAgentState } from './types';
import { ChatOpenAI } from '@langchain/openai';

/**
 * Extracts transaction data from image if needed
 */
export async function extractIfNeededNode(
  state: TransactionAgentState,
  config?: { visionProcessor?: any }
): Promise<Partial<TransactionAgentState>> {
  // Only extract if we have image data and haven't extracted yet
  if (state.imageData && !state.extractedData?.merchantName) {
    try {
      if (!config?.visionProcessor) {
        throw new Error('Vision processor not configured');
      }

      const extracted = await config.visionProcessor.extractTransactionData(
        state.imageData
      );

      return {
        extractedData: extracted,
        retryCount: 0
      };
    } catch (error) {
      console.error('Extraction error:', error);
      return {
        error: 'Failed to extract transaction data',
        extractedData: {
          merchantName: '',
          amount: 0,
          currency: 'MYR',
          dateTime: new Date().toISOString(),
          paymentMethod: 'Unknown',
          transactionReference: '',
          category: '',
          confidence: 0
        }
      };
    }
  }

  // Initialize empty extracted data if no image
  if (!state.extractedData) {
    return {
      extractedData: {
        merchantName: '',
        amount: 0,
        currency: 'MYR',
        dateTime: new Date().toISOString(),
        paymentMethod: 'Unknown',
        transactionReference: '',
        category: '',
        confidence: 0
      }
    };
  }

  return {};
}

/**
 * Applies user-provided context to update transaction data
 */
export async function applyUserContextNode(
  state: TransactionAgentState,
  config?: { llm?: ChatOpenAI }
): Promise<Partial<TransactionAgentState>> {
  if (!state.userProvidedContext || state.userProvidedContext.trim() === '') {
    return {};
  }

  const llm = config?.llm || new ChatOpenAI({
    modelName: 'gpt-4o-mini',
    temperature: 0
  });

  const prompt = `Extract transaction details from user's message.

Current transaction data:
${JSON.stringify(state.extractedData, null, 2)}

User provided context:
"${state.userProvidedContext}"

Update the transaction data based on user's message. Only update fields that the user explicitly mentions.
Respond with JSON containing only the fields to update.

Example:
User: "This is from Starbucks"
Response: {"merchantName": "Starbucks"}

User: "The amount is 15.50"
Response: {"amount": 15.50}

User: "Starbucks coffee for 15.50"
Response: {"merchantName": "Starbucks", "amount": 15.50}

Respond with ONLY valid JSON, no other text.`;

  try {
    const response = await llm.invoke(prompt);
    const content = typeof response.content === 'string' 
      ? response.content 
      : JSON.stringify(response.content);
    
    const updates = JSON.parse(content);

    return {
      extractedData: {
        ...state.extractedData,
        ...updates
      }
    };
  } catch (error) {
    console.error('Error applying user context:', error);
    return {};
  }
}

/**
 * Validates transaction fields
 */
export async function validateFieldsNode(
  state: TransactionAgentState
): Promise<Partial<TransactionAgentState>> {
  const data = state.extractedData;

  const validationStatus = {
    merchant: !data.merchantName || 
              data.merchantName === '' || 
              data.merchantName === 'Unknown' || 
              data.merchantName === 'Unknown Merchant'
      ? 'missing' as const
      : data.merchantName.length < 2
      ? 'invalid' as const
      : 'valid' as const,

    amount: !data.amount || data.amount === 0
      ? 'missing' as const
      : data.amount < 0
      ? 'invalid' as const
      : 'valid' as const,

    category: !data.category || data.category === ''
      ? 'missing' as const
      : 'valid' as const
  };

  return { validationStatus };
}

/**
 * Agent decides next action based on current state
 */
export async function agentDecideActionNode(
  state: TransactionAgentState,
  config?: { llm?: ChatOpenAI }
): Promise<Partial<TransactionAgentState>> {
  const llm = config?.llm || new ChatOpenAI({
    modelName: 'gpt-4o-mini',
    temperature: 0
  });

  const prompt = `You are processing a transaction. Analyze the current state and decide the SINGLE next action.

Current transaction state:
- Merchant: ${state.extractedData.merchantName || 'MISSING'} (${state.validationStatus.merchant})
- Amount: ${state.extractedData.amount || 'MISSING'} (${state.validationStatus.amount})
- Category: ${state.extractedData.category || 'MISSING'} (${state.validationStatus.category})
- Extraction confidence: ${state.extractedData.confidence}

Available actions:
1. request_merchant - Ask user for merchant name
2. request_amount - Ask user for amount
3. request_category - Ask user to select category
4. categorize - Automatically categorize the transaction
5. store_transaction - Save transaction to database
6. request_better_image - Ask for clearer photo

Decision rules:
- ALWAYS prioritize merchant and amount before category (they are critical)
- If merchant is missing/invalid, choose request_merchant
- If amount is missing/invalid, choose request_amount
- If merchant and amount are valid but category is missing, choose categorize first
- Only choose store_transaction if ALL fields are valid
- Only choose request_better_image if extraction confidence < 0.3 and multiple fields are missing

Think step by step:
1. What fields are missing or invalid?
2. Which field is most critical?
3. Can I auto-categorize or do I need user input?
4. Are all fields valid enough to store?

Respond with ONLY the action name and a brief reason.
Format: ACTION_NAME | reason`;

  try {
    const response = await llm.invoke(prompt);
    const content = typeof response.content === 'string' 
      ? response.content 
      : JSON.stringify(response.content);
    
    const [action, reasoning] = content.split('|').map(s => s.trim());

    return {
      nextAction: action,
      agentReasoning: reasoning || 'No reasoning provided'
    };
  } catch (error) {
    console.error('Error in agent decision:', error);
    // Fallback logic
    if (state.validationStatus.merchant !== 'valid') {
      return { nextAction: 'request_merchant', agentReasoning: 'Merchant missing' };
    }
    if (state.validationStatus.amount !== 'valid') {
      return { nextAction: 'request_amount', agentReasoning: 'Amount missing' };
    }
    if (state.validationStatus.category !== 'valid') {
      return { nextAction: 'categorize', agentReasoning: 'Category missing' };
    }
    return { nextAction: 'store_transaction', agentReasoning: 'All fields valid' };
  }
}

/**
 * Requests merchant name from user
 */
export async function requestMerchantNode(
  state: TransactionAgentState
): Promise<Partial<TransactionAgentState>> {
  let message = '🏪 I couldn\'t identify the merchant name clearly.';

  if (state.extractedData.amount && state.extractedData.amount > 0) {
    message += `\n\n💰 Amount: ${state.extractedData.currency} ${state.extractedData.amount.toFixed(2)}`;
  }

  message += '\n\nCould you tell me the merchant name?';

  return {
    responseMessage: message,
    completed: false
  };
}

/**
 * Requests amount from user
 */
export async function requestAmountNode(
  state: TransactionAgentState
): Promise<Partial<TransactionAgentState>> {
  let message = '💰 I couldn\'t read the amount clearly.';

  if (state.extractedData.merchantName) {
    message += `\n\n🏪 Merchant: ${state.extractedData.merchantName}`;
  }

  message += '\n\nWhat was the total amount?';

  return {
    responseMessage: message,
    completed: false
  };
}

/**
 * Requests category selection from user
 */
export async function requestCategoryNode(
  state: TransactionAgentState
): Promise<Partial<TransactionAgentState>> {
  const categories = state.suggestedCategories.length > 0
    ? state.suggestedCategories
    : ['Food & Dining', 'Transportation', 'Shopping', 'Entertainment', 'Bills & Utilities', 'Other'];

  const amount = state.extractedData.amount || 0;
  const message = `📁 Please select a category for this transaction:

💰 Amount: ${state.extractedData.currency} ${amount.toFixed(2)}
🏪 Merchant: ${state.extractedData.merchantName}

Suggested categories:
${categories.map((c, i) => `${i + 1}. ${c}`).join('\n')}`;

  return {
    responseMessage: message,
    completed: false
  };
}

/**
 * Automatically categorizes the transaction
 */
export async function categorizeNode(
  state: TransactionAgentState,
  config?: { categorizer?: any; confidenceThreshold?: number }
): Promise<Partial<TransactionAgentState>> {
  if (!config?.categorizer) {
    // Fallback to simple categorization
    return {
      extractedData: {
        ...state.extractedData,
        category: 'Other'
      },
      categoryConfidence: 0.5,
      nextAction: 'request_category'
    };
  }

  try {
    const result = await config.categorizer.categorize(
      state.extractedData,
      state.userId
    );

    const threshold = config.confidenceThreshold || 0.8;

    // If confidence is too low, request user input
    if (result.confidence < threshold) {
      return {
        extractedData: {
          ...state.extractedData,
          category: result.category
        },
        suggestedCategories: result.suggestedCategories || [result.category],
        categoryConfidence: result.confidence,
        nextAction: 'request_category'
      };
    }

    // High confidence, accept the category
    return {
      extractedData: {
        ...state.extractedData,
        category: result.category
      },
      categoryConfidence: result.confidence
    };
  } catch (error) {
    console.error('Error categorizing:', error);
    return {
      extractedData: {
        ...state.extractedData,
        category: 'Other'
      },
      categoryConfidence: 0.5,
      nextAction: 'request_category'
    };
  }
}

/**
 * Stores the transaction to database
 */
export async function storeTransactionNode(
  state: TransactionAgentState,
  config?: { database?: any }
): Promise<Partial<TransactionAgentState>> {
  if (!config?.database) {
    return {
      error: 'Database not configured',
      responseMessage: '❌ Failed to save transaction. Database not configured.',
      completed: false
    };
  }

  try {
    const transactionId = await config.database.storeTransaction({
      user_id: state.userId,
      telegram_user_id: state.userId,
      amount: state.extractedData.amount,
      currency: state.extractedData.currency,
      merchant_name: state.extractedData.merchantName,
      category: state.extractedData.category,
      date_time: state.extractedData.dateTime,
      payment_method: state.extractedData.paymentMethod,
      transaction_reference: state.extractedData.transactionReference,
      confidence_score: state.categoryConfidence,
      extraction_confidence: state.extractedData.confidence,
      processing_status: 'completed',
      awaiting_user_input: false,
      retry_count: state.retryCount,
      workflow_execution_id: state.conversationId
    });

    const amount = state.extractedData.amount || 0;
    const message = `✅ Transaction saved!

🏪 ${state.extractedData.merchantName}
💰 ${state.extractedData.currency} ${amount.toFixed(2)}
📁 ${state.extractedData.category}
🆔 ${transactionId}`;

    return {
      transactionId,
      responseMessage: message,
      completed: true
    };
  } catch (error) {
    console.error('Error storing transaction:', error);
    return {
      error: 'Failed to store transaction',
      responseMessage: '❌ Failed to save transaction. Please try again.',
      completed: false
    };
  }
}

/**
 * Requests a better quality image
 */
export async function requestBetterImageNode(
  _state: TransactionAgentState
): Promise<Partial<TransactionAgentState>> {
  const message = `📷 The image quality is too low to extract transaction details.

💡 Tips for better results:
- Ensure good lighting
- Keep the receipt flat
- Capture the entire receipt
- Avoid shadows and glare

Please send a clearer photo.`;

  return {
    responseMessage: message,
    completed: false
  };
}
