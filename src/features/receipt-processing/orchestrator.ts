/**
 * Conversation Orchestrator
 * 
 * Manages message routing, agent execution, and context injection
 * for multi-turn conversations.
 */

import { ConversationState } from './main-agent/types';
import { getCheckpointer } from '../../core/checkpointing';

export interface AgentExecutionState {
  userId: string;
  isProcessing: boolean;
  conversationId: string | null;
  startedAt: Date;
}

export interface UserMessage {
  content: string;
  imageData?: Buffer;
  metadata?: Record<string, any>;
}

export class ConversationOrchestrator {
  private activeExecutions: Map<string, AgentExecutionState> = new Map();
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
    const execution = this.activeExecutions.get(userId);

    // If agent is processing, inject context
    if (execution && execution.isProcessing) {
      await this.injectContext(userId, message.content);
      return 'Context added to ongoing processing...';
    }

    // Start new execution
    return this.startExecution(userId, chatId, message);
  }

  /**
   * Injects context into a running agent execution
   */
  private async injectContext(userId: string, context: string): Promise<void> {
    const execution = this.activeExecutions.get(userId);
    if (!execution || !execution.conversationId) {
      console.warn(`[Orchestrator] No active execution for user ${userId}`);
      return;
    }

    const startTime = Date.now();
    
    try {
      console.log(`[Orchestrator] Injecting context for user ${userId}, conversation ${execution.conversationId}`);
      
      const checkpointer = await getCheckpointer();
      
      // Load current checkpoint
      const config = { configurable: { thread_id: execution.conversationId } };
      const checkpoint = await checkpointer.get(config);
      
      if (!checkpoint) {
        console.warn(`[Orchestrator] No checkpoint found for conversation ${execution.conversationId}`);
        return;
      }

      // Add context to injectedContext array
      const currentState = checkpoint.channel_values as any;
      const updatedState = {
        ...currentState,
        injectedContext: [
          ...(currentState.injectedContext || []),
          context
        ]
      };

      // Save updated checkpoint
      const checkpointMetadata = checkpoint as any;
      await checkpointer.put(config, checkpoint, {
        ...checkpointMetadata.metadata,
        injectedContext: updatedState.injectedContext
      });

      const duration = Date.now() - startTime;
      console.log(`[Orchestrator] Context injected successfully for user ${userId} (${duration}ms)`);
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[Orchestrator] Error injecting context for user ${userId} (${duration}ms):`, error);
      throw new Error(`Failed to inject context: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Starts a new agent execution
   */
  private async startExecution(
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

    // Mark as processing
    this.activeExecutions.set(userId, {
      userId,
      isProcessing: true,
      conversationId,
      startedAt: new Date()
    });

    try {
      // Prepare initial state
      const initialState: Partial<ConversationState> = {
        conversationId,
        userId,
        chatId,
        createdAt: new Date().toISOString(),
        lastActivityAt: new Date().toISOString(),
        conversationHistory: [],
        currentUserMessage: message.content,
        injectedContext: [],
        currentIntent: null,
        activeSubAgent: null,
        subAgentState: null,
        subAgentThreadId: null,
        responseMessage: '',
        shouldContinue: false
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
    } finally {
      // Mark as not processing
      const execution = this.activeExecutions.get(userId);
      if (execution) {
        execution.isProcessing = false;
        const totalDuration = Date.now() - startTime;
        console.log(`[Orchestrator] Execution state updated for user ${userId} (total: ${totalDuration}ms)`);
      }
    }
  }

  /**
   * Checks if an agent is currently processing for a user
   */
  isProcessing(userId: string): boolean {
    const execution = this.activeExecutions.get(userId);
    return execution?.isProcessing || false;
  }

  /**
   * Gets the current execution state for a user
   */
  getExecutionState(userId: string): AgentExecutionState | undefined {
    return this.activeExecutions.get(userId);
  }

  /**
   * Clears execution state for a user
   */
  clearExecution(userId: string): void {
    this.activeExecutions.delete(userId);
  }
}
