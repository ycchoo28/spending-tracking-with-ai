/**
 * Main Conversation Agent
 * 
 * The supervisor agent that manages conversation flow, analyzes intent,
 * and routes to appropriate sub-agents.
 */

import { StateGraph, Annotation } from '@langchain/langgraph';
import { ConversationState } from './types';
import {
  analyzeIntentNode,
  routeToTransactionNode,
  invokeTransactionAgentNode,
  handleGeneralNode,
  handleCommandNode,
  updateHistoryNode,
  checkContinuationNode
} from './nodes';
import { ChatOpenAI } from '@langchain/openai';

/**
 * Creates the main conversation agent workflow
 */
export function createMainAgent(config?: {
  llm?: ChatOpenAI;
  transactionAgent?: any;
  checkpointer?: any;
}) {
  // Define state annotation
  const StateAnnotation = Annotation.Root({
    conversationId: Annotation<string>,
    userId: Annotation<string>,
    chatId: Annotation<number>,
    createdAt: Annotation<string>,
    lastActivityAt: Annotation<string>,
    conversationHistory: Annotation<any[]>,
    currentUserMessage: Annotation<string>,
    injectedContext: Annotation<string[]>,
    currentIntent: Annotation<string | null>,
    activeSubAgent: Annotation<string | null>,
    subAgentState: Annotation<any>,
    subAgentThreadId: Annotation<string | null>,
    responseMessage: Annotation<string>,
    shouldContinue: Annotation<boolean>
  });

  // Create the graph
  const workflow = new StateGraph(StateAnnotation)
    .addNode('analyze_intent', async (state: ConversationState) => 
      analyzeIntentNode(state, { llm: config?.llm })
    )
    .addNode('handle_command', handleCommandNode)
    .addNode('handle_general', async (state: ConversationState) =>
      handleGeneralNode(state, { llm: config?.llm })
    )
    .addNode('route_to_transaction', routeToTransactionNode)
    .addNode('invoke_transaction_agent', async (state: ConversationState) =>
      invokeTransactionAgentNode(state, { transactionAgent: config?.transactionAgent })
    )
    .addNode('update_history', updateHistoryNode)
    .addNode('check_continuation', checkContinuationNode);

  // Add edges
  workflow.addEdge('__start__', 'analyze_intent');

  // Conditional routing based on intent
  workflow.addConditionalEdges(
    'analyze_intent',
    (state: any) => state.currentIntent || 'general',
    {
      'transaction': 'route_to_transaction',
      'general': 'handle_general',
      'command': 'handle_command'
    }
  );

  workflow.addEdge('route_to_transaction', 'invoke_transaction_agent');
  workflow.addEdge('invoke_transaction_agent', 'update_history');
  workflow.addEdge('handle_general', 'update_history');
  workflow.addEdge('handle_command', 'update_history');
  workflow.addEdge('update_history', 'check_continuation');

  // Conditional continuation
  workflow.addConditionalEdges(
    'check_continuation',
    (state: any) => state.shouldContinue ? 'continue' : 'end',
    {
      'continue': 'analyze_intent',
      'end': '__end__'
    }
  );

  // Compile the graph
  const compiledGraph = workflow.compile({
    checkpointer: config?.checkpointer
  });

  return compiledGraph;
}
