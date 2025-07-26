// Tool Middleware - State Management and Execution Control for Phase 1
import { z } from 'zod';

// Type definitions for tool execution state
export interface ToolExecutionState {
  toolName: string;
  attempts: number;
  maxAttempts: number;
  lastError?: string;
  startTime: number;
  timeout: number;
  status: 'pending' | 'running' | 'success' | 'failed' | 'timeout';
  result?: any;
}

// Tool execution context for state management
export interface ToolExecutionContext {
  sessionId: string;
  userId?: string;
  conversationId: string;
  toolStates: Map<string, ToolExecutionState>;
  globalTimeout: number;
}

// Enhanced error types for better error handling
export class ToolExecutionError extends Error {
  constructor(
    public toolName: string,
    public originalError: Error,
    public attempts: number,
    public context: Partial<ToolExecutionContext>
  ) {
    super(`Tool '${toolName}' failed after ${attempts} attempts: ${originalError.message}`);
    this.name = 'ToolExecutionError';
  }
}

export class ToolTimeoutError extends Error {
  constructor(public toolName: string, public timeout: number) {
    super(`Tool '${toolName}' timed out after ${timeout}ms`);
    this.name = 'ToolTimeoutError';
  }
}

// Tool middleware configuration
export interface ToolMiddlewareConfig {
  defaultTimeout: number;
  defaultMaxAttempts: number;
  retryDelays: number[]; // Exponential backoff delays
  enableLogging: boolean;
  enableMetrics: boolean;
}

export const defaultConfig: ToolMiddlewareConfig = {
  defaultTimeout: 30000, // 30 seconds
  defaultMaxAttempts: 3,
  retryDelays: [1000, 2000, 4000], // 1s, 2s, 4s backoff
  enableLogging: true,
  enableMetrics: true,
};

// Schema validation for tool parameters
export const toolParameterSchemas = {
  get_packages: z.object({
    search: z.string().optional(),
    days: z.number().min(1).max(30).optional(),
  }),
  get_package_details: z.object({
    packageId: z.string().min(1),
  }),
  get_package_pricing: z.object({
    packageId: z.string().min(1),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    noAdult: z.number().min(1),
    noChild: z.number().min(0),
    noRoomCount: z.number().min(1),
    noExtraAdult: z.number().min(0).optional(),
  }),
  get_interests: z.object({}),
  search_destinations: z.object({
    search: z.string().optional(),
  }),
  get_available_hotels: z.object({
    packageId: z.string().min(1),
  }),
  get_available_vehicles: z.object({
    packageId: z.string().min(1),
  }),
  get_available_activities: z.object({
    packageId: z.string().min(1),
  }),
};

// Tool Middleware Class - Core functionality
export class ToolMiddleware {
  private contexts: Map<string, ToolExecutionContext> = new Map();
  private config: ToolMiddlewareConfig;
  private metrics: Map<string, { calls: number; failures: number; avgTime: number }> = new Map();

  constructor(config: Partial<ToolMiddlewareConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
  }

  // Create or get execution context
  public getContext(sessionId: string, conversationId: string): ToolExecutionContext {
    const contextKey = `${sessionId}-${conversationId}`;
    
    if (!this.contexts.has(contextKey)) {
      this.contexts.set(contextKey, {
        sessionId,
        conversationId,
        toolStates: new Map(),
        globalTimeout: this.config.defaultTimeout * 3, // 90s for conversation
      });
    }
    
    return this.contexts.get(contextKey)!;
  }

  // Validate tool parameters with schemas
  public validateToolParameters(toolName: string, parameters: any): any {
    const schema = toolParameterSchemas[toolName as keyof typeof toolParameterSchemas];
    
    if (!schema) {
      throw new Error(`No validation schema found for tool: ${toolName}`);
    }
    
    try {
      return schema.parse(parameters);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Tool parameter validation failed for '${toolName}': ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw error;
    }
  }

