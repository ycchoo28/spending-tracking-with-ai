/**
 * Conversation Orchestrator
 * 
 * Manages message routing, agent execution, and context injection
 * for multi-turn conversations.
 */

import { ConversationState } from './main-agent/types';
import { ConversationManager } from '../../core/conversation/conversation-manager';

export interface UserMessage {
  content: string;
  imageData?: Buffer;
  metadata?: Record<string, any>;
}

export class ConversationOrchestrator {
  private mainAgent: any; // CompiledStateGraph type
  private conversationManager: ConversationManager;

  constructor(mainAgent: any, conversationManager: ConversationManager) {
    this.mainAgent = mainAgent;
    this.conversationManager = conversationManager;
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
    const startTime = Date.now();

    try {
      // Get or create conversation ID
      const conversationId = await this.getOrCreateConversation(userId, chatId);

      console.log(`[Orchestrator] Starting execution for user ${userId}, conversation ${conversationId}`);
      console.log(`[Orchestrator] Message: ${message.content.substring(0, 100)}${message.content.length > 100 ? '...' : ''}`);
      console.log(`[Orchestrator] Has image: ${!!message.imageData}`);

      // Update conversation activity
      await this.conversationManager.updateActivity(conversationId);
      await this.conversationManager.incrementTurnCount(conversationId);

      // Prepare initial state
      // Add [IMAGE] marker if image data is present so intent analyzer knows
      const messageWithImageMarker = message.imageData 
        ? `[IMAGE] ${message.content}`.trim()
        : message.content;

      const initialState: Partial<ConversationState> = {
        conversationId,
        userId,
        chatId,
        lastActivityAt: new Date().toISOString(),
        currentUserMessage: messageWithImageMarker,
        currentImageData: message.imageData || null,
        currentIntent: null,
        responseMessage: ''
      };

      console.log(`[Orchestrator] Invoking main agent...`);

      // Invoke main agent with consistent thread_id
      const result = await this.mainAgent.invoke(
        initialState,
        {
          configurable: { thread_id: conversationId }
        }
      );

      const duration = Date.now() - startTime;
      console.log(`[Orchestrator] Execution completed for user ${userId} (${duration}ms)`);
      console.log(`[Orchestrator] Response: ${result.responseMessage?.substring(0, 100)}${result.responseMessage && result.responseMessage.length > 100 ? '...' : ''}`);
      console.log(`[Orchestrator] Active sub-agent: ${result.activeSubAgent || 'none'}`);

      // Update active sub-agent tracking
      if (result.activeSubAgent) {
        await this.conversationManager.updateActiveSubAgent(conversationId, result.activeSubAgent);
      } else {
        // No active sub-agent means conversation is complete
        await this.conversationManager.updateStatus(conversationId, 'completed');
        console.log(`[Orchestrator] Conversation ${conversationId} marked as completed`);
      }

      return result.responseMessage || 'Processing complete';
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[Orchestrator] Error in agent execution for user ${userId} (${duration}ms):`, error);
      console.error(`[Orchestrator] Error stack:`, error instanceof Error ? error.stack : 'No stack trace');
      
      // Return user-friendly error message
      return '❌ An error occurred while processing your request. Please try again or contact support if the issue persists.';
    }
  }

  /**
   * Gets existing active conversation or creates a new one
   */
  private async getOrCreateConversation(
    userId: string,
    chatId: number
  ): Promise<string> {
    // Check for existing active conversations
    const activeConversations = await this.conversationManager.getActiveConversations(userId);

    if (activeConversations.length > 0) {
      // Reuse the most recent active conversation
      const conversation = activeConversations[0];
      console.log(`[Orchestrator] Reusing existing conversation: ${conversation.id} (turn ${conversation.turn_count + 1})`);
      return conversation.id;
    }

    // Create new conversation
    const conversationId = `conv_${userId}_${Date.now()}`;
    console.log(`[Orchestrator] Creating new conversation: ${conversationId}`);
    
    await this.conversationManager.createConversation(
      conversationId,
      userId,
      chatId,
      { source: 'telegram' }
    );

    return conversationId;
  }
}
