/**
 * Transaction Sub-Agent Nodes
 * 
 * Node functions for the transaction processing sub-agent workflow.
 */

import { TransactionAgentState } from './types';
import { ChatOpenAI } from '@langchain/openai';

/**
 * Extracts transaction data from image if needed
 * Only extracts once - if data is missing after extraction, we request from user
 */
export async function extractIfNeededNode(
  state: TransactionAgentState,
  config?: { visionProcessor?: any }
): Promise<Partial<TransactionAgentState>> {
  // Check if we have extracted data already
  // If extractedData has any of the key fields defined (even if empty), we've already extracted
  const hasExtractedData = state.extractedData && 
                          Object.keys(state.extractedData).length > 0 &&
                          ('merchantName' in state.extractedData || 'amount' in state.extractedData);
  
  console.log('[extractIfNeededNode] State check:', {
    hasImageData: !!state.imageData,
    hasExtractedData,
    extractedDataKeys: state.extractedData ? Object.keys(state.extractedData) : []
  });

  // Only extract if we have image data and haven't extracted yet
  if (state.imageData && !hasExtractedData) {
    console.log('[extractIfNeededNode] Extracting from image...');
    try {
      if (!config?.visionProcessor) {
        throw new Error('Vision processor not configured');
      }

      const extracted = await config.visionProcessor.extractTransactionData(
        state.imageData
      );

      console.log('[extractIfNeededNode] Extraction result:', extracted);

      return {
        extractedData: extracted,
        retryCount: 0
      };
    } catch (error) {
      console.error('[extractIfNeededNode] Extraction error:', error);
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

  // Initialize empty extracted data if no image and no data yet
  if (!hasExtractedData) {
    console.log('[extractIfNeededNode] No image, initializing empty data');
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

  console.log('[extractIfNeededNode] Using existing extracted data');
  return {};
}

/**
 * Applies user-provided context to update transaction data
 */
export async function applyUserContextNode(
  state: TransactionAgentState,
  config?: { llm?: ChatOpenAI }
): Promise<Partial<TransactionAgentState>> {
  console.log('[applyUserContextNode] User context:', state.userProvidedContext);
  
  if (!state.userProvidedContext || state.userProvidedContext.trim() === '') {
    console.log('[applyUserContextNode] No user context, skipping');
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

User: "Here is my receipt" (no specific details)
Response: {}

Respond with ONLY valid JSON, no other text. If the user doesn't provide specific transaction details, return an empty object {}.`;

  try {
    const response = await llm.invoke(prompt);
    const content = typeof response.content === 'string' 
      ? response.content 
      : JSON.stringify(response.content);
    
    console.log('[applyUserContextNode] LLM response:', content);
    
    const updates = JSON.parse(content);

    console.log('[applyUserContextNode] Parsed updates:', updates);

    if (Object.keys(updates).length === 0) {
      console.log('[applyUserContextNode] No updates from user context');
      return {};
    }

    const updatedData = {
      ...state.extractedData,
      ...updates
    };

    console.log('[applyUserContextNode] Updated extracted data:', updatedData);

    return {
      extractedData: updatedData
    };
  } catch (error) {
    console.error('[applyUserContextNode] Error applying user context:', error);
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

  console.log('[validateFieldsNode] Validation result:', {
    merchant: `${data.merchantName} -> ${validationStatus.merchant}`,
    amount: `${data.amount} -> ${validationStatus.amount}`,
    category: `${data.category} -> ${validationStatus.category}`
  });

  return { validationStatus };
}

/**
 * Agent decides next action based on current state
 * Uses deterministic logic to ensure correct prioritization
 */
export async function agentDecideActionNode(
  state: TransactionAgentState,
  _config?: { llm?: ChatOpenAI }
): Promise<Partial<TransactionAgentState>> {
  console.log('[agentDecideActionNode] Current validation status:', state.validationStatus);
  console.log('[agentDecideActionNode] Extracted data:', {
    merchant: state.extractedData.merchantName,
    amount: state.extractedData.amount,
    category: state.extractedData.category
  });

  // Deterministic decision logic - prioritize critical fields first
  
  // 1. Check if image quality is too low (multiple fields missing with low confidence)
  const missingCount = Object.values(state.validationStatus).filter(v => v !== 'valid').length;
  const confidence = state.extractedData.confidence || 0;
  if (confidence < 0.3 && missingCount >= 2) {
    console.log('[agentDecideActionNode] Decision: request_better_image (low confidence + multiple missing)');
    return {
      nextAction: 'request_better_image',
      agentReasoning: 'Image quality too low, multiple fields missing'
    };
  }

  // 2. Merchant is critical - request if missing/invalid
  if (state.validationStatus.merchant !== 'valid') {
    console.log('[agentDecideActionNode] Decision: request_merchant');
    return {
      nextAction: 'request_merchant',
      agentReasoning: 'Merchant name is missing or invalid'
    };
  }

  // 3. Amount is critical - request if missing/invalid
  if (state.validationStatus.amount !== 'valid') {
    console.log('[agentDecideActionNode] Decision: request_amount');
    return {
      nextAction: 'request_amount',
      agentReasoning: 'Amount is missing or invalid'
    };
  }

  // 4. Category handling - auto-categorize if missing, request if exists but needs confirmation
  if (state.validationStatus.category !== 'valid') {
    // If category already exists (from previous categorization), request user confirmation
    if (state.extractedData.category && state.extractedData.category !== '') {
      console.log('[agentDecideActionNode] Decision: request_category (needs confirmation)');
      return {
        nextAction: 'request_category',
        agentReasoning: 'Category needs user confirmation'
      };
    }
    // Otherwise, try auto-categorization
    console.log('[agentDecideActionNode] Decision: categorize');
    return {
      nextAction: 'categorize',
      agentReasoning: 'Auto-categorizing transaction'
    };
  }

  // 5. All fields valid - store the transaction
  console.log('[agentDecideActionNode] Decision: store_transaction (all valid)');
  return {
    nextAction: 'store_transaction',
    agentReasoning: 'All fields validated, ready to store'
  };
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
