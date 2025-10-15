#!/usr/bin/env ts-node
/**
 * Memory profiling script
 * Run this to get detailed memory analysis
 * 
 * Usage:
 *   ts-node scripts/memory-profile.ts
 *   node --expose-gc -r ts-node/register scripts/memory-profile.ts
 */

import { MemoryMonitor } from '../src/core/utils/memory-monitor';

async function profileMemory() {
  console.log('🔍 Starting memory profiler...\n');

  const monitor = new MemoryMonitor(5000); // Check every 5 seconds
  monitor.start();

  // Simulate some work
  console.log('Running for 30 seconds...');
  console.log('Press Ctrl+C to stop early\n');

  // Set up graceful shutdown
  process.once('SIGINT', () => {
    console.log('\n\n🛑 Stopping profiler...\n');
    monitor.stop();
    process.exit(0);
  });

  // Run for 30 seconds
  await new Promise(resolve => setTimeout(resolve, 30000));

  console.log('\n✅ Profiling complete\n');
  monitor.stop();
}

profileMemory().catch(console.error);
