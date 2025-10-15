import { StateGraph, END } from '@langchain/langgraph';
import { WorkflowState, WorkflowDependencies } from './types';
import {
  receiveImageNode,
  extractDataNode,
  categorizeNode,
  requestClarificationNode,
  storeTransactionNode,
  sendConfirmationNode,
} from './nodes';

/**
 * Node names for the workflow state machine
 */
export const NODE_NAMES = {
  RECEIVE_IMAGE: 'receive_image',
  EXTRACT_DATA: 'extract_data',
  CATEGORIZE: 'categorize',
  REQUEST_CLARIFICATION: 'request_clarification',
  STORE_TRANSACTION: 'store_transaction',
  SEND_CONFIRMATION: 'send_confirmation',
} as const;

/**
 * Conditional edge function to check if extraction is valid
 * Routes to categorize if valid, or ends workflow if invalid
 * @param state - Current workflow state
 * @returns Next node name or END
 */
export function isExtractionValid(state: WorkflowState): string {
  if (state.extractionValid) {
    return NODE_NAMES.CATEGORIZE;
  }
  // If extraction is invalid, end the workflow
  // The error will be handled by the Telegram bot
  return END;
}

/**
 * Conditional edge function to determine if clarification is needed
 * Routes to clarification if confidence is low, or directly to storage if high
 * @param state - Current workflow state
 * @returns Next node name
 */
export function shouldRequestClarification(state: WorkflowState): string {
  if (state.needsClarification) {
    return NODE_NAMES.REQUEST_CLARIFICATION;
  }
  return NODE_NAMES.STORE_TRANSACTION;
}

/**
 * Creates and configures the LangGraph state machine
 * @param deps - Workflow dependencies (processors, database, config)
 * @returns Compiled state graph ready for execution
 */
export function createWorkflowGraph(deps: WorkflowDependencies) {
  // Create the state graph with WorkflowState as the state schema
  const workflow = new StateGraph<WorkflowState>({
    channels: {
      telegramUserId: {
        value: (left?: string, right?: string) => right ?? left ?? '',
        default: () => '',
      },
      chatId: {
        value: (left?: number, right?: number) => right ?? left ?? 0,
        default: () => 0,
      },
      imageUrl: {
        value: (left?: string, right?: string) => right ?? left,
        default: () => undefined,
      },
      imageData: {
        value: (left?: Buffer, right?: Buffer) => right ?? left,
        default: () => undefined,
      },
      extractedData: {
        value: (left?: any, right?: any) => right ?? left,
        default: () => undefined,
      },
      category: {
        value: (left?: string, right?: string) => right ?? left,
        default: () => undefined,
      },
      confidence: {
        value: (left?: number, right?: number) => right ?? left,
        default: () => undefined,
      },
      suggestedCategories: {
        value: (left?: string[], right?: string[]) => right ?? left,
        default: () => undefined,
      },
      transactionId: {
        value: (left?: string, right?: string) => right ?? left,
        default: () => undefined,
      },
      error: {
        value: (left?: string, right?: string) => right ?? left,
        default: () => undefined,
      },
      errorType: {
        value: (left?: any, right?: any) => right ?? left,
        default: () => undefined,
      },
      awaitingUserInput: {
        value: (left?: boolean, right?: boolean) => right ?? left ?? false,
        default: () => false,
      },
      needsClarification: {
        value: (left?: boolean, right?: boolean) => right ?? left ?? false,
        default: () => false,
      },
      extractionValid: {
        value: (left?: boolean, right?: boolean) => right ?? left ?? false,
        default: () => false,
      },
      confirmationMessage: {
        value: (left?: string, right?: string) => right ?? left,
        default: () => undefined,
      },
    },
  });

  // Add nodes to the graph
  // Each node is a function that processes the state and returns updates
  workflow.addNode(NODE_NAMES.RECEIVE_IMAGE, async (state: WorkflowState) => {
    return await receiveImageNode(state);
  });

  workflow.addNode(NODE_NAMES.EXTRACT_DATA, async (state: WorkflowState) => {
    return await extractDataNode(state, deps);
  });

  workflow.addNode(NODE_NAMES.CATEGORIZE, async (state: WorkflowState) => {
    return await categorizeNode(state, deps);
  });

  workflow.addNode(NODE_NAMES.REQUEST_CLARIFICATION, async (state: WorkflowState) => {
    return await requestClarificationNode(state);
  });

  workflow.addNode(NODE_NAMES.STORE_TRANSACTION, async (state: WorkflowState) => {
    return await storeTransactionNode(state, deps);
  });

  workflow.addNode(NODE_NAMES.SEND_CONFIRMATION, async (state: WorkflowState) => {
    return await sendConfirmationNode(state);
  });

  // Define the workflow edges
  // Set the entry point
  workflow.setEntryPoint(NODE_NAMES.RECEIVE_IMAGE as any);

  // Linear edge: receive_image -> extract_data
  workflow.addEdge(NODE_NAMES.RECEIVE_IMAGE as any, NODE_NAMES.EXTRACT_DATA as any);

  // Conditional edge: extract_data -> categorize (if valid) or END (if invalid)
  workflow.addConditionalEdges(
    NODE_NAMES.EXTRACT_DATA as any,
    isExtractionValid,
    {
      [NODE_NAMES.CATEGORIZE]: NODE_NAMES.CATEGORIZE as any,
      [END]: END,
    }
  );

  // Conditional edge: categorize -> request_clarification (if low confidence) or store_transaction (if high confidence)
  workflow.addConditionalEdges(
    NODE_NAMES.CATEGORIZE as any,
    shouldRequestClarification,
    {
      [NODE_NAMES.REQUEST_CLARIFICATION]: NODE_NAMES.REQUEST_CLARIFICATION as any,
      [NODE_NAMES.STORE_TRANSACTION]: NODE_NAMES.STORE_TRANSACTION as any,
    }
  );

  // When clarification is requested, the workflow pauses and waits for user input
  // The Telegram bot will resume the workflow by directly calling store_transaction
  // So we add an edge from request_clarification to END (workflow pauses here)
  workflow.addEdge(NODE_NAMES.REQUEST_CLARIFICATION as any, END);

  // Linear edge: store_transaction -> send_confirmation
  workflow.addEdge(NODE_NAMES.STORE_TRANSACTION as any, NODE_NAMES.SEND_CONFIRMATION as any);

  // Linear edge: send_confirmation -> END
  workflow.addEdge(NODE_NAMES.SEND_CONFIRMATION as any, END);

  // Compile the graph
  const compiledGraph = workflow.compile();

  return compiledGraph;
}