  // Execute tool with middleware controls
  public async executeToolWithMiddleware(
    toolName: string,
    parameters: any,
    context: ToolExecutionContext,
    toolFunction: (name: string, args: any) => Promise<any>
  ): Promise<any> {
    // Validate parameters first
    const validatedParams = this.validateToolParameters(toolName, parameters);
    
    // Initialize or get tool state
    const toolState: ToolExecutionState = context.toolStates.get(toolName) || {
      toolName,
      attempts: 0,
      maxAttempts: this.config.defaultMaxAttempts,
      startTime: Date.now(),
      timeout: this.config.defaultTimeout,
      status: 'pending',
    };
    
    context.toolStates.set(toolName, toolState);
    
    // Check if we've exceeded max attempts
    if (toolState.attempts >= toolState.maxAttempts) {
      toolState.status = 'failed';
      throw new ToolExecutionError(toolName, new Error('Max attempts exceeded'), toolState.attempts, context);
    }
    
    toolState.attempts++;
    toolState.status = 'running';
    
    try {
      // Execute with timeout
      const result = await this.executeWithTimeout(
        () => toolFunction(toolName, validatedParams),
        toolState.timeout
      );
      
      toolState.status = 'success';
      toolState.result = result;
      
      // Update metrics
      this.updateMetrics(toolName, Date.now() - toolState.startTime, false);
      
      if (this.config.enableLogging) {
        console.log(`✅ Tool '${toolName}' executed successfully in ${Date.now() - toolState.startTime}ms (attempt ${toolState.attempts})`);
      }
      
      return result;
    } catch (error) {
      toolState.lastError = error instanceof Error ? error.message : String(error);
      
      // Update metrics
      this.updateMetrics(toolName, Date.now() - toolState.startTime, true);
      
      if (this.config.enableLogging) {
        console.error(`❌ Tool '${toolName}' failed on attempt ${toolState.attempts}: ${toolState.lastError}`);
      }
      
      // Check if we should retry
      if (toolState.attempts < toolState.maxAttempts && this.shouldRetry(error)) {
        const delay = this.config.retryDelays[Math.min(toolState.attempts - 1, this.config.retryDelays.length - 1)];
        
        if (this.config.enableLogging) {
          console.log(`🔄 Retrying tool '${toolName}' in ${delay}ms (attempt ${toolState.attempts + 1}/${toolState.maxAttempts})`);
        }
        
        await this.delay(delay);
        return this.executeToolWithMiddleware(toolName, parameters, context, toolFunction);
      }
      
      toolState.status = 'failed';
      throw new ToolExecutionError(toolName, error instanceof Error ? error : new Error(String(error)), toolState.attempts, context);
    }
  }

  // Execute function with timeout
  private async executeWithTimeout<T>(fn: () => Promise<T>, timeout: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new ToolTimeoutError('unknown', timeout));
      }, timeout);
      
      fn()
        .then(resolve)
        .catch(reject)
        .finally(() => clearTimeout(timer));
    });
  }

  // Determine if error is retryable
  private shouldRetry(error: any): boolean {
    if (error instanceof ToolTimeoutError) return false;
    
    // Retry on network errors, rate limits, temporary server errors
    const retryableErrors = [
      'ENOTFOUND',
      'ECONNRESET',
      'ETIMEDOUT',
      'Rate limit',
      'Server temporarily unavailable',
      'Internal server error',
    ];
    
    const errorMessage = error?.message || String(error);
    return retryableErrors.some(retryable => errorMessage.includes(retryable));
  }

  // Simple delay utility
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Update performance metrics
  private updateMetrics(toolName: string, executionTime: number, failed: boolean): void {
    if (!this.config.enableMetrics) return;
    
    const current = this.metrics.get(toolName) || { calls: 0, failures: 0, avgTime: 0 };
    
    current.calls++;
    if (failed) current.failures++;
    current.avgTime = ((current.avgTime * (current.calls - 1)) + executionTime) / current.calls;
    
    this.metrics.set(toolName, current);
  }

  // Get performance metrics
  public getMetrics(): Record<string, { calls: number; failures: number; avgTime: number; successRate: number }> {
    const result: Record<string, any> = {};
    
    for (const [toolName, metrics] of this.metrics.entries()) {
      result[toolName] = {
        calls: metrics.calls,
        failures: metrics.failures,
        avgTime: Math.round(metrics.avgTime),
        successRate: Math.round(((metrics.calls - metrics.failures) / metrics.calls) * 100),
      };
    }
    
    return result;
  }

  // Clean up old contexts (memory management)
  public cleanupOldContexts(maxAge: number = 3600000): void { // 1 hour default
    const now = Date.now();
    
    for (const [key, context] of this.contexts.entries()) {
      const oldestState = Math.min(...Array.from(context.toolStates.values()).map(s => s.startTime));
      
      if (now - oldestState > maxAge) {
        this.contexts.delete(key);
        if (this.config.enableLogging) {
          console.log(`🧹 Cleaned up old context: ${key}`);
        }
      }
    }
  }
}

// Global instance
export const toolMiddleware = new ToolMiddleware();

// Helper function to generate session/conversation IDs
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}