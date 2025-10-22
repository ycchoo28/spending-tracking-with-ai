/**
 * Send confirmation node - Formats confirmation message
 */

import { WorkflowState } from '../types';

/**
 * Format a user-friendly confirmation message
 * @param state - Current workflow state
 * @returns Formatted confirmation message
 */
function formatConfirmationMessage(state: WorkflowState): string {
  const data = state.extractedData!;
  const category = state.category!;

  // Format date/time
  const dateTime = new Date(data.dateTime);
  const formattedDate = dateTime.toLocaleDateString('en-MY', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  const formattedTime = dateTime.toLocaleTimeString('en-MY', {
    hour: '2-digit',
    minute: '2-digit',
  });

  // Build message
  let message = '✅ Transaction recorded successfully!\n\n';
  message += `💰 Amount: ${data.currency} ${data.amount.toFixed(2)}\n`;
  message += `🏪 Merchant: ${data.merchantName}\n`;
  message += `📁 Category: ${category}\n`;
  message += `📅 Date: ${formattedDate}\n`;
  message += `🕐 Time: ${formattedTime}\n`;

  if (data.paymentMethod) {
    message += `💳 Payment: ${data.paymentMethod}\n`;
  }

  if (data.transactionReference) {
    message += `🔖 Reference: ${data.transactionReference}\n`;
  }

  // Add items if available
  if (data.items && data.items.length > 0) {
    message += '\n📝 Items:\n';
    data.items.forEach((item) => {
      message += `  • ${item.name} (${item.quantity}x) - ${data.currency} ${item.price.toFixed(2)}\n`;
    });
  }

  if (state.transactionId) {
    message += `\n🆔 Transaction ID: ${state.transactionId}`;
  }

  return message;
}

/**
 * Format confirmation message for the user
 * @param state - Current workflow state
 * @returns Updated state with confirmation message
 */
export async function sendConfirmationNode(
  state: WorkflowState
): Promise<Partial<WorkflowState>> {
  try {
    if (!state.extractedData || !state.category) {
      return {
        error: 'Missing required data for confirmation',
        errorType: 'validation',
      };
    }

    // Format the confirmation message
    const message = formatConfirmationMessage(state);

    return {
      confirmationMessage: message,
      error: undefined,
      errorType: undefined,
    };
  } catch (error) {
    return {
      error: `Failed to format confirmation: ${(error as Error).message}`,
      errorType: 'unknown',
    };
  }
}
