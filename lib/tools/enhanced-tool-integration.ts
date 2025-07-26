// Enhanced Tool Integration - Phase 1 Final Enhancement
import { logger, LogCategory } from '../logging/comprehensive-logger';
import { retryAPICall, advancedRetry } from '../error-handling/advanced-retry-mechanisms';
import { toolMiddleware } from '../middleware/tool-middleware';
import { 
  createAPIError, 
  createToolError, 
  errorHandler 
} from '../error-handling/enhanced-error-handler';

// Enhanced tool result interface
export interface EnhancedToolResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata: {
    toolName: string;
    executionTime: number;
    attempts: number;
    cacheHit?: boolean;
    dataSource?: string;
    confidence?: number;
  };
  context?: {
    sessionId?: string;
    userId?: string;
    timestamp: Date;
  };
}

// Tool caching interface
interface CacheEntry {
  data: any;
  timestamp: Date;
  ttl: number;
  key: string;
}

// Enhanced tool execution wrapper
export class EnhancedToolExecutor {
  private cache: Map<string, CacheEntry> = new Map();
  private toolMetrics: Map<string, {
    totalCalls: number;
    successfulCalls: number;
    totalTime: number;
    averageTime: number;
    lastCall: Date;
  }> = new Map();

  constructor() {
    // Start cache cleanup timer
    setInterval(() => this.cleanupCache(), 300000); // 5 minutes
  }

  // Execute tool with enhanced features
  public async executeEnhancedTool(
    toolName: string,
    parameters: any,
    context: {
      sessionId?: string;
      userId?: string;
      enableCache?: boolean;
      cacheTTL?: number;
      priority?: 'low' | 'medium' | 'high';
    } = {}
  ): Promise<EnhancedToolResult> {
    const startTime = Date.now();
    const { sessionId, userId, enableCache = true, cacheTTL = 300000, priority = 'medium' } = context;

    logger.info(LogCategory.TOOL, `Executing enhanced tool: ${toolName}`, {
      parameters: this.sanitizeParameters(parameters),
      sessionId,
      priority,
    });

    try {
      // Check cache first
      if (enableCache) {
        const cacheKey = this.generateCacheKey(toolName, parameters);
        const cachedResult = this.getFromCache(cacheKey);
        
        if (cachedResult) {
          logger.info(LogCategory.TOOL, `Cache hit for tool: ${toolName}`, { cacheKey });
          
          return {
            success: true,
            data: cachedResult,
            metadata: {
              toolName,
              executionTime: Date.now() - startTime,
              attempts: 1,
              cacheHit: true,
              confidence: 1.0,
            },
            context: {
              sessionId,
              userId,
              timestamp: new Date(),
            },
          };
        }
      }

      // Execute tool with retry mechanism
      const result = await this.executeWithRetryAndMonitoring(
        toolName,
        parameters,
        sessionId,
        priority
      );

      const executionTime = Date.now() - startTime;

      // Cache successful results
      if (enableCache && result.success && result.data) {
        const cacheKey = this.generateCacheKey(toolName, parameters);
        this.addToCache(cacheKey, result.data, cacheTTL);
      }

      // Update metrics
      this.updateToolMetrics(toolName, executionTime, result.success);

      // Enhanced result with metadata
      const enhancedResult: EnhancedToolResult = {
        success: result.success,
        data: result.data,
        error: result.error,
        metadata: {
          toolName,
          executionTime,
          attempts: result.attempts || 1,
          cacheHit: false,
          dataSource: this.getDataSource(toolName),
          confidence: this.calculateConfidence(result, toolName),
        },
        context: {
          sessionId,
          userId,
          timestamp: new Date(),
        },
      };

      logger.info(LogCategory.TOOL, `Tool execution completed: ${toolName}`, {
        success: result.success,
        executionTime,
        attempts: result.attempts,
      });

      return enhancedResult;

    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.updateToolMetrics(toolName, executionTime, false);

      logger.error(LogCategory.TOOL, `Tool execution failed: ${toolName}`, error as Error, {
        parameters: this.sanitizeParameters(parameters),
        executionTime,
        sessionId,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metadata: {
          toolName,
          executionTime,
          attempts: 1,
          confidence: 0,
        },
        context: {
          sessionId,
          userId,
          timestamp: new Date(),
        },
      };
    }
  }

  // Execute tool with retry and monitoring
  private async executeWithRetryAndMonitoring(
    toolName: string,
    parameters: any,
    sessionId?: string,
    priority: 'low' | 'medium' | 'high' = 'medium'
  ): Promise<{ success: boolean; data?: any; error?: string; attempts?: number }> {
    const maxAttempts = this.getMaxAttempts(toolName, priority);
    
    return advancedRetry.executeWithRetry(
      async () => {
        // Get the actual tool execution function
        const toolExecutor = await this.getToolExecutor(toolName);
        const result = await toolExecutor(parameters);
        
        return { success: true, data: result };
      },
      `tool_${toolName}`,
      {
        maxAttempts,
        baseDelay: 1000,
        retryableErrors: this.getRetryableErrors(toolName),
        onRetry: (attempt, error) => {
          logger.warn(LogCategory.TOOL, `Retrying tool ${toolName}`, undefined, {
            attempt,
            error: error.message,
            sessionId,
          });
        },
        onFailure: (attempts, error) => {
          logger.error(LogCategory.TOOL, `Tool ${toolName} failed after all retries`, error, {
            attempts,
            sessionId,
          });
        },
      }
    );
  }

  // Get tool executor function
  private async getToolExecutor(toolName: string): Promise<(params: any) => Promise<any>> {
    // Import the original tool execution function
    const { executeTool } = await import('../ai/tools');
    
    return async (parameters: any) => {
      const result = await executeTool(toolName, parameters);
      
      // Parse JSON results for better handling
      try {
        return typeof result === 'string' ? JSON.parse(result) : result;
      } catch {
        return result;
      }
    };
  }

  // Cache management methods
  private generateCacheKey(toolName: string, parameters: any): string {
    const paramStr = JSON.stringify(parameters, Object.keys(parameters).sort());
    return `${toolName}:${Buffer.from(paramStr).toString('base64').slice(0, 32)}`;
  }

  private getFromCache(key: string): any | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }
    
