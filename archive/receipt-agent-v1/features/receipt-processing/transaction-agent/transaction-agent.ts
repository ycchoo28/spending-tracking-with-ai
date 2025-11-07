/**
 * Transaction Sub-Agent
 * 
 * The specialized agent that processes receipt transactions with
 * adaptive decision-making and field validation.
 */

import { StateGraph, Annotation } from '@langchain/langgraph';
import { TransactionAgentState } from './types';
import {
  extractIfNeededNode,
  applyUserContextNode,
  validateFieldsNode,
  agentDecideActionNode,
  requestMerchantNode,
  requestAmountNode,
  requestCategoryNode,
  categorizeNode,
  storeTransactionNode,
  requestBetterImageNode
} from './nodes';
import { ChatOpenAI } from '@langchain/openai';

/**
 * Creates the transaction sub-agent workflow
 */
export function createTransactionAgent(config?: {
  llm?: ChatOpenAI;
  visionProcessor?: any;
  categorizer?: any;
  database?: any;
  confidenceThreshold?: number;
}) {
  // Define state annotation
  const StateAnnotation = Annotation.Root({
    conversationId: Annotation<string>,
    userId: Annotation<string>,
    chatId: Annotation<number>,
    imageData: Annotation<Buffer | null>,
    userProvidedContext: Annotation<string>,
    extractedData: Annotation<any>,
    validationStatus: Annotation<any>,
    nextAction: Annotation<string>,
    agentReasoning: Annotation<string>,
    suggestedCategories: Annotation<string[]>,
    categoryConfidence: Annotation<number>,
    responseMessage: Annotation<string>,
    transactionId: Annotation<string | null>,
    completed: Annotation<boolean>,
    error: Annotation<string | null>,
    retryCount: Annotation<number>
  });

  // Create the graph
  const workflow = new StateGraph(StateAnnotation)
    .addNode('extract_if_needed', async (state: TransactionAgentState) =>
      extractIfNeededNode(state, { visionProcessor: config?.visionProcessor })
    )
    .addNode('apply_user_context', async (state: TransactionAgentState) =>
      applyUserContextNode(state, { llm: config?.llm })
    )
    .addNode('validate_fields', validateFieldsNode)
    .addNode('agent_decide_action', async (state: TransactionAgentState) =>
      agentDecideActionNode(state, { llm: config?.llm })
    )
    .addNode('request_merchant', requestMerchantNode)
    .addNode('request_amount', requestAmountNode)
    .addNode('request_category', requestCategoryNode)
    .addNode('categorize', async (state: TransactionAgentState) =>
      categorizeNode(state, {
        categorizer: config?.categorizer,
        confidenceThreshold: config?.confidenceThreshold
      })
    )
    .addNode('store_transaction', async (state: TransactionAgentState) =>
      storeTransactionNode(state, { database: config?.database })
    )
    .addNode('request_better_image', requestBetterImageNode);

  // Add edges
  workflow.addEdge('__start__', 'extract_if_needed');
  workflow.addEdge('extract_if_needed', 'apply_user_context');
  workflow.addEdge('apply_user_context', 'validate_fields');
  workflow.addEdge('validate_fields', 'agent_decide_action');

  // Dynamic routing based on agent decision
  workflow.addConditionalEdges(
    'agent_decide_action',
    (state: TransactionAgentState) => state.nextAction,
    {
      'request_merchant': 'request_merchant',
      'request_amount': 'request_amount',
      'request_category': 'request_category',
      'categorize': 'categorize',
      'store_transaction': 'store_transaction',
      'request_better_image': 'request_better_image'
    }
  );

  // After categorization, check if we need to request category or can proceed to store
  workflow.addConditionalEdges(
    'categorize',
    (state: TransactionAgentState) => {
      // If categorize node set nextAction to request_category, respect that
      if (state.nextAction === 'request_category') {
        return 'request_category';
      }
      // Otherwise, go back to validation to check if we can store
      return 'validate_fields';
    },
    {
      'request_category': 'request_category',
      'validate_fields': 'validate_fields'
    }
  );

  // End edges for completion and waiting states
  workflow.addEdge('request_merchant', '__end__');
  workflow.addEdge('request_amount', '__end__');
  workflow.addEdge('request_category', '__end__');
  workflow.addEdge('store_transaction', '__end__');
  workflow.addEdge('request_better_image', '__end__');

  // Compile the graph
  const compiledGraph = workflow.compile();

  return compiledGraph;
}
