// Comprehensive Logging System - Phase 1 Final Enhancement
import { writeFileSync, appendFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

// Log levels with priority
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  CRITICAL = 4,
}

// Log categories for better organization
export enum LogCategory {
  SYSTEM = 'system',
  AI = 'ai',
  AGENT = 'agent',
  TOOL = 'tool',
  API = 'api',
  USER = 'user',
  PERFORMANCE = 'performance',
  SECURITY = 'security',
}

// Enhanced log entry interface
export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  category: LogCategory;
  message: string;
  data?: Record<string, any>;
  userId?: string;
  sessionId?: string;
  conversationId?: string;
  agentId?: string;
  toolName?: string;
  duration?: number;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  context?: {
    ip?: string;
    userAgent?: string;
    endpoint?: string;
    method?: string;
  };
}

// Performance metrics interface
export interface PerformanceMetrics {
  timestamp: Date;
  category: string;
  operation: string;
  duration: number;
  success: boolean;
  metadata?: Record<string, any>;
}

// Logger configuration
export interface LoggerConfig {
  logLevel: LogLevel;
  enableConsole: boolean;
  enableFile: boolean;
  enablePerformanceLogging: boolean;
  logDirectory: string;
  maxFileSize: number; // bytes
  maxFiles: number;
  enableStructuredLogging: boolean;
}

const defaultConfig: LoggerConfig = {
  logLevel: process.env.NODE_ENV === 'development' ? LogLevel.DEBUG : LogLevel.INFO,
  enableConsole: true,
  enableFile: true,
  enablePerformanceLogging: true,
  logDirectory: './logs',
  maxFileSize: 10 * 1024 * 1024, // 10MB
  maxFiles: 10,
  enableStructuredLogging: true,
};

// Comprehensive Logger Class
export class ComprehensiveLogger {
  private config: LoggerConfig;
  private performanceMetrics: PerformanceMetrics[] = [];
  private logBuffer: LogEntry[] = [];
  private flushInterval: NodeJS.Timeout | null = null;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
    this.initializeLogger();
  }

  // Initialize logger (create directories, start flush timer)
  private initializeLogger(): void {
    if (this.config.enableFile) {
      if (!existsSync(this.config.logDirectory)) {
        mkdirSync(this.config.logDirectory, { recursive: true });
      }
    }

    // Start buffer flush timer (every 5 seconds)
    this.flushInterval = setInterval(() => {
      this.flushBuffer();
    }, 5000);

    // Handle process termination
    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());
  }

  // Main logging method
  public log(
    level: LogLevel,
    category: LogCategory,
    message: string,
    data?: Record<string, any>,
    context?: Partial<LogEntry>
  ): void {
    if (level < this.config.logLevel) {
      return; // Skip logs below the configured level
    }

    const logEntry: LogEntry = {
      timestamp: new Date(),
      level,
      category,
      message,
      data,
      ...context,
    };

    // Add to buffer for batch processing
    this.logBuffer.push(logEntry);

    // Console logging (immediate)
    if (this.config.enableConsole) {
      this.logToConsole(logEntry);
    }

    // Immediate flush for critical errors
    if (level === LogLevel.CRITICAL || level === LogLevel.ERROR) {
      this.flushBuffer();
    }
  }

  // Convenience methods for different log levels
  public debug(category: LogCategory, message: string, data?: Record<string, any>, context?: Partial<LogEntry>): void {
    this.log(LogLevel.DEBUG, category, message, data, context);
  }

  public info(category: LogCategory, message: string, data?: Record<string, any>, context?: Partial<LogEntry>): void {
    this.log(LogLevel.INFO, category, message, data, context);
  }

  public warn(category: LogCategory, message: string, data?: Record<string, any>, context?: Partial<LogEntry>): void {
    this.log(LogLevel.WARN, category, message, data, context);
  }

  public error(category: LogCategory, message: string, error?: Error, data?: Record<string, any>, context?: Partial<LogEntry>): void {
    const logContext = { ...context };
    if (error) {
      logContext.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }
    this.log(LogLevel.ERROR, category, message, data, logContext);
  }

  public critical(category: LogCategory, message: string, error?: Error, data?: Record<string, any>, context?: Partial<LogEntry>): void {
    const logContext = { ...context };
    if (error) {
      logContext.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }
    this.log(LogLevel.CRITICAL, category, message, data, logContext);
  }

  // Performance logging
  public logPerformance(
    category: string,
    operation: string,
    duration: number,
    success: boolean,
    metadata?: Record<string, any>
  ): void {
    if (!this.config.enablePerformanceLogging) return;

    const metric: PerformanceMetrics = {
      timestamp: new Date(),
      category,
      operation,
      duration,
      success,
      metadata,
    };

    this.performanceMetrics.push(metric);

    // Log as INFO level
    this.info(LogCategory.PERFORMANCE, `${operation} completed`, {
      category,
      duration,
      success,
      metadata,
    });

    // Keep only last 1000 metrics
    if (this.performanceMetrics.length > 1000) {
      this.performanceMetrics = this.performanceMetrics.slice(-1000);
    }
  }

  // Structured logging for API requests
  public logAPIRequest(
    method: string,
    endpoint: string,
    statusCode: number,
    duration: number,
    userId?: string,
    sessionId?: string,
    ip?: string,
    userAgent?: string
  ): void {
    const level = statusCode >= 500 ? LogLevel.ERROR : statusCode >= 400 ? LogLevel.WARN : LogLevel.INFO;
    
    this.log(level, LogCategory.API, `${method} ${endpoint} - ${statusCode}`, {
      statusCode,
      duration,
    }, {
      userId,
      sessionId,
      context: {
        ip,
        userAgent,
        endpoint,
        method,
      },
    });
  }

  // Log AI interactions
  public logAIInteraction(
    operation: string,
    duration: number,
    success: boolean,
    userId?: string,
    sessionId?: string,
    conversationId?: string,
    metadata?: Record<string, any>
  ): void {
    this.log(
      success ? LogLevel.INFO : LogLevel.WARN,
      LogCategory.AI,
      `AI ${operation}`,
      {
        duration,
        success,
        ...metadata,
      },
      {
        userId,
        sessionId,
        conversationId,
      }
    );

    // Also log performance
    this.logPerformance('ai', operation, duration, success, metadata);
  }

  // Log agent activities
  public logAgentActivity(
    agentId: string,
    activity: string,
    success: boolean,
    duration?: number,
    data?: Record<string, any>,
    conversationId?: string
  ): void {
    this.log(
      success ? LogLevel.INFO : LogLevel.WARN,
      LogCategory.AGENT,
      `Agent ${agentId}: ${activity}`,
      {
        success,
        duration,
        ...data,
      },
      {
        agentId,
        conversationId,
      }
    );
  }

  // Log tool executions
  public logToolExecution(
    toolName: string,
    success: boolean,
    duration: number,
    attempts: number,
    sessionId?: string,
    error?: Error
  ): void {
    const level = success ? LogLevel.INFO : LogLevel.WARN;
    
    this.log(level, LogCategory.TOOL, `Tool ${toolName} execution`, {
      success,
      duration,
      attempts,
    }, {
      toolName,
      sessionId,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : undefined,
    });

    // Log performance
    this.logPerformance('tool', toolName, duration, success, { attempts });
  }

  // Security logging
  public logSecurityEvent(
    event: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    details: Record<string, any>,
    ip?: string,
    userId?: string
  ): void {
    const levelMap = {
      low: LogLevel.INFO,
      medium: LogLevel.WARN,
      high: LogLevel.ERROR,
      critical: LogLevel.CRITICAL,
    };

    this.log(levelMap[severity], LogCategory.SECURITY, `Security: ${event}`, details, {
      userId,
      context: { ip },
    });
  }

  // Console logging with colors and formatting
  private logToConsole(entry: LogEntry): void {
    const timestamp = entry.timestamp.toISOString();
    const levelStr = LogLevel[entry.level].padEnd(8);
    const categoryStr = entry.category.padEnd(12);
    
    // Color coding for console
    const colors = {
      [LogLevel.DEBUG]: '\x1b[36m', // Cyan
      [LogLevel.INFO]: '\x1b[32m',  // Green
      [LogLevel.WARN]: '\x1b[33m',  // Yellow
      [LogLevel.ERROR]: '\x1b[31m', // Red
      [LogLevel.CRITICAL]: '\x1b[35m', // Magenta
    };
    const reset = '\x1b[0m';
    const color = colors[entry.level] || '';

    const baseLog = `${color}[${timestamp}] ${levelStr} ${categoryStr}${reset} ${entry.message}`;

    if (entry.data || entry.error || entry.context) {
      console.log(baseLog);
      if (entry.data) console.log('  Data:', JSON.stringify(entry.data, null, 2));
      if (entry.error) console.log('  Error:', entry.error);
      if (entry.context) console.log('  Context:', JSON.stringify(entry.context, null, 2));
    } else {
      console.log(baseLog);
    }
  }

  // File logging with rotation
  private logToFile(entry: LogEntry): void {
    if (!this.config.enableFile) return;

    const logFile = join(this.config.logDirectory, `tripxplo-${new Date().toISOString().split('T')[0]}.log`);
    
    const logLine = this.config.enableStructuredLogging 
      ? JSON.stringify(entry) + '\n'
      : `[${entry.timestamp.toISOString()}] ${LogLevel[entry.level]} ${entry.category} - ${entry.message}\n`;

    try {
      appendFileSync(logFile, logLine);
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  // Flush log buffer to file
  private flushBuffer(): void {
    if (this.logBuffer.length === 0) return;

    // Write all buffered logs to file
    this.logBuffer.forEach(entry => this.logToFile(entry));
    
    // Clear buffer
    this.logBuffer = [];
  }

  // Get recent logs for debugging
  public getRecentLogs(count: number = 100): LogEntry[] {
    return this.logBuffer.slice(-count);
  }

  // Get performance summary
  public getPerformanceSummary(): {
    totalOperations: number;
    successRate: number;
    averageDuration: number;
    categorySummary: Record<string, { count: number; avgDuration: number; successRate: number }>;
  } {
    const total = this.performanceMetrics.length;
    const successful = this.performanceMetrics.filter(m => m.success).length;
    const totalDuration = this.performanceMetrics.reduce((sum, m) => sum + m.duration, 0);

    // Category breakdown
    const categorySummary: Record<string, { count: number; avgDuration: number; successRate: number }> = {};
    
    for (const metric of this.performanceMetrics) {
      if (!categorySummary[metric.category]) {
        categorySummary[metric.category] = { count: 0, avgDuration: 0, successRate: 0 };
      }
      
      const cat = categorySummary[metric.category];
      cat.count++;
      cat.avgDuration = ((cat.avgDuration * (cat.count - 1)) + metric.duration) / cat.count;
    }

    // Calculate success rates
    for (const category in categorySummary) {
      const categoryMetrics = this.performanceMetrics.filter(m => m.category === category);
      const categorySuccessful = categoryMetrics.filter(m => m.success).length;
      categorySummary[category].successRate = (categorySuccessful / categoryMetrics.length) * 100;
    }

    return {
      totalOperations: total,
      successRate: total > 0 ? (successful / total) * 100 : 0,
      averageDuration: total > 0 ? totalDuration / total : 0,
      categorySummary,
    };
  }

  // Shutdown logger gracefully
  public shutdown(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    
    // Final flush
    this.flushBuffer();
    
    this.info(LogCategory.SYSTEM, 'Logger shutting down gracefully');
  }

  // Update configuration
  public updateConfig(newConfig: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

// Global logger instance
export const logger = new ComprehensiveLogger();

// Convenience functions for quick logging
export const logInfo = (category: LogCategory, message: string, data?: Record<string, any>) => 
  logger.info(category, message, data);

export const logError = (category: LogCategory, message: string, error?: Error, data?: Record<string, any>) => 
  logger.error(category, message, error, data);

export const logPerformance = (category: string, operation: string, duration: number, success: boolean) =>
  logger.logPerformance(category, operation, duration, success);

export const logAPIRequest = (method: string, endpoint: string, statusCode: number, duration: number) =>
  logger.logAPIRequest(method, endpoint, statusCode, duration);

// Express middleware for automatic API logging
export function createLoggingMiddleware() {
  return (req: any, res: any, next: any) => {
    const startTime = Date.now();
    
    // Override res.end to capture response
    const originalEnd = res.end;
    res.end = function(...args: any[]) {
      const duration = Date.now() - startTime;
      logger.logAPIRequest(
        req.method,
        req.originalUrl || req.url,
        res.statusCode,
        duration,
        req.user?.id,
        req.sessionId,
        req.ip || req.connection.remoteAddress,
        req.get('User-Agent')
      );
      
      originalEnd.apply(this, args);
    };
    
    next();
  };
}