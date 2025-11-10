import { Client } from "langsmith";
import { config } from "../src/core/config";

// Get trace ID from command line argument
const traceIdInput = process.argv[2];

if (!traceIdInput) {
  console.error("❌ Error: Trace ID is required");
  console.log("\nUsage:");
  console.log("  npx tsx tests/trace-summary.ts <trace-id>");
  console.log("\nExample:");
  console.log("  npx tsx tests/trace-summary.ts 7244e9d8-126a-498e-bd96-9fd6450d336c");
  console.log("  npx tsx tests/trace-summary.ts https://smith.langchain.com/public/abc123/r");
  process.exit(1);
}

// Extract trace ID from URL if provided
const extractTraceId = (input: string): string => {
  const urlMatch = input.match(/\/public\/([^\/]+)/);
  if (urlMatch) {
    return urlMatch[1];
  }
  return input;
};

const traceId = extractTraceId(traceIdInput);

// Check if LangSmith API key is configured
if (!config.langsmith.apiKey) {
  console.error("❌ Error: LANGSMITH_API_KEY not configured");
  console.log("\nPlease set LANGSMITH_API_KEY in your .env file:");
  console.log("  LANGSMITH_API_KEY=your_api_key_here");
  process.exit(1);
}

const client = new Client({
  apiKey: config.langsmith.apiKey,
});

async function getTraceSummary() {
  
  const projectName = config.langsmith.project || "receipt-tracker-agent";
  
  const runs = await client.listRuns({
    projectName,
    limit: 100,
  });
  
  const runsList = [];
  for await (const run of runs) {
    if (run.trace_id === traceId || run.id === traceId) {
      runsList.push(run);
    }
  }
  
  runsList.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  
  const rootRun = runsList.find(r => !r.parent_run_id) || runsList[0];
  const startTime = new Date(rootRun.start_time);
  const endTime = rootRun.end_time ? new Date(rootRun.end_time) : new Date();
  const totalDuration = endTime.getTime() - startTime.getTime();
  
  console.log("╔" + "═".repeat(78) + "╗");
  console.log("║" + " ".repeat(25) + "TRACE SUMMARY" + " ".repeat(40) + "║");
  console.log("╚" + "═".repeat(78) + "╝\n");
  
  console.log(`Trace ID: ${traceId}`);
  console.log(`Status: ${rootRun.status}`);
  console.log(`Total Duration: ${(totalDuration / 1000).toFixed(2)}s`);
  console.log(`Total Steps: ${runsList.length}`);
  console.log(`Start Time: ${startTime.toISOString()}`);
  console.log(`End Time: ${endTime.toISOString()}\n`);
  
  // Extract key information
  const analyzeIntent = runsList.find(r => r.name === "analyze_intent");
  const extractData = runsList.find(r => r.name === "extract_if_needed");
  const categorize = runsList.find(r => r.name === "categorize");
  const storeTransaction = runsList.find(r => r.name === "store_transaction");
  const agentDecisions = runsList.filter(r => r.name === "agent_decide_action");
  
  console.log("═".repeat(80));
  console.log("EXECUTION FLOW");
  console.log("═".repeat(80) + "\n");
  
  if (analyzeIntent?.outputs) {
    console.log("1️⃣  ANALYZE INTENT");
    console.log(`   Intent detected: ${JSON.stringify(analyzeIntent.outputs)}`);
    console.log(`   Duration: ${analyzeIntent.end_time ? ((new Date(analyzeIntent.end_time).getTime() - new Date(analyzeIntent.start_time).getTime()) / 1000).toFixed(2) : 'N/A'}s\n`);
  }
  
  if (extractData?.outputs) {
    console.log("2️⃣  EXTRACT DATA FROM IMAGE");
    const output = extractData.outputs;
    console.log(`   Extracted data:`);
    console.log(`   ${JSON.stringify(output, null, 2).split('\n').join('\n   ')}`);
    console.log(`   Duration: ${extractData.end_time ? ((new Date(extractData.end_time).getTime() - new Date(extractData.start_time).getTime()) / 1000).toFixed(2) : 'N/A'}s\n`);
  }
  
  console.log(`3️⃣  AGENT DECISIONS (${agentDecisions.length} iterations)`);
  agentDecisions.forEach((decision, idx) => {
    if (decision.outputs) {
      console.log(`   Decision ${idx + 1}: ${JSON.stringify(decision.outputs).substring(0, 150)}`);
    }
  });
  console.log();
  
  if (categorize?.outputs) {
    console.log("4️⃣  CATEGORIZE TRANSACTION");
    console.log(`   Category result:`);
    console.log(`   ${JSON.stringify(categorize.outputs, null, 2).split('\n').join('\n   ')}`);
    console.log(`   Duration: ${categorize.end_time ? ((new Date(categorize.end_time).getTime() - new Date(categorize.start_time).getTime()) / 1000).toFixed(2) : 'N/A'}s\n`);
  }
  
  if (storeTransaction?.outputs) {
    console.log("5️⃣  STORE TRANSACTION");
    console.log(`   Result:`);
    console.log(`   ${JSON.stringify(storeTransaction.outputs, null, 2).split('\n').join('\n   ')}`);
    console.log(`   Duration: ${storeTransaction.end_time ? ((new Date(storeTransaction.end_time).getTime() - new Date(storeTransaction.start_time).getTime()) / 1000).toFixed(2) : 'N/A'}s\n`);
  }
  
  // LLM usage stats
  const llmCalls = runsList.filter(r => r.run_type === "llm");
  const totalPromptTokens = llmCalls.reduce((sum, call) => sum + (call.prompt_tokens || 0), 0);
  const totalCompletionTokens = llmCalls.reduce((sum, call) => sum + (call.completion_tokens || 0), 0);
  const totalLLMTime = llmCalls.reduce((sum, call) => {
    if (call.end_time) {
      return sum + (new Date(call.end_time).getTime() - new Date(call.start_time).getTime());
    }
    return sum;
  }, 0);
  
  console.log("═".repeat(80));
  console.log("LLM USAGE STATISTICS");
  console.log("═".repeat(80) + "\n");
  console.log(`Total LLM Calls: ${llmCalls.length}`);
  console.log(`Total Prompt Tokens: ${totalPromptTokens.toLocaleString()}`);
  console.log(`Total Completion Tokens: ${totalCompletionTokens.toLocaleString()}`);
  console.log(`Total Tokens: ${(totalPromptTokens + totalCompletionTokens).toLocaleString()}`);
  console.log(`Total LLM Time: ${(totalLLMTime / 1000).toFixed(2)}s`);
  console.log(`LLM Time % of Total: ${((totalLLMTime / totalDuration) * 100).toFixed(1)}%\n`);
  
  // Show conversation context
  if (analyzeIntent?.inputs?.conversationHistory) {
    console.log("═".repeat(80));
    console.log("CONVERSATION CONTEXT");
    console.log("═".repeat(80) + "\n");
    const history = analyzeIntent.inputs.conversationHistory;
    console.log(`Messages in history: ${history.length}`);
    history.slice(-6).forEach((msg: any, idx: number) => {
      console.log(`${msg.role === 'user' ? '👤' : '🤖'} ${msg.role}: ${msg.content.substring(0, 80)}`);
    });
  }
  
  console.log("\n" + "═".repeat(80));
  console.log("View full trace at:");
  console.log(`https://smith.langchain.com/public/${traceId}/r`);
  console.log("═".repeat(80));
}

getTraceSummary();