    // Check if cache entry has expired
    if (Date.now() - entry.timestamp.getTime() > entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  private addToCache(key: string, data: any, ttl: number): void {
    // Don't cache large objects (>1MB)
    const dataSize = JSON.stringify(data).length;
    if (dataSize > 1024 * 1024) {
      return;
    }

    this.cache.set(key, {
      data,
      timestamp: new Date(),
      ttl,
      key,
    });

    // Limit cache size (max 1000 entries)
    if (this.cache.size > 1000) {
      const oldestKey = Array.from(this.cache.keys())[0];
      this.cache.delete(oldestKey);
    }
  }

  private cleanupCache(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp.getTime() > entry.ttl) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach(key => this.cache.delete(key));
    
    if (expiredKeys.length > 0) {
      logger.debug(LogCategory.TOOL, `Cleaned up ${expiredKeys.length} expired cache entries`);
    }
  }

  // Tool configuration methods
  private getMaxAttempts(toolName: string, priority: string): number {
    const priorityMultiplier = { low: 1, medium: 2, high: 3 };
    const baseAttempts = {
      get_packages: 3,
      get_package_details: 2,
      get_package_pricing: 3,
      search_destinations: 2,
      get_interests: 1,
      get_available_hotels: 2,
      get_available_vehicles: 2,
      get_available_activities: 2,
    };

    const base = baseAttempts[toolName as keyof typeof baseAttempts] || 2;
    return Math.min(base * priorityMultiplier[priority as keyof typeof priorityMultiplier], 5);
  }

  private getRetryableErrors(toolName: string): string[] {
    const commonErrors = ['ENOTFOUND', 'ECONNRESET', 'ETIMEDOUT', 'Rate limit', 'Server error'];
    
    const toolSpecificErrors: Record<string, string[]> = {
      get_packages: [...commonErrors, 'Search timeout', 'Database busy'],
      get_package_pricing: [...commonErrors, 'Pricing service unavailable'],
      search_destinations: [...commonErrors, 'Search index unavailable'],
    };

    return toolSpecificErrors[toolName] || commonErrors;
  }

  private getDataSource(toolName: string): string {
    const dataSources: Record<string, string> = {
      get_packages: 'TripXplo Package Database',
      get_package_details: 'TripXplo Package Details API',
      get_package_pricing: 'TripXplo Pricing Engine',
      search_destinations: 'TripXplo Destination Search',
      get_interests: 'TripXplo Interest Categories',
      get_available_hotels: 'TripXplo Hotel Inventory',
      get_available_vehicles: 'TripXplo Vehicle Booking',
      get_available_activities: 'TripXplo Activity Catalog',
    };

    return dataSources[toolName] || 'TripXplo API';
  }

  private calculateConfidence(result: any, toolName: string): number {
    if (!result.success || !result.data) {
      return 0;
    }

    // Calculate confidence based on data quality and completeness
    let confidence = 0.8; // Base confidence

    // Tool-specific confidence calculations
    if (toolName === 'get_packages' && Array.isArray(result.data)) {
      confidence = Math.min(0.9, 0.5 + (result.data.length * 0.05));
    } else if (toolName === 'search_destinations') {
      const destinations = result.data?.destinations || [];
      confidence = Math.min(0.95, 0.6 + (destinations.length * 0.05));
    }

    return Math.round(confidence * 100) / 100;
  }

