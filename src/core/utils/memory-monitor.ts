import { logger } from './logger';

export interface MemoryStats {
  rss: number; // Resident Set Size - total memory allocated
  heapTotal: number; // Total heap size
  heapUsed: number; // Heap actually used
  external: number; // Memory used by C++ objects bound to JS
  arrayBuffers: number; // Memory for ArrayBuffers and SharedArrayBuffers
  timestamp: number;
}

export interface MemorySnapshot {
  current: MemoryStats;
  peak: MemoryStats;
  average: MemoryStats;
  samples: number;
}

/**
 * Memory monitoring utility for tracking RAM consumption
 */
export class MemoryMonitor {
  private intervalId?: NodeJS.Timeout;
  private samples: MemoryStats[] = [];
  private peakMemory: MemoryStats;
  private startTime: number;
  private monitoringInterval: number;

  constructor(intervalMs: number = 30000) {
    this.monitoringInterval = intervalMs;
    this.startTime = Date.now();
    this.peakMemory = this.getCurrentMemory();
  }

  /**
   * Get current memory usage
   */
  private getCurrentMemory(): MemoryStats {
    const usage = process.memoryUsage();
    return {
      rss: usage.rss,
      heapTotal: usage.heapTotal,
      heapUsed: usage.heapUsed,
      external: usage.external,
      arrayBuffers: usage.arrayBuffers,
      timestamp: Date.now(),
    };
  }

  /**
   * Format bytes to human-readable format
   */
  private formatBytes(bytes: number): string {
    const mb = bytes / 1024 / 1024;
    return `${mb.toFixed(2)} MB`;
  }

  /**
   * Update peak memory if current is higher
   */
  private updatePeak(current: MemoryStats): void {
    if (current.rss > this.peakMemory.rss) {
      this.peakMemory = current;
    }
  }

  /**
   * Calculate average memory from samples
   */
  private calculateAverage(): MemoryStats {
    if (this.samples.length === 0) {
      return this.getCurrentMemory();
    }

    const sum = this.samples.reduce(
      (acc, sample) => ({
        rss: acc.rss + sample.rss,
        heapTotal: acc.heapTotal + sample.heapTotal,
        heapUsed: acc.heapUsed + sample.heapUsed,
        external: acc.external + sample.external,
        arrayBuffers: acc.arrayBuffers + sample.arrayBuffers,
        timestamp: 0,
      }),
      { rss: 0, heapTotal: 0, heapUsed: 0, external: 0, arrayBuffers: 0, timestamp: 0 }
    );

    const count = this.samples.length;
    return {
      rss: sum.rss / count,
      heapTotal: sum.heapTotal / count,
      heapUsed: sum.heapUsed / count,
      external: sum.external / count,
      arrayBuffers: sum.arrayBuffers / count,
      timestamp: Date.now(),
    };
  }

  /**
   * Start monitoring memory usage
   */
  start(): void {
    if (this.intervalId) {
      logger.warn('Memory monitor already running');
      return;
    }

    logger.info('🔍 Starting memory monitor', {
      interval: `${this.monitoringInterval / 1000}s`,
    });

    // Log initial memory
    this.logMemory();

    // Set up periodic monitoring
    this.intervalId = setInterval(() => {
      this.logMemory();
    }, this.monitoringInterval);
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
      logger.info('🛑 Memory monitor stopped');
      this.logSummary();
    }
  }

  /**
   * Log current memory usage
   */
  private logMemory(): void {
    const current = this.getCurrentMemory();
    this.samples.push(current);
    this.updatePeak(current);

    // Keep only last 100 samples to avoid memory leak
    if (this.samples.length > 100) {
      this.samples.shift();
    }

    const uptimeSeconds = Math.floor((Date.now() - this.startTime) / 1000);
    const uptimeMinutes = Math.floor(uptimeSeconds / 60);
    const uptimeStr = uptimeMinutes > 0 ? `${uptimeMinutes}m ${uptimeSeconds % 60}s` : `${uptimeSeconds}s`;
    const heapUtil = ((current.heapUsed / current.heapTotal) * 100).toFixed(1);

    // Log with formatted message for better visibility
    const message = `💾 Memory | Uptime: ${uptimeStr} | RSS: ${this.formatBytes(current.rss)} | Heap: ${this.formatBytes(current.heapUsed)}/${this.formatBytes(current.heapTotal)} (${heapUtil}%) | External: ${this.formatBytes(current.external)}`;
    
    logger.info(message);
  }

  /**
   * Get current snapshot
   */
  getSnapshot(): MemorySnapshot {
    const current = this.getCurrentMemory();
    this.updatePeak(current);

    return {
      current,
      peak: this.peakMemory,
      average: this.calculateAverage(),
      samples: this.samples.length,
    };
  }

  /**
   * Log memory summary
   */
  logSummary(): void {
    const snapshot = this.getSnapshot();
    const uptimeSeconds = Math.floor((Date.now() - this.startTime) / 1000);
    const uptimeMinutes = Math.floor(uptimeSeconds / 60);
    const uptimeStr = uptimeMinutes > 0 ? `${uptimeMinutes}m ${uptimeSeconds % 60}s` : `${uptimeSeconds}s`;

    logger.info('📊 Memory Usage Summary');
    logger.info(`   Uptime: ${uptimeStr} | Samples: ${snapshot.samples}`);
    logger.info(`   Current - RSS: ${this.formatBytes(snapshot.current.rss)} | Heap: ${this.formatBytes(snapshot.current.heapUsed)}/${this.formatBytes(snapshot.current.heapTotal)}`);
    logger.info(`   Peak    - RSS: ${this.formatBytes(snapshot.peak.rss)} | Heap: ${this.formatBytes(snapshot.peak.heapUsed)}/${this.formatBytes(snapshot.peak.heapTotal)}`);
    logger.info(`   Average - RSS: ${this.formatBytes(snapshot.average.rss)} | Heap: ${this.formatBytes(snapshot.average.heapUsed)}/${this.formatBytes(snapshot.average.heapTotal)}`);
  }

  /**
   * Force garbage collection if available (requires --expose-gc flag)
   */
  forceGC(): boolean {
    if (global.gc) {
      logger.info('🗑️  Forcing garbage collection...');
      global.gc();
      return true;
    }
    logger.warn('Garbage collection not available. Run with --expose-gc flag.');
    return false;
  }
}
