/**
 * Main Conversation Agent Nodes
 * 
 * Node functions for the main conversation agent workflow.
 */

import { ConversationState } from './types';
import { ChatOpenAI } from '@langchain/openai';

/**
 * Analyzes user intent from the current message
 */
export async function analyzeIntentNode(
  state: ConversationState,
  config?: { llm?: ChatOpenAI }
): Promise<Partial<ConversationState>> {
  const llm = config?.llm || new ChatOpenAI({
    modelName: 'gpt-4o-mini',
    temperature: 0.7
  });

  // Combine current message with any injected context
  const allContext = [
    state.currentUserMessage,
    ...(state.injectedContext || [])
  ].filter(Boolean).join('\n');

  // Get recent conversation history
  const recentHistory = (state.conversationHistory || [])
    .slice(-5)
    .map(m => `${m.role}: ${m.content}`)
    .join('\n');

  const prompt = `You are analyzing user intent in a financial assistant conversation.

Conversation history (last 5 messages):
${recentHistory || 'No previous messages'}

Current user input:
${allContext}

Classify the intent as ONE of:
- transaction: User wants to process a receipt/transaction (has image or mentions transaction)
- general: General conversation, questions, or chat
- command: System commands (help, cancel, status)

Respond with ONLY the intent name (transaction, general, or command).`;

  try {
    const response = await llm.invoke(prompt);
    const content = typeof response.content === 'string' 
      ? response.content 
      : JSON.stringify(response.content);
    
    const intent = content.trim().toLowerCase() as ConversationState['currentIntent'];
    
    // Validate intent
    const validIntents = ['transaction', 'general', 'command'];
    const finalIntent = intent && validIntents.includes(intent) ? intent : 'general';

    return {
      currentIntent: finalIntent,
      lastActivityAt: new Date().toISOString(),
      injectedContext: [] // Clear after processing
    };
  } catch (error) {
    console.error('Error analyzing intent:', error);
    return {
      currentIntent: 'general',
      lastActivityAt: new Date().toISOString(),
      injectedContext: []
    };
  }
}

/**
 * Routes to transaction sub-agent by preparing state
 */
export async function routeToTransactionNode(
  state: ConversationState
): Promise<Partial<ConversationState>> {
  // Extract image data if present in current message
  const hasImage = state.currentUserMessage.includes('[IMAGE]');
  const imageData = hasImage ? extractImageData(state.currentUserMessage) : null;
  
  // Extract text content (remove image markers)
  const textContent = state.currentUserMessage.replace(/\[IMAGE\]/g, '').trim();
  
  const subAgentThreadId = `${state.conversationId}_transaction_${Date.now()}`;
  
  return {
    activeSubAgent: 'transaction',
    subAgentThreadId,
    subAgentState: {
      conversationId: state.conversationId,
      userId: state.userId,
      chatId: state.chatId,
      imageData,
      userProvidedContext: textContent,
      extractedData: {},
      validationStatus: {
        merchant: 'missing',
        amount: 'missing',
        category: 'missing'
      },
      nextAction: '',
      agentReasoning: '',
      suggestedCategories: [],
      categoryConfidence: 0,
      responseMessage: '',
      transactionId: null,
      completed: false,
      error: null,
      retryCount: 0
    }
  };
}

/**
 * Helper function to extract image data from message
 * (Placeholder - actual implementation depends on message format)
 */
function extractImageData(_message: string): Buffer | null {
  // This is a placeholder - actual implementation will depend on how images are passed
  // For now, return null
  return null;
}

/**
 * Invokes the transaction sub-agent
 */
export async function invokeTransactionAgentNode(
  state: ConversationState,
  config?: { transactionAgent?: any }
): Promise<Partial<ConversationState>> {
  if (!config?.transactionAgent) {
    return {
      responseMessage: 'Transaction agent not configured',
      activeSubAgent: null
    };
  }

  try {
    const result = await config.transactionAgent.invoke(
      state.subAgentState,
      {
        configurable: { 
          thread_id: state.subAgentThreadId 
        }
      }
    );

    return {
      subAgentState: result,
      responseMessage: result.responseMessage || 'Processing complete',
      activeSubAgent: result.completed ? null : 'transaction'
    };
  } catch (error) {
    console.error('Error invoking transaction agent:', error);
    return {
      responseMessage: 'An error occurred while processing the transaction.',
      activeSubAgent: null
    };
  }
}

