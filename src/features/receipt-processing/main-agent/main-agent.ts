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
  updateHistoryNode
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
    currentImageData: Annotation<Buffer | null>,
    currentIntent: Annotation<string | null>,
    activeSubAgent: Annotation<string | null>,
    subAgentState: Annotation<any>,
    subAgentThreadId: Annotation<string | null>,
    responseMessage: Annotation<string>
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
    .addNode('update_history', updateHistoryNode);

  // Add edges
  workflow.addEdge('__start__', 'analyze_intent');

  // Conditional routing based on intent and active sub-agent
  workflow.addConditionalEdges(
    'analyze_intent',
    (state: any) => {
      // If there's already an active transaction sub-agent, continue with it
      if (state.activeSubAgent === 'transaction') {
        return 'continue_transaction';
      }
      // Otherwise, route based on intent
      return state.currentIntent || 'general';
    },
    {
      'transaction': 'route_to_transaction',
      'continue_transaction': 'invoke_transaction_agent',
      'general': 'handle_general',
      'command': 'handle_command'
    }
  );

  workflow.addEdge('route_to_transaction', 'invoke_transaction_agent');
  workflow.addEdge('invoke_transaction_agent', 'update_history');
  workflow.addEdge('handle_general', 'update_history');
  workflow.addEdge('handle_command', 'update_history');
  workflow.addEdge('update_history', '__end__');

  // Compile the graph
  const compiledGraph = workflow.compile({
    checkpointer: config?.checkpointer
  });

  return compiledGraph;
}