/**
 * Helper function to resume workflow after user provides clarification
 * This creates a mini-graph that starts from store_transaction
 * @param deps - Workflow dependencies
 * @returns Compiled graph for resuming after clarification
 */
export function createResumptionGraph(deps: WorkflowDependencies) {
  const workflow = new StateGraph<WorkflowState>({
    channels: {
      telegramUserId: {
        value: (left?: string, right?: string) => right ?? left ?? '',
        default: () => '',
      },
      chatId: {
        value: (left?: number, right?: number) => right ?? left ?? 0,
        default: () => 0,
      },
      imageUrl: {
        value: (left?: string, right?: string) => right ?? left,
        default: () => undefined,
      },
      imageData: {
        value: (left?: Buffer, right?: Buffer) => right ?? left,
        default: () => undefined,
      },
      extractedData: {
        value: (left?: any, right?: any) => right ?? left,
        default: () => undefined,
      },
      category: {
        value: (left?: string, right?: string) => right ?? left,
        default: () => undefined,
      },
      confidence: {
        value: (left?: number, right?: number) => right ?? left,
        default: () => undefined,
      },
      suggestedCategories: {
        value: (left?: string[], right?: string[]) => right ?? left,
        default: () => undefined,
      },
      transactionId: {
        value: (left?: string, right?: string) => right ?? left,
        default: () => undefined,
      },
      error: {
        value: (left?: string, right?: string) => right ?? left,
        default: () => undefined,
      },
      errorType: {
        value: (left?: any, right?: any) => right ?? left,
        default: () => undefined,
      },
      awaitingUserInput: {
        value: (left?: boolean, right?: boolean) => right ?? left ?? false,
        default: () => false,
      },
      needsClarification: {
        value: (left?: boolean, right?: boolean) => right ?? left ?? false,
        default: () => false,
      },
      extractionValid: {
        value: (left?: boolean, right?: boolean) => right ?? left ?? false,
        default: () => false,
      },
      confirmationMessage: {
        value: (left?: string, right?: string) => right ?? left,
        default: () => undefined,
      },
    },
  });

  // Add only the nodes needed for resumption
  workflow.addNode(NODE_NAMES.STORE_TRANSACTION, async (state: WorkflowState) => {
    return await storeTransactionNode(state, deps);
  });

  workflow.addNode(NODE_NAMES.SEND_CONFIRMATION, async (state: WorkflowState) => {
    return await sendConfirmationNode(state);
  });

  // Set entry point to store_transaction
  workflow.setEntryPoint(NODE_NAMES.STORE_TRANSACTION as any);

  // Add edges
  workflow.addEdge(NODE_NAMES.STORE_TRANSACTION as any, NODE_NAMES.SEND_CONFIRMATION as any);
  workflow.addEdge(NODE_NAMES.SEND_CONFIRMATION as any, END);

  return workflow.compile();
}
