/**
 * Conversation Orchestrator
 * 
 * Manages message routing, agent execution, and context injection
 * for multi-turn conversations.
 */

import { ConversationState } from './main-agent/types';

export interface UserMessage {
  content: string;
  imageData?: Buffer;
  metadata?: Record<string, any>;
}

export class ConversationOrchestrator {
  private mainAgent: any; // CompiledStateGraph type

  constructor(mainAgent: any) {
    this.mainAgent = mainAgent;
  }

  /**
   * Handles incoming user messages
   */
  async handleMessage(
    userId: string,
    chatId: number,
    message: UserMessage
  ): Promise<string> {
    return this.executeAgent(userId, chatId, message);
  }

  /**
   * Executes the agent for a user message
   */
  private async executeAgent(
    userId: string,
    chatId: number,
    message: UserMessage
  ): Promise<string> {
    // Generate conversation ID
    const conversationId = `conv_${userId}_${Date.now()}`;
    const startTime = Date.now();

    console.log(`[Orchestrator] Starting execution for user ${userId}, conversation ${conversationId}`);
    console.log(`[Orchestrator] Message: ${message.content.substring(0, 100)}${message.content.length > 100 ? '...' : ''}`);
    console.log(`[Orchestrator] Has image: ${!!message.imageData}`);

    try {
      // Prepare initial state
      // Add [IMAGE] marker if image data is present so intent analyzer knows
      const messageWithImageMarker = message.imageData 
        ? `[IMAGE] ${message.content}`.trim()
        : message.content;

      const initialState: Partial<ConversationState> = {
        conversationId,
        userId,
        chatId,
        createdAt: new Date().toISOString(),
        lastActivityAt: new Date().toISOString(),
        conversationHistory: [],
        currentUserMessage: messageWithImageMarker,
        currentImageData: message.imageData || null,
        currentIntent: null,
        activeSubAgent: null,
        subAgentState: null,
        subAgentThreadId: null,
        responseMessage: ''
      };

      console.log(`[Orchestrator] Invoking main agent...`);

      // Invoke main agent
      const result = await this.mainAgent.invoke(
        initialState,
        {
          configurable: { thread_id: conversationId }
        }
      );

      const duration = Date.now() - startTime;
      console.log(`[Orchestrator] Execution completed for user ${userId} (${duration}ms)`);
      console.log(`[Orchestrator] Response: ${result.responseMessage?.substring(0, 100)}${result.responseMessage && result.responseMessage.length > 100 ? '...' : ''}`);

      return result.responseMessage || 'Processing complete';
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[Orchestrator] Error in agent execution for user ${userId} (${duration}ms):`, error);
      console.error(`[Orchestrator] Error stack:`, error instanceof Error ? error.stack : 'No stack trace');
      
      // Return user-friendly error message
      return '❌ An error occurred while processing your request. Please try again or contact support if the issue persists.';
    }
  }
}
