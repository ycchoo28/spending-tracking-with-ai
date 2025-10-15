import { getConfig } from './src/config/config';
import { VisionProcessor } from './src/vision/vision-processor';
import { TransactionCategorizer } from './src/categorizer/categorizer';
import { DatabaseClient } from './src/database/database';
import { createWorkflowGraph, WorkflowDependencies } from './src/workflow';

/**
 * Test script to verify workflow graph creation
 */
async function testWorkflowCreation() {
  try {
    console.log('Loading configuration...');
    const config = getConfig();

    console.log('Initializing components...');
    
    // Initialize VisionProcessor
    const visionProcessor = new VisionProcessor({
      apiKey: config.openai.apiKey,
      apiBase: config.openai.apiBase,
      model: config.openai.visionModel,
      maxRetries: config.app.maxRetries,
      retryDelay: config.app.retryDelay,
    });

    // Initialize DatabaseClient
    const database = new DatabaseClient(
      config.supabase.url,
      config.supabase.key
    );

    // Initialize TransactionCategorizer
    const categorizer = new TransactionCategorizer(
      {
        apiKey: config.openai.apiKey,
        apiBase: config.openai.apiBase,
        model: config.openai.textModel,
        confidenceThreshold: config.app.confidenceThreshold,
      },
      database
    );

    // Create workflow dependencies
    const deps: WorkflowDependencies = {
      visionProcessor,
      categorizer,
      database,
      confidenceThreshold: config.app.confidenceThreshold,
      maxRetries: config.app.maxRetries,
      retryDelay: config.app.retryDelay,
    };

    console.log('Creating workflow graph...');
    const workflow = createWorkflowGraph(deps);

    console.log('✅ Workflow graph created successfully!');
    console.log('Workflow nodes:', Object.keys((workflow as any).nodes || {}));

    return workflow;
  } catch (error) {
    console.error('❌ Error creating workflow:', error);
    throw error;
  }
}

// Run the test
testWorkflowCreation()
  .then(() => {
    console.log('\n✅ All workflow tests passed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Workflow test failed:', error);
    process.exit(1);
  });
