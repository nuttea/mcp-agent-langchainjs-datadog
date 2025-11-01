/**
 * Feature Flags for Performance Issue Injection
 *
 * These flags are designed for Datadog APM/Watchdog demo purposes.
 * They intentionally introduce performance issues to demonstrate monitoring capabilities.
 *
 * Usage:
 * Set environment variables to enable:
 * - PERF_ISSUE_DB_QUERY_LOOPS=true     # Enable N+1 query pattern
 * - PERF_ISSUE_DB_POOL_EXHAUST=true    # Reduce connection pool size
 * - PERF_ISSUE_CPU_BLOCKING=true       # Add blocking CPU operations
 */

export interface FeatureFlags {
  /** Inject database N+1 query pattern (multiple queries in loop instead of JOIN) */
  dbQueryLoops: boolean;

  /** Reduce DB connection pool size to cause exhaustion */
  dbPoolExhaust: boolean;

  /** Add blocking CPU-intensive operations */
  cpuBlocking: boolean;
}

export class FeatureFlagsService {
  private static instance: FeatureFlagsService;
  private flags: FeatureFlags;

  private constructor() {
    this.flags = {
      dbQueryLoops: process.env.PERF_ISSUE_DB_QUERY_LOOPS === 'true',
      dbPoolExhaust: process.env.PERF_ISSUE_DB_POOL_EXHAUST === 'true',
      cpuBlocking: process.env.PERF_ISSUE_CPU_BLOCKING === 'true',
    };

    // Log enabled flags on startup
    const enabledFlags = Object.entries(this.flags)
      .filter(([_, enabled]) => enabled)
      .map(([flag]) => flag);

    if (enabledFlags.length > 0) {
      console.warn('⚠️  Performance Issue Flags Enabled:', enabledFlags.join(', '));
      console.warn('   These flags intentionally degrade performance for demo purposes.');
    }
  }

  public static getInstance(): FeatureFlagsService {
    if (!FeatureFlagsService.instance) {
      FeatureFlagsService.instance = new FeatureFlagsService();
    }
    return FeatureFlagsService.instance;
  }

  public getFlags(): FeatureFlags {
    return { ...this.flags };
  }

  public isEnabled(flag: keyof FeatureFlags): boolean {
    return this.flags[flag];
  }

  // Helper methods for specific checks
  public shouldInjectDbQueryLoops(): boolean {
    return this.flags.dbQueryLoops;
  }

  public shouldReduceDbPool(): boolean {
    return this.flags.dbPoolExhaust;
  }

  public shouldAddCpuBlocking(): boolean {
    return this.flags.cpuBlocking;
  }

  // Get DB pool size based on flag
  public getDbPoolSize(): number {
    if (this.flags.dbPoolExhaust) {
      // Intentionally small pool to cause exhaustion
      console.warn('⚠️  DB Pool size reduced to 2 (PERF_ISSUE_DB_POOL_EXHAUST=true)');
      return 2;
    }
    // Normal pool size
    return 10;
  }

  // Get number of query loops to inject
  public getQueryLoopCount(): number {
    if (this.flags.dbQueryLoops) {
      // This will cause N+1 queries
      return 5; // Each burger will query toppings 5 times instead of using JOIN
    }
    return 0;
  }

  // Get CPU blocking duration in ms
  public getCpuBlockingDuration(): number {
    if (this.flags.cpuBlocking) {
      // Block for 100ms
      return 100;
    }
    return 0;
  }
}

// Export singleton instance
export const featureFlags = FeatureFlagsService.getInstance();
