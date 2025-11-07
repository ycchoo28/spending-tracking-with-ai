/**
 * Workflow State Manager
 * Manages pending workflows that are waiting for user input
 */

import { WorkflowState } from '../receipt-processing/workflow/types';
import { ExtractedTransaction } from '../receipt-processing/vision/vision-processor';

export type PendingWorkflowType = 
  | 'merchant_correction'
  | 'amount_correction'
  | 'category_selection'
  | 'retry_extraction';

export interface PendingWorkflow {
  userId: string;
  chatId: number;
  type: PendingWorkflowType;
  state: WorkflowState;
  extractedData?: ExtractedTransaction;
  errorMessage?: string;
  timestamp: number;
}

/**
 * Manages pending workflows waiting for user input
 */
export class WorkflowStateManager {
  private pendingWorkflows: Map<string, PendingWorkflow> = new Map();

  /**
   * Store a pending workflow that needs user input
   */
  setPending(userId: string, workflow: PendingWorkflow): void {
    this.pendingWorkflows.set(userId, workflow);
  }

  /**
   * Get a pending workflow for a user
   */
  getPending(userId: string): PendingWorkflow | undefined {
    return this.pendingWorkflows.get(userId);
  }

  /**
   * Check if a user has a pending workflow
   */
  hasPending(userId: string): boolean {
    return this.pendingWorkflows.has(userId);
  }

  /**
   * Clear a pending workflow
   */
  clearPending(userId: string): void {
    this.pendingWorkflows.delete(userId);
  }

  /**
   * Clean up old pending workflows (older than 1 hour)
   */
  cleanup(): void {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    for (const [userId, workflow] of this.pendingWorkflows.entries()) {
      if (workflow.timestamp < oneHourAgo) {
        this.pendingWorkflows.delete(userId);
      }
    }
  }
}
