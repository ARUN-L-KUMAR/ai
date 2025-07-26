// Enhanced Error Handling System - Phase 1 Foundation
import { z } from 'zod';

// Error severity levels
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

// Error categories for better classification
export enum ErrorCategory {
  VALIDATION = 'validation',
  NETWORK = 'network',
  API = 'api',
  AUTHENTICATION = 'authentication',
  RATE_LIMIT = 'rate_limit',
  TIMEOUT = 'timeout',
  AGENT = 'agent',
  TOOL = 'tool',
  SYSTEM = 'system',
  USER_INPUT = 'user_input',
}

// Enhanced error interface
export interface EnhancedError {
  id: string;
  message: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  code?: string;
  context?: {
    userId?: string;
    sessionId?: string;
    conversationId?: string;
    agentId?: string;
    toolName?: string;
    timestamp: Date;
    additionalData?: Record<string, any>;
  };
  stack?: string;
  retryable: boolean;
  retryCount?: number;
  maxRetries?: number;
  handled: boolean;
}

// Error recovery strategies
export interface RecoveryStrategy {
  name: string;
  condition: (error: EnhancedError) => boolean;
  execute: (error: EnhancedError) => Promise<any>;
  priority: number;
}

// Enhanced Error Handler Class
export class EnhancedErrorHandler {
  private errors: Map<string, EnhancedError> = new Map();
  private recoveryStrategies: RecoveryStrategy[] = [];
  private errorStats: Map<ErrorCategory, number> = new Map();
  private notificationCallbacks: Array<(error: EnhancedError) => void> = [];

  constructor() {
    this.initializeDefaultStrategies();
    this.startCleanupTimer();
  }

  // Create enhanced error from regular error
  public createEnhancedError(
    error: Error | string,
    category: ErrorCategory,
    severity: ErrorSeverity,
    context?: any
  ): EnhancedError {
    const errorMessage = error instanceof Error ? error.message : error;
    const stack = error instanceof Error ? error.stack : undefined;
    
    const enhancedError: EnhancedError = {
      id: this.generateErrorId(),
      message: errorMessage,
      category,
      severity,
      context: {
        timestamp: new Date(),
        ...context,
      },
      stack,
      retryable: this.isRetryable(category, errorMessage),
      retryCount: 0,
      maxRetries: this.getMaxRetries(category),
      handled: false,
    };

    // Store error for tracking
    this.errors.set(enhancedError.id, enhancedError);
    
    // Update statistics
    this.updateErrorStats(category);
    
    // Log error
    this.logError(enhancedError);
    
    return enhancedError;
  }

  // Handle error with recovery strategies
  public async handleError(error: EnhancedError): Promise<any> {
    try {
      console.log(`🔧 Handling error: ${error.id} (${error.category}/${error.severity})`);
      
      // Mark as being handled
      error.handled = true;
      
      // Find applicable recovery strategies
      const strategies = this.recoveryStrategies
        .filter(strategy => strategy.condition(error))
        .sort((a, b) => b.priority - a.priority);
      
      if (strategies.length === 0) {
        console.warn(`⚠️ No recovery strategy found for error: ${error.id}`);
        return null;
      }
      
      // Try each strategy
      for (const strategy of strategies) {
        try {
          console.log(`🔄 Attempting recovery strategy: ${strategy.name}`);
          const result = await strategy.execute(error);
          
          if (result !== null && result !== undefined) {
            console.log(`✅ Recovery successful with strategy: ${strategy.name}`);
            return result;
          }
        } catch (strategyError) {
          console.error(`❌ Recovery strategy '${strategy.name}' failed:`, strategyError);
          continue;
        }
      }
      
      console.error(`💥 All recovery strategies failed for error: ${error.id}`);
      return null;
      
    } catch (handlingError) {
      console.error(`🚨 Error while handling error ${error.id}:`, handlingError);
      return null;
    }
  }

  // Register recovery strategy
  public registerRecoveryStrategy(strategy: RecoveryStrategy): void {
    this.recoveryStrategies.push(strategy);
    this.recoveryStrategies.sort((a, b) => b.priority - a.priority);
    console.log(`📝 Registered recovery strategy: ${strategy.name}`);
  }

  // Add notification callback
  public onError(callback: (error: EnhancedError) => void): void {
    this.notificationCallbacks.push(callback);
  }

