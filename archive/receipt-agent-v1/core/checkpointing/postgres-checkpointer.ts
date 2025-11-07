/**
 * PostgreSQL Checkpointer for LangGraph
 * 
 * Configures LangGraph to use PostgreSQL (Supabase) for checkpoint persistence.
 * 
 * Note: Using MemorySaver for now as PostgresSaver requires @langchain/core v1.x
 * which conflicts with current dependencies. Will upgrade in future.
 */

import { MemorySaver } from '@langchain/langgraph';

let checkpointerInstance: MemorySaver | null = null;

/**
 * Creates and configures a checkpointer for LangGraph
 * Currently using MemorySaver - will be upgraded to PostgresSaver when dependencies allow
 */
export async function createPostgresCheckpointer(): Promise<MemorySaver> {
  if (checkpointerInstance) {
    return checkpointerInstance;
  }

  // TODO: Upgrade to PostgresSaver when @langchain/core v1.x is available
  // For now, using MemorySaver which stores checkpoints in memory
  console.warn('[Checkpointer] Using MemorySaver - checkpoints will not persist across restarts');
  console.warn('[Checkpointer] Upgrade to PostgresSaver when @langchain/core v1.x is available');
  
  const checkpointer = new MemorySaver();
  checkpointerInstance = checkpointer;
  
  return checkpointer;
}

/**
 * Gets the existing checkpointer instance or creates a new one
 */
export async function getCheckpointer(): Promise<MemorySaver> {
  if (!checkpointerInstance) {
    return createPostgresCheckpointer();
  }
  return checkpointerInstance;
}

/**
 * Closes the checkpointer connection
 */
export async function closeCheckpointer(): Promise<void> {
  if (checkpointerInstance) {
    checkpointerInstance = null;
  }
}