/**
 * Handles general conversation
 */
export async function handleGeneralNode(
  state: ConversationState,
  config?: { llm?: ChatOpenAI }
): Promise<Partial<ConversationState>> {
  const llm = config?.llm || new ChatOpenAI({
    modelName: 'gpt-4o-mini',
    temperature: 0.7
  });

  const allContext = [
    state.currentUserMessage,
    ...(state.injectedContext || [])
  ].filter(Boolean).join('\n');

  const recentHistory = (state.conversationHistory || [])
    .slice(-5)
    .map(m => `${m.role}: ${m.content}`)
    .join('\n');

  const prompt = `You are a helpful financial assistant. Respond naturally and conversationally.

Conversation history:
${recentHistory || 'No previous messages'}

User: ${allContext}

Provide a helpful, friendly response.`;

  try {
    const response = await llm.invoke(prompt);
    const content = typeof response.content === 'string' 
      ? response.content 
      : JSON.stringify(response.content);

    return {
      responseMessage: content,
      shouldContinue: false,
      injectedContext: []
    };
  } catch (error) {
    console.error('Error in general conversation:', error);
    return {
      responseMessage: 'I apologize, but I encountered an error. How else can I help you?',
      shouldContinue: false,
      injectedContext: []
    };
  }
}

/**
 * Handles system commands
 */
export async function handleCommandNode(
  state: ConversationState
): Promise<Partial<ConversationState>> {
  const command = state.currentUserMessage.toLowerCase();

  if (command.includes('cancel')) {
    return {
      responseMessage: '❌ Cancelled. How else can I help you?',
      activeSubAgent: null,
      subAgentState: null,
      shouldContinue: false
    };
  }

  if (command.includes('help')) {
    const helpMessage = getContextualHelp(state);
    return {
      responseMessage: helpMessage,
      shouldContinue: false
    };
  }

  if (command.includes('status')) {
    const statusMessage = getConversationStatus(state);
    return {
      responseMessage: statusMessage,
      shouldContinue: false
    };
  }

  return {
    responseMessage: 'Unknown command. Try "help" for available commands.',
    shouldContinue: false
  };
}

/**
 * Updates conversation history
 */
export async function updateHistoryNode(
  state: ConversationState
): Promise<Partial<ConversationState>> {
  const newHistory = [
    ...(state.conversationHistory || []),
    {
      role: 'user' as const,
      content: state.currentUserMessage,
      timestamp: new Date().toISOString()
    },
    {
      role: 'assistant' as const,
      content: state.responseMessage,
      timestamp: new Date().toISOString(),
      metadata: {
        intent: state.currentIntent || undefined,
        subAgent: state.activeSubAgent || undefined
      }
    }
  ];

  // Limit to most recent 20 messages
  const limitedHistory = newHistory.slice(-20);

  return {
    conversationHistory: limitedHistory
  };
}

/**
 * Checks if conversation should continue
 */
export async function checkContinuationNode(
  state: ConversationState
): Promise<Partial<ConversationState>> {
  // Continue if there's an active sub-agent
  const shouldContinue = state.activeSubAgent !== null;

  return {
    shouldContinue
  };
}

/**
 * Helper: Get contextual help message
 */
function getContextualHelp(state: ConversationState): string {
  if (state.activeSubAgent === 'transaction') {
    return `📋 You're currently processing a transaction.

Available commands:
• cancel - Cancel the current transaction
• status - Check transaction status

You can also:
• Send a receipt image to process
• Provide transaction details manually`;
  }

  return `👋 Welcome to your financial assistant!

I can help you:
• Process receipt images
• Track your expenses
• Categorize transactions

Available commands:
• help - Show this message
• status - Check conversation status

Just send me a receipt image to get started!`;
}

/**
 * Helper: Get conversation status
 */
function getConversationStatus(state: ConversationState): string {
  const turnCount = state.conversationHistory?.length || 0;
  const activeAgent = state.activeSubAgent || 'none';

  let status = `📊 Conversation Status

Turn count: ${Math.floor(turnCount / 2)}
Active agent: ${activeAgent}
Created: ${new Date(state.createdAt).toLocaleString()}`;

  if (state.activeSubAgent === 'transaction') {
    status += '\n\n🔄 Currently processing a transaction...';
  }

  return status;
}