  // Get error statistics
  public getErrorStats(): Record<ErrorCategory, number> {
    const stats: Record<string, number> = {};
    for (const [category, count] of this.errorStats.entries()) {
      stats[category] = count;
    }
    return stats as Record<ErrorCategory, number>;
  }

  // Get recent errors
  public getRecentErrors(limit: number = 10): EnhancedError[] {
    return Array.from(this.errors.values())
      .sort((a, b) => b.context!.timestamp.getTime() - a.context!.timestamp.getTime())
      .slice(0, limit);
  }

  // Initialize default recovery strategies
  private initializeDefaultStrategies(): void {
    // Network retry strategy
    this.registerRecoveryStrategy({
      name: 'network_retry',
      condition: (error) => 
        error.category === ErrorCategory.NETWORK && 
        error.retryable && 
        (error.retryCount || 0) < (error.maxRetries || 3),
      execute: async (error) => {
        error.retryCount = (error.retryCount || 0) + 1;
        const delay = Math.min(1000 * Math.pow(2, error.retryCount - 1), 10000);
        
        console.log(`⏳ Retrying network operation in ${delay}ms (attempt ${error.retryCount})`);
        await this.delay(delay);
        
        // Return signal to retry the original operation
        return { shouldRetry: true, delay };
      },
      priority: 90,
    });

    // API error fallback strategy
    this.registerRecoveryStrategy({
      name: 'api_fallback',
      condition: (error) => 
        error.category === ErrorCategory.API && 
        error.severity !== ErrorSeverity.CRITICAL,
      execute: async (error) => {
        console.log(`🔄 Using fallback response for API error`);
        
        // Return a safe fallback response based on context
        if (error.context?.toolName === 'get_packages') {
          return {
            fallback: true,
            message: "I'm having trouble accessing our travel database right now. Please try again in a moment, or let me help you with general travel questions.",
          };
        }
        
        return {
          fallback: true,
          message: "I encountered a temporary issue. Please try rephrasing your request or try again in a moment.",
        };
      },
      priority: 70,
    });

    // Rate limit backoff strategy
    this.registerRecoveryStrategy({
      name: 'rate_limit_backoff',
      condition: (error) => error.category === ErrorCategory.RATE_LIMIT,
      execute: async (error) => {
        const backoffTime = 60000; // 1 minute
        console.log(`⏰ Rate limit hit, backing off for ${backoffTime}ms`);
        
        await this.delay(backoffTime);
        return { shouldRetry: true, delay: backoffTime };
      },
      priority: 100,
    });

    // Validation error user guidance strategy
    this.registerRecoveryStrategy({
      name: 'validation_guidance',
      condition: (error) => error.category === ErrorCategory.VALIDATION,
      execute: async (error) => {
        console.log(`📝 Providing user guidance for validation error`);
        
        let guidance = "I need some additional information to help you better. ";
        
        if (error.message.includes('destination')) {
          guidance += "Could you please specify which destination you'd like to visit?";
        } else if (error.message.includes('duration') || error.message.includes('days')) {
          guidance += "How many days are you planning for your trip?";
        } else if (error.message.includes('date')) {
          guidance += "Please provide your travel date in YYYY-MM-DD format.";
        } else {
          guidance += "Could you please provide more details about what you're looking for?";
        }
        
        return {
          userGuidance: true,
          message: guidance,
        };
      },
      priority: 80,
    });

    // System error safe response strategy
    this.registerRecoveryStrategy({
      name: 'system_safe_response',
      condition: (error) => 
        error.category === ErrorCategory.SYSTEM && 
        error.severity === ErrorSeverity.CRITICAL,
      execute: async (error) => {
        console.log(`🆘 Providing safe response for critical system error`);
        
        return {
          safeResponse: true,
          message: "I'm experiencing some technical difficulties right now. Our team has been notified and we're working to resolve this quickly. Please try again in a few minutes.",
        };
      },
      priority: 60,
    });
  }

  // Determine if error is retryable
  private isRetryable(category: ErrorCategory, message: string): boolean {
    const retryableCategories = [
      ErrorCategory.NETWORK,
      ErrorCategory.API,
      ErrorCategory.TIMEOUT,
      ErrorCategory.RATE_LIMIT,
    ];
    
    if (retryableCategories.includes(category)) {
      return true;
    }
    
    // Check message for retryable patterns
    const retryablePatterns = [
      'timeout',
      'connection',
      'temporarily unavailable',
      'service unavailable',
      'rate limit',
      'try again',
    ];
    
    return retryablePatterns.some(pattern => 
      message.toLowerCase().includes(pattern)
    );
  }

  // Get max retry attempts based on category
  private getMaxRetries(category: ErrorCategory): number {
    const retryMap = {
      [ErrorCategory.NETWORK]: 3,
      [ErrorCategory.API]: 2,
      [ErrorCategory.TIMEOUT]: 2,
      [ErrorCategory.RATE_LIMIT]: 1,
      [ErrorCategory.TOOL]: 3,
      [ErrorCategory.AGENT]: 2,
    };
    
    return retryMap[category] || 1;
  }

  // Update error statistics
  private updateErrorStats(category: ErrorCategory): void {
    const current = this.errorStats.get(category) || 0;
    this.errorStats.set(category, current + 1);
  }

  // Log error with appropriate level
  private logError(error: EnhancedError): void {
    const logData = {
      id: error.id,
      category: error.category,
      severity: error.severity,
      message: error.message,
      context: error.context,
    };
    
    switch (error.severity) {
      case ErrorSeverity.CRITICAL:
        console.error('🚨 CRITICAL ERROR:', logData);
        break;
      case ErrorSeverity.HIGH:
        console.error('❌ HIGH ERROR:', logData);
        break;
      case ErrorSeverity.MEDIUM:
        console.warn('⚠️ MEDIUM ERROR:', logData);
        break;
      case ErrorSeverity.LOW:
        console.log('ℹ️ LOW ERROR:', logData);
        break;
    }
    
    // Notify callbacks
    this.notificationCallbacks.forEach(callback => {
      try {
        callback(error);
      } catch (callbackError) {
        console.error('Error in notification callback:', callbackError);
      }
    });
  }

  // Generate unique error ID
  private generateErrorId(): string {
    return `err_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 5)}`;
  }

  // Utility delay function
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Start cleanup timer for old errors
  private startCleanupTimer(): void {
    setInterval(() => {
      this.cleanupOldErrors();
    }, 3600000); // Clean up every hour
  }

  // Clean up old errors (keep only last 1000 errors, max 24 hours old)
  private cleanupOldErrors(): void {
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    const maxErrors = 1000;
    const now = Date.now();
    
    // Remove old errors
    for (const [id, error] of this.errors.entries()) {
      const age = now - error.context!.timestamp.getTime();
      if (age > maxAge) {
        this.errors.delete(id);
      }
    }
    
    // Keep only the most recent errors if we have too many
    if (this.errors.size > maxErrors) {
      const sortedErrors = Array.from(this.errors.entries())
        .sort(([, a], [, b]) => b.context!.timestamp.getTime() - a.context!.timestamp.getTime());
      
      this.errors.clear();
      sortedErrors.slice(0, maxErrors).forEach(([id, error]) => {
        this.errors.set(id, error);
      });
    }
    
    console.log(`🧹 Error cleanup completed. Current error count: ${this.errors.size}`);
  }
}

// Helper functions for common error scenarios
export function createNetworkError(message: string, context?: any): EnhancedError {
  return errorHandler.createEnhancedError(
    new Error(message),
    ErrorCategory.NETWORK,
    ErrorSeverity.MEDIUM,
    context
  );
}

export function createAPIError(message: string, context?: any): EnhancedError {
  return errorHandler.createEnhancedError(
    new Error(message),
    ErrorCategory.API,
    ErrorSeverity.MEDIUM,
    context
  );
}

export function createValidationError(message: string, context?: any): EnhancedError {
  return errorHandler.createEnhancedError(
    new Error(message),
    ErrorCategory.VALIDATION,
    ErrorSeverity.LOW,
    context
  );
}

export function createToolError(message: string, context?: any): EnhancedError {
  return errorHandler.createEnhancedError(
    new Error(message),
    ErrorCategory.TOOL,
    ErrorSeverity.MEDIUM,
    context
  );
}

export function createSystemError(message: string, context?: any): EnhancedError {
  return errorHandler.createEnhancedError(
    new Error(message),
    ErrorCategory.SYSTEM,
    ErrorSeverity.HIGH,
    context
  );
}

// Global error handler instance
export const errorHandler = new EnhancedErrorHandler();