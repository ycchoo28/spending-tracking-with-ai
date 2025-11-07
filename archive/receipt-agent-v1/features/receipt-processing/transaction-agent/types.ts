/**
 * Transaction Sub-Agent Types
 * 
 * Defines the state and interfaces for the transaction processing sub-agent
 * that handles receipt extraction, validation, and storage.
 */

export interface ExtractedTransaction {
  merchantName: string;
  amount: number;
  currency: string;
  dateTime: string;
  paymentMethod: string;
  transactionReference: string;
  category: string;
  confidence: number;
}

export interface TransactionAgentState {
  // Context
  conversationId: string;
  userId: string;
  chatId: number;
  
  // Input data
  imageData: Buffer | null;
  userProvidedContext: string;
  
  // Extracted transaction data
  extractedData: Partial<ExtractedTransaction>;
  
  // Field validation
  validationStatus: {
    merchant: 'valid' | 'invalid' | 'missing';
    amount: 'valid' | 'invalid' | 'missing';
    category: 'valid' | 'invalid' | 'missing';
  };
  
  // Agent decision
  nextAction: string;
  agentReasoning: string;
  
  // Categorization
  suggestedCategories: string[];
  categoryConfidence: number;
  
  // Output
  responseMessage: string;
  transactionId: string | null;
  completed: boolean;
  
  // Error handling
  error: string | null;
  retryCount: number;
}