  // Metrics and monitoring
  private updateToolMetrics(toolName: string, executionTime: number, success: boolean): void {
    const current = this.toolMetrics.get(toolName) || {
      totalCalls: 0,
      successfulCalls: 0,
      totalTime: 0,
      averageTime: 0,
      lastCall: new Date(),
    };

    current.totalCalls++;
    current.totalTime += executionTime;
    current.averageTime = current.totalTime / current.totalCalls;
    current.lastCall = new Date();

    if (success) {
      current.successfulCalls++;
    }

    this.toolMetrics.set(toolName, current);
  }

  public getToolMetrics(): Record<string, any> {
    const metrics: Record<string, any> = {};
    
    for (const [toolName, data] of this.toolMetrics.entries()) {
      metrics[toolName] = {
        ...data,
        successRate: data.totalCalls > 0 ? (data.successfulCalls / data.totalCalls) * 100 : 0,
        averageTime: Math.round(data.averageTime),
      };
    }

    return metrics;
  }

  public getCacheStatistics(): {
    totalEntries: number;
    cacheHitRate: number;
    averageEntryAge: number;
    memoryUsage: number;
  } {
    const now = Date.now();
    let totalAge = 0;
    let memoryUsage = 0;

    for (const entry of this.cache.values()) {
      totalAge += now - entry.timestamp.getTime();
      memoryUsage += JSON.stringify(entry.data).length;
    }

    return {
      totalEntries: this.cache.size,
      cacheHitRate: 0, // This would need to be tracked separately
      averageEntryAge: this.cache.size > 0 ? totalAge / this.cache.size : 0,
      memoryUsage,
    };
  }

  // Utility methods
  private sanitizeParameters(parameters: any): any {
    // Remove sensitive information from logs
    const sanitized = { ...parameters };
    
    const sensitiveKeys = ['password', 'token', 'key', 'secret'];
    for (const key of sensitiveKeys) {
      if (sanitized[key]) {
        sanitized[key] = '[REDACTED]';
      }
    }
    
    return sanitized;
  }

  // Clear cache for specific tool or all tools
  public clearCache(toolName?: string): void {
    if (toolName) {
      const keysToDelete = Array.from(this.cache.keys()).filter(key => key.startsWith(`${toolName}:`));
      keysToDelete.forEach(key => this.cache.delete(key));
      logger.info(LogCategory.TOOL, `Cleared cache for tool: ${toolName}`, { entriesCleared: keysToDelete.length });
    } else {
      const totalEntries = this.cache.size;
      this.cache.clear();
      logger.info(LogCategory.TOOL, 'Cleared all tool cache', { entriesCleared: totalEntries });
    }
  }

  // Reset metrics for specific tool or all tools
  public resetMetrics(toolName?: string): void {
    if (toolName) {
      this.toolMetrics.delete(toolName);
      logger.info(LogCategory.TOOL, `Reset metrics for tool: ${toolName}`);
    } else {
      this.toolMetrics.clear();
      logger.info(LogCategory.TOOL, 'Reset all tool metrics');
    }
  }
}

// Global enhanced tool executor
export const enhancedToolExecutor = new EnhancedToolExecutor();

// Convenience function for enhanced tool execution
export async function executeEnhancedTool(
  toolName: string,
  parameters: any,
  context: {
    sessionId?: string;
    userId?: string;
    enableCache?: boolean;
    priority?: 'low' | 'medium' | 'high';
  } = {}
): Promise<EnhancedToolResult> {
  return enhancedToolExecutor.executeEnhancedTool(toolName, parameters, context);
}

// Batch tool execution for multiple tools
export async function executeBatchTools(
  tools: Array<{
    name: string;
    parameters: any;
    priority?: 'low' | 'medium' | 'high';
  }>,
  context: {
    sessionId?: string;
    userId?: string;
    enableCache?: boolean;
    parallel?: boolean;
  } = {}
): Promise<EnhancedToolResult[]> {
  const { parallel = false, ...toolContext } = context;
  
  if (parallel) {
    // Execute all tools in parallel
    const promises = tools.map(tool =>
      enhancedToolExecutor.executeEnhancedTool(tool.name, tool.parameters, {
        ...toolContext,
        priority: tool.priority,
      })
    );
    
    return Promise.all(promises);
  } else {
    // Execute tools sequentially
    const results: EnhancedToolResult[] = [];
    
    for (const tool of tools) {
      const result = await enhancedToolExecutor.executeEnhancedTool(tool.name, tool.parameters, {
        ...toolContext,
        priority: tool.priority,
      });
      results.push(result);
    }
    
    return results;
  }
}