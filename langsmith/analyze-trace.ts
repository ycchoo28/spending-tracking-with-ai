import { Client } from "langsmith";
import { config } from "../src/core/config";

// Get trace ID from command line argument
const traceIdInput = process.argv[2];

if (!traceIdInput) {
  console.error("❌ Error: Trace ID is required");
  console.log("\nUsage:");
  console.log("  npx tsx tests/analyze-trace.ts <trace-id>");
  console.log("\nExample:");
  console.log("  npx tsx tests/analyze-trace.ts 7244e9d8-126a-498e-bd96-9fd6450d336c");
  console.log("  npx tsx tests/analyze-trace.ts https://smith.langchain.com/public/abc123/r");
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

async function analyzeTrace() {
  
  console.log(`Analyzing trace: ${traceId}\n`);
  
  const projectName = config.langsmith.project || "receipt-tracker-agent";
  console.log(`Using project: ${projectName}\n`);
  
  const runs = await client.listRuns({
    projectName,
    limit: 100,
  });
  
  const runsList: any[] = [];
  for await (const run of runs) {
    if (run.trace_id === traceId || run.id === traceId) {
      runsList.push(run);
    }
  }
  
  // Sort by start time
  runsList.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  
  console.log(`Total steps: ${runsList.length}\n`);
  console.log("=".repeat(80));
  
  // Key steps to analyze
  const keySteps = [
    "analyze_intent",
    "extract_if_needed", 
    "agent_decide_action",
    "categorize",
    "store_transaction",
  ];
  
  for (const stepName of keySteps) {
    const step = runsList.find(r => r.name === stepName);
    if (step) {
      console.log(`\n### ${stepName.toUpperCase()} ###`);
      console.log(`Status: ${step.status}`);
      console.log(`Duration: ${step.end_time ? (new Date(step.end_time).getTime() - new Date(step.start_time).getTime()) : 'N/A'}ms`);
      console.log(`\nInputs:`);
      console.log(JSON.stringify(step.inputs, null, 2));
      console.log(`\nOutputs:`);
      console.log(JSON.stringify(step.outputs, null, 2));
      if (step.error) {
        console.log(`\nError: ${step.error}`);
      }
      console.log("\n" + "=".repeat(80));
    }
  }
  
  // Show all LLM calls
  const llmCalls = runsList.filter(r => r.run_type === "llm");
  console.log(`\n\n### LLM CALLS (${llmCalls.length}) ###\n`);
  llmCalls.forEach((call, idx) => {
    console.log(`${idx + 1}. ${call.name}`);
    console.log(`   Prompt tokens: ${call.prompt_tokens || 'N/A'}`);
    console.log(`   Completion tokens: ${call.completion_tokens || 'N/A'}`);
    console.log(`   Duration: ${call.end_time ? (new Date(call.end_time).getTime() - new Date(call.start_time).getTime()) : 'N/A'}ms`);
    if (call.inputs?.messages) {
      const lastMsg = call.inputs.messages[call.inputs.messages.length - 1];
      console.log(`   Last message: ${JSON.stringify(lastMsg).substring(0, 200)}...`);
    }
    if (call.outputs) {
      console.log(`   Response: ${JSON.stringify(call.outputs).substring(0, 200)}...`);
    }
    console.log();
  });
}

analyzeTrace();