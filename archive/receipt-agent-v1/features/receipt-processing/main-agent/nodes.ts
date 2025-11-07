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

  // Get recent conversation history
  const recentHistory = (state.conversationHistory || [])
    .slice(-5)
    .map(m => `${m.role}: ${m.content}`)
    .join('\n');

  const prompt = `You are analyzing user intent in a financial assistant conversation.

Conversation history (last 5 messages):
${recentHistory || 'No previous messages'}

Current user input:
${state.currentUserMessage}

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
      lastActivityAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error analyzing intent:', error);
    return {
      currentIntent: 'general',
      lastActivityAt: new Date().toISOString()
    };
  }
}

/**
 * Routes to transaction sub-agent by preparing state
 */
export async function routeToTransactionNode(
  state: ConversationState
): Promise<Partial<ConversationState>> {
  // Use the image data from state
  const imageData = state.currentImageData;
  
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
      extractedData: {}, // Empty object - extraction node will handle it
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
    // Update the sub-agent state with new user context
    const updatedSubAgentState = {
      ...state.subAgentState,
      userProvidedContext: state.currentUserMessage.replace(/\[IMAGE\]/g, '').trim()
    };

    const result = await config.transactionAgent.invoke(
      updatedSubAgentState,
      {
        configurable: { 
          thread_id: state.subAgentThreadId 
        }
      }
    );

    // If transaction agent completed OR encountered an error, clear the active sub-agent
    // Only keep it active if explicitly waiting for user input (not completed, no error)
    const shouldKeepActive = !result.completed && !result.error;

    return {
      subAgentState: result,
      responseMessage: result.responseMessage || 'Processing complete',
      activeSubAgent: shouldKeepActive ? 'transaction' : null
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

  const recentHistory = (state.conversationHistory || [])
    .slice(-5)
    .map(m => `${m.role}: ${m.content}`)
    .join('\n');

  const prompt = `You are a helpful financial assistant. Respond naturally and conversationally.

Conversation history:
${recentHistory || 'No previous messages'}

User: ${state.currentUserMessage}

Provide a helpful, friendly response.`;

  try {
    const response = await llm.invoke(prompt);
    const content = typeof response.content === 'string' 
      ? response.content 
      : JSON.stringify(response.content);

    return {
      responseMessage: content
    };
  } catch (error) {
    console.error('Error in general conversation:', error);
    return {
      responseMessage: 'I apologize, but I encountered an error. How else can I help you?'
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
      subAgentState: null
    };
  }

  if (command.includes('help')) {
    const helpMessage = getContextualHelp(state);
    return {
      responseMessage: helpMessage
    };
  }

  if (command.includes('status')) {
    const statusMessage = getConversationStatus(state);
    return {
      responseMessage: statusMessage
    };
  }

  return {
    responseMessage: 'Unknown command. Try "help" for available commands.'
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
