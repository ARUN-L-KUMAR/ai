// Advanced Retry Mechanisms - Enhanced Error Handling Phase 1 Final
import { logger, LogCategory } from '../logging/comprehensive-logger';

// Enhanced retry configuration
export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitter: boolean;
  retryableErrors: string[];
  retryableStatusCodes: number[];
  timeoutMs: number;
  onRetry?: (attempt: number, error: Error) => void;
  onFailure?: (attempts: number, finalError: Error) => void;
}

// Circuit breaker states
export enum CircuitState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half_open',
}

// Circuit breaker configuration
export interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeout: number;
  monitoringWindow: number;
  minimumThroughput: number;
}

// Retry attempt information
export interface RetryAttempt {
  attemptNumber: number;
  delay: number;
  error: Error;
  timestamp: Date;
}

// Circuit breaker for preventing cascade failures
export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures: number = 0;
  private lastFailureTime: number = 0;
  private successes: number = 0;
  private requests: number = 0;
  private config: CircuitBreakerConfig;

  constructor(config: CircuitBreakerConfig) {
    this.config = config;
  }

  public async execute<T>(operation: () => Promise<T>, operationName: string): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() - this.lastFailureTime > this.config.recoveryTimeout) {
        this.state = CircuitState.HALF_OPEN;
        logger.info(LogCategory.SYSTEM, `Circuit breaker for ${operationName} moved to HALF_OPEN state`);
      } else {
        throw new Error(`Circuit breaker is OPEN for ${operationName}. Recovery in ${this.config.recoveryTimeout - (Date.now() - this.lastFailureTime)}ms`);
      }
    }

    this.requests++;
    
    try {
      const result = await operation();
      this.onSuccess(operationName);
      return result;
    } catch (error) {
      this.onFailure(error as Error, operationName);
      throw error;
    }
  }

  private onSuccess(operationName: string): void {
    this.successes++;
    
    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.CLOSED;
      this.failures = 0;
      logger.info(LogCategory.SYSTEM, `Circuit breaker for ${operationName} moved to CLOSED state`);
    }
  }

  private onFailure(error: Error, operationName: string): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.requests >= this.config.minimumThroughput && 
        this.failures >= this.config.failureThreshold) {
      this.state = CircuitState.OPEN;
      logger.error(LogCategory.SYSTEM, `Circuit breaker OPENED for ${operationName}`, error, {
        failures: this.failures,
        threshold: this.config.failureThreshold,
      });
    }
  }

  public getState(): { state: CircuitState; failures: number; successes: number; requests: number } {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      requests: this.requests,
    };
  }

  public reset(): void {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.successes = 0;
    this.requests = 0;
    this.lastFailureTime = 0;
  }
}

// Advanced retry mechanism with circuit breaker
export class AdvancedRetryMechanism {
  private config: RetryConfig;
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private retryAttempts: Map<string, RetryAttempt[]> = new Map();

  constructor(config: Partial<RetryConfig> = {}) {
    this.config = {
      maxAttempts: 3,
      baseDelay: 1000,
      maxDelay: 30000,
      backoffMultiplier: 2,
      jitter: true,
      retryableErrors: [
        'ENOTFOUND',
        'ECONNRESET',
        'ETIMEDOUT',
        'ECONNREFUSED',
        'NETWORK_ERROR',
        'TIMEOUT_ERROR',
        'RATE_LIMIT',
        'SERVER_ERROR',
      ],
      retryableStatusCodes: [408, 429, 500, 502, 503, 504],
      timeoutMs: 30000,
      ...config,
    };
  }

