/**
 * Main Conversation Agent Types
 * 
 * Defines the state and interfaces for the main conversation agent
 * that handles intent analysis, routing, and conversation management.
 */

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  metadata?: {
    intent?: string;
    subAgent?: string;
  };
}

export interface ConversationState {
  // Conversation metadata
  conversationId: string;
  userId: string;
  chatId: number;
  createdAt: string;
  lastActivityAt: string;
  
  // Conversation content
  conversationHistory: ConversationMessage[];
  currentUserMessage: string;
  injectedContext: string[];
  
  // Intent and routing
  currentIntent: 'transaction' | 'general' | 'command' | null;
  activeSubAgent: string | null;
  
  // Sub-agent coordination
  subAgentState: any;
  subAgentThreadId: string | null;
  
  // Response
  responseMessage: string;
  shouldContinue: boolean;
}
