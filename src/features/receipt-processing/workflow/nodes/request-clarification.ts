/**
 * Request clarification node - Prepares clarification request for user
 */

import { WorkflowState } from '../types';

/**
 * Prepare clarification message for user when confidence is low
 * This node sets up the state for requesting user input
 * @param state - Current workflow state
 * @returns Updated state with clarification request prepared
 */
export async function requestClarificationNode(
  state: WorkflowState
): Promise<Partial<WorkflowState>> {
  try {
    if (!state.extractedData) {
      return {
        error: 'No extracted data available for clarification',
        errorType: 'validation',
      };
    }

    // Set flag to indicate we're waiting for user input
    // The Telegram bot handler will use this to send interactive message
    return {
      awaitingUserInput: true,
      error: undefined,
      errorType: undefined,
    };
  } catch (error) {
    return {
      error: `Failed to prepare clarification request: ${(error as Error).message}`,
      errorType: 'unknown',
      awaitingUserInput: false,
    };
  }
}
