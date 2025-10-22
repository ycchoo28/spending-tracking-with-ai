/**
 * Receive image node - Entry point for the workflow
 */

import { WorkflowState } from '../types';

/**
 * Initialize state with image data
 * This is the entry point node for the workflow
 * @param state - Current workflow state
 * @returns Updated state with image data initialized
 */
export async function receiveImageNode(
  state: WorkflowState
): Promise<Partial<WorkflowState>> {
  try {
    // Validate that we have image data
    if (!state.imageData) {
      return {
        error: 'No image data provided',
        errorType: 'validation',
        extractionValid: false,
      };
    }

    // Initialize workflow flags
    return {
      awaitingUserInput: false,
      needsClarification: false,
      extractionValid: false,
      error: undefined,
      errorType: undefined,
    };
  } catch (error) {
    return {
      error: `Failed to receive image: ${(error as Error).message}`,
      errorType: 'unknown',
      extractionValid: false,
    };
  }
}