  // Execute operation with advanced retry logic
  public async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationId: string,
    customConfig?: Partial<RetryConfig>
  ): Promise<T> {
    const effectiveConfig = { ...this.config, ...customConfig };
    const attempts: RetryAttempt[] = [];
    let lastError: Error;

    // Get or create circuit breaker for this operation
    const circuitBreaker = this.getCircuitBreaker(operationId);

    for (let attempt = 1; attempt <= effectiveConfig.maxAttempts; attempt++) {
      try {
        logger.debug(LogCategory.SYSTEM, `Executing ${operationId} (attempt ${attempt}/${effectiveConfig.maxAttempts})`);
        
        const startTime = Date.now();
        
        // Execute with circuit breaker protection
        const result = await circuitBreaker.execute(async () => {
          return await this.executeWithTimeout(operation, effectiveConfig.timeoutMs);
        }, operationId);
        
        const duration = Date.now() - startTime;
        
        // Log successful execution
        logger.info(LogCategory.SYSTEM, `${operationId} succeeded on attempt ${attempt}`, {
          attempt,
          duration,
          totalAttempts: attempt,
        });

        // Clean up retry history on success
        this.retryAttempts.delete(operationId);
        
        return result;

      } catch (error) {
        lastError = error as Error;
        const retryAttempt: RetryAttempt = {
          attemptNumber: attempt,
          delay: 0,
          error: lastError,
          timestamp: new Date(),
        };

        attempts.push(retryAttempt);
        this.retryAttempts.set(operationId, attempts);

        logger.warn(LogCategory.SYSTEM, `${operationId} failed on attempt ${attempt}`, undefined, {
          attempt,
          error: lastError.message,
          maxAttempts: effectiveConfig.maxAttempts,
        });

        // Check if error is retryable
        if (!this.isErrorRetryable(lastError, effectiveConfig)) {
          logger.error(LogCategory.SYSTEM, `${operationId} failed with non-retryable error`, lastError);
          break;
        }

        // Don't retry if this was the last attempt
        if (attempt >= effectiveConfig.maxAttempts) {
          break;
        }

        // Calculate delay for next attempt
        const delay = this.calculateDelay(attempt, effectiveConfig);
        retryAttempt.delay = delay;

        logger.info(LogCategory.SYSTEM, `Retrying ${operationId} in ${delay}ms`, {
          attempt: attempt + 1,
          delay,
        });

        // Call retry callback if provided
        effectiveConfig.onRetry?.(attempt, lastError);

        // Wait before next attempt
        await this.delay(delay);
      }
    }

    // All attempts failed
    const totalAttempts = attempts.length;
    
    logger.error(LogCategory.SYSTEM, `${operationId} failed after ${totalAttempts} attempts`, lastError!, {
      attempts: totalAttempts,
      maxAttempts: effectiveConfig.maxAttempts,
    });

    // Call failure callback if provided
    effectiveConfig.onFailure?.(totalAttempts, lastError!);

    // Throw the last error
    throw new Error(`Operation ${operationId} failed after ${totalAttempts} attempts. Last error: ${lastError!.message}`);
  }

  // Execute operation with timeout
  private async executeWithTimeout<T>(operation: () => Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      operation()
        .then(resolve)
        .catch(reject)
        .finally(() => clearTimeout(timer));
    });
  }

  // Check if error is retryable
  private isErrorRetryable(error: Error, config: RetryConfig): boolean {
    const errorMessage = error.message.toLowerCase();
    
    // Check retryable error patterns
    for (const retryableError of config.retryableErrors) {
      if (errorMessage.includes(retryableError.toLowerCase())) {
        return true;
      }
    }

    // Check for HTTP status codes (if error has statusCode property)
    const statusCode = (error as any).statusCode || (error as any).status;
    if (statusCode && config.retryableStatusCodes.includes(statusCode)) {
      return true;
    }

    // Check for specific error types
    if (error.name === 'TimeoutError' || error.name === 'NetworkError') {
      return true;
    }

    return false;
  }

  // Calculate delay with exponential backoff and jitter
  private calculateDelay(attempt: number, config: RetryConfig): number {
    let delay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1);
    
    // Apply maximum delay limit
    delay = Math.min(delay, config.maxDelay);
    
    // Add jitter to prevent thundering herd
    if (config.jitter) {
      delay = delay * (0.5 + Math.random() * 0.5); // 50-100% of calculated delay
    }
    
    return Math.floor(delay);
  }

  // Utility delay function
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Get or create circuit breaker for operation
  private getCircuitBreaker(operationId: string): CircuitBreaker {
    if (!this.circuitBreakers.has(operationId)) {
      const circuitBreaker = new CircuitBreaker({
        failureThreshold: 5,
        recoveryTimeout: 60000, // 1 minute
        monitoringWindow: 300000, // 5 minutes
        minimumThroughput: 5,
      });
      this.circuitBreakers.set(operationId, circuitBreaker);
    }
    return this.circuitBreakers.get(operationId)!;
  }

  // Get retry statistics for monitoring
  public getRetryStatistics(): {
    activeRetries: number;
    circuitBreakerStates: Record<string, any>;
    recentAttempts: RetryAttempt[];
  } {
    const circuitBreakerStates: Record<string, any> = {};
    for (const [operationId, breaker] of this.circuitBreakers.entries()) {
      circuitBreakerStates[operationId] = breaker.getState();
    }

    const recentAttempts: RetryAttempt[] = [];
    const cutoff = Date.now() - 300000; // Last 5 minutes
    
    for (const attempts of this.retryAttempts.values()) {
      for (const attempt of attempts) {
        if (attempt.timestamp.getTime() > cutoff) {
          recentAttempts.push(attempt);
        }
      }
    }

    return {
      activeRetries: this.retryAttempts.size,
      circuitBreakerStates,
      recentAttempts: recentAttempts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()),
    };
  }

  // Reset circuit breaker for specific operation
  public resetCircuitBreaker(operationId: string): void {
    const breaker = this.circuitBreakers.get(operationId);
    if (breaker) {
      breaker.reset();
      logger.info(LogCategory.SYSTEM, `Circuit breaker reset for ${operationId}`);
    }
  }

  // Clean up old retry history
  public cleanup(): void {
    const cutoff = Date.now() - 3600000; // 1 hour ago
    
    for (const [operationId, attempts] of this.retryAttempts.entries()) {
      const recentAttempts = attempts.filter(attempt => attempt.timestamp.getTime() > cutoff);
      
      if (recentAttempts.length === 0) {
        this.retryAttempts.delete(operationId);
      } else {
        this.retryAttempts.set(operationId, recentAttempts);
      }
    }
  }
}

