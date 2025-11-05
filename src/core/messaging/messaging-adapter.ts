import { 
  UserContext, 
  ImageInput, 
  TextMessage, 
  OptionsMessage, 
  TransactionSummary,
  ErrorMessage 
} from './types';

// Re-export types for convenience
export type {
  UserContext, 
  ImageInput, 
  TextMessage, 
  OptionsMessage, 
  TransactionSummary,
  ErrorMessage 
};

/**
 * Abstract messaging adapter interface
 * All platform implementations must implement this interface
 */
export interface MessagingAdapter {
  /**
   * Initialize the adapter and start listening for messages
   */
  start(): Promise<void>;

  /**
   * Stop the adapter gracefully
   */
  stop(signal?: string): Promise<void>;

  /**
   * Send a simple text message to a user
   */
  sendMessage(context: UserContext, message: TextMessage): Promise<void>;

  /**
   * Send options/buttons for user to select
   */
  sendOptions(context: UserContext, message: OptionsMessage): Promise<void>;

  /**
   * Send a transaction confirmation
   */
  sendTransactionConfirmation(context: UserContext, transaction: TransactionSummary): Promise<void>;

  /**
   * Send an error message with helpful context
   */
  sendError(context: UserContext, error: ErrorMessage): Promise<void>;

  /**
   * Request text input from user with a prompt
   */
  requestTextInput(context: UserContext, prompt: string): Promise<void>;

  /**
   * Get platform-specific stats (optional)
   */
  getStats?(context: UserContext): Promise<any>;
}

/**
 * Callback handlers that the adapter will call when events occur
 */
export interface MessagingAdapterCallbacks {
  onImageReceived: (context: UserContext, image: ImageInput) => Promise<void>;
  onTextReceived: (context: UserContext, text: string) => Promise<void>;
  onOptionSelected: (context: UserContext, optionId: string, optionValue: string) => Promise<void>;
  onCommand?: (context: UserContext, command: string, args: string[]) => Promise<void>;
  
  // v2: Multi-turn conversation support
  onMessage?: (context: UserContext, message: string, imageData?: Buffer) => Promise<string>;
}