import { Client } from "langsmith";
import { config } from "../src/core/config";

// Get trace ID from command line argument
const traceId = process.argv[2];

if (!traceId) {
  console.error("❌ Error: Trace ID is required");
  console.log("\nUsage:");
  console.log("  npx tsx tests/fetch-trace.ts <trace-id>");
  console.log("\nExample:");
  console.log("  npx tsx tests/fetch-trace.ts 7244e9d8-126a-498e-bd96-9fd6450d336c");
  console.log("  npx tsx tests/fetch-trace.ts https://smith.langchain.com/public/abc123/r");
  process.exit(1);
}

// Extract trace ID from URL if provided
const extractTraceId = (input: string): string => {
  // If it's a URL, extract the trace ID
  const urlMatch = input.match(/\/public\/([^\/]+)/);
  if (urlMatch) {
    return urlMatch[1];
  }
  return input;
};

const actualTraceId = extractTraceId(traceId);

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

async function fetchTrace() {
  try {
    // Try to get the specific run
    
    console.log(`Fetching trace: ${actualTraceId}\n`);
    
    try {
      const run = await client.readRun(actualTraceId);
      console.log("=== TRACE FOUND ===");
      console.log(JSON.stringify(run, null, 2));
    } catch (error: any) {
      console.log("Could not fetch specific trace, listing recent runs instead...\n");
      
      const projectName = config.langsmith.project || "receipt-tracker-agent";
      console.log(`Using project: ${projectName}\n`);
      
      // List recent runs from the project
      const runs = await client.listRuns({
        projectName,
        limit: 50,
      });
      
      console.log("=== RECENT RUNS ===");
      const runsList: any[] = [];
      for await (const run of runs) {
        runsList.push(run);
      }
      
      console.log(`Total runs found: ${runsList.length}\n`);
      
      // Group by trace_id to find complete traces
      const traceMap = new Map<string, any[]>();
      runsList.forEach((run: any) => {
        const traceId = run.trace_id || run.id;
        if (!traceMap.has(traceId)) {
          traceMap.set(traceId, []);
        }
        traceMap.get(traceId)!.push(run);
      });
      
      console.log(`Unique traces: ${traceMap.size}\n`);
      
      // Show each trace
      let count = 0;
      for (const [traceId, traceRuns] of traceMap) {
        if (count >= 3) break; // Show first 3 traces
        count++;
        
        const rootRun = traceRuns.find(r => !r.parent_run_id) || traceRuns[0];
        
        console.log(`\n${"=".repeat(80)}`);
        console.log(`TRACE ${count}: ${traceId}`);
        console.log(`Root Run: ${rootRun.name}`);
        console.log(`Status: ${rootRun.status}`);
        console.log(`Start: ${rootRun.start_time}`);
        console.log(`Total Steps: ${traceRuns.length}`);
        console.log(`\nInputs:`, JSON.stringify(rootRun.inputs, null, 2).substring(0, 500));
        console.log(`\nOutputs:`, JSON.stringify(rootRun.outputs, null, 2).substring(0, 500));
        if (rootRun.error) console.log(`\nError: ${rootRun.error}`);
        
        console.log(`\nAll Steps in Trace:`);
        traceRuns
          .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
          .forEach((run, idx) => {
            console.log(`  ${idx + 1}. ${run.name} (${run.status}) - ${run.run_type}`);
          });
      }
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

fetchTrace();