// Global retry mechanism instance
export const advancedRetry = new AdvancedRetryMechanism();

// Convenience function for common retry scenarios
export async function retryOperation<T>(
  operation: () => Promise<T>,
  operationName: string,
  maxAttempts: number = 3
): Promise<T> {
  return advancedRetry.executeWithRetry(operation, operationName, { maxAttempts });
}

// Specialized retry for API calls
export async function retryAPICall<T>(
  apiCall: () => Promise<T>,
  endpoint: string,
  customConfig?: Partial<RetryConfig>
): Promise<T> {
  const config: Partial<RetryConfig> = {
    maxAttempts: 3,
    baseDelay: 1000,
    retryableStatusCodes: [429, 500, 502, 503, 504],
    onRetry: (attempt, error) => {
      logger.warn(LogCategory.API, `API call to ${endpoint} failed, retrying`, undefined, {
        attempt,
        error: error.message,
      });
    },
    ...customConfig,
  };

  return advancedRetry.executeWithRetry(apiCall, `api_${endpoint}`, config);
}

// Specialized retry for AI operations
export async function retryAIOperation<T>(
  aiOperation: () => Promise<T>,
  operationName: string,
  customConfig?: Partial<RetryConfig>
): Promise<T> {
  const config: Partial<RetryConfig> = {
    maxAttempts: 2, // AI operations are expensive, fewer retries
    baseDelay: 2000,
    maxDelay: 10000,
    retryableErrors: ['RATE_LIMIT', 'TIMEOUT_ERROR', 'SERVER_ERROR'],
    onRetry: (attempt, error) => {
      logger.warn(LogCategory.AI, `AI operation ${operationName} failed, retrying`, undefined, {
        attempt,
        error: error.message,
      });
    },
    ...customConfig,
  };

  return advancedRetry.executeWithRetry(aiOperation, `ai_${operationName}`, config);
}

// Start cleanup timer
setInterval(() => {
  advancedRetry.cleanup();
}, 300000); // Clean up every 5 minutes