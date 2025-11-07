/**
 * Platform-agnostic message types
 */

export interface UserContext {
  userId: string;           // Platform-agnostic user identifier
  sessionId: string;        // Platform-agnostic session identifier
  metadata?: Record<string, any>;  // Platform-specific metadata
}

export interface ImageInput {
  data: Buffer;             // Image binary data
  url?: string;             // Optional image URL
  mimeType?: string;        // Image MIME type
}

export interface TextMessage {
  text: string;             // Message content
  format?: 'plain' | 'markdown' | 'html';  // Text formatting
}

export interface OptionButton {
  id: string;               // Unique option identifier
  label: string;            // Display label
  value: string;            // Option value
}

export interface OptionsMessage {
  text: string;             // Prompt text
  options: OptionButton[];  // Available options
  allowMultiple?: boolean;  // Allow multiple selections
}

export interface TransactionSummary {
  amount: number;
  currency: string;
  merchantName: string;
  category: string;
  dateTime: string;
  paymentMethod?: string;
  transactionReference?: string;
  transactionId?: string;
}

export interface ErrorMessage {
  message: string;
  errorType?: 'extraction' | 'categorization' | 'storage' | 'validation' | 'network' | 'timeout' | 'unknown';
  suggestions?: string[];
}