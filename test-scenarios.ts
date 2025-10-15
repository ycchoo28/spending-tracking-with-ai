/**
 * Test Scenarios - Individual test execution examples
 * 
 * This file demonstrates how to run specific test scenarios
 * from the E2E test suite individually.
 */

import {
  testEWalletScreenshots,
  testPhysicalReceipts,
  testEdgeCases,
  testStatsCommand,
  testConcurrentUsers,
  testCompleteWorkflow,
} from './test-e2e';

// Parse command line arguments
const args = process.argv.slice(2);
const scenario = args[0];

async function runScenario() {
  console.log('\n🧪 Running Test Scenario\n');
  
  switch (scenario) {
    case 'ewallet':
      console.log('Testing E-wallet Screenshots...\n');
      await testEWalletScreenshots();
      break;
      
    case 'receipts':
      console.log('Testing Physical Receipts...\n');
      await testPhysicalReceipts();
      break;
      
    case 'edge':
      console.log('Testing Edge Cases...\n');
      await testEdgeCases();
      break;
      
    case 'stats':
      console.log('Testing Stats Command...\n');
      await testStatsCommand();
      break;
      
    case 'concurrent':
      console.log('Testing Concurrent Users...\n');
      await testConcurrentUsers();
      break;
      
    case 'workflow':
      console.log('Testing Complete Workflow...\n');
      await testCompleteWorkflow();
      break;
      
    default:
      console.log('Available test scenarios:');
      console.log('  ewallet    - Test e-wallet screenshots');
      console.log('  receipts   - Test physical receipts');
      console.log('  edge       - Test edge cases');
      console.log('  stats      - Test stats command');
      console.log('  concurrent - Test concurrent users');
      console.log('  workflow   - Test complete workflow');
      console.log('\nUsage: npx ts-node test-scenarios.ts <scenario>');
      console.log('Example: npx ts-node test-scenarios.ts ewallet\n');
      process.exit(1);
  }
  
  console.log('\n✅ Scenario completed\n');
}

runScenario()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Scenario failed:', error);
    process.exit(1);
  });
