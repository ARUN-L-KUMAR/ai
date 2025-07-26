// Enhanced AI Agent API - Phase 1 Foundation with monitoring and middleware
import { NextApiRequest, NextApiResponse } from 'next';
import { enhancedAIProcessor } from '../../lib/ai/enhanced-ai';
import { 
  errorHandler, 
  createAPIError, 
  createValidationError,
  ErrorSeverity 
} from '../../lib/error-handling/enhanced-error-handler';
import { 
  Message, 
  generateId, 
  validateMessage 
} from '../../lib/types/agent-types';
import { toolMiddleware } from '../../lib/middleware/tool-middleware';

// API performance metrics
interface APIMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  totalResponseTime: number;
  lastRequestTime: Date | null;
}

class APIMetricsCollector {
  private metrics: APIMetrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageResponseTime: 0,
    totalResponseTime: 0,
    lastRequestTime: null,
  };

  public recordRequest(responseTime: number, success: boolean): void {
    this.metrics.totalRequests++;
    this.metrics.totalResponseTime += responseTime;
    this.metrics.lastRequestTime = new Date();
    
    if (success) {
      this.metrics.successfulRequests++;
    } else {
      this.metrics.failedRequests++;
    }
    
    this.metrics.averageResponseTime = 
      this.metrics.totalResponseTime / this.metrics.totalRequests;
  }

  public getMetrics(): APIMetrics & { successRate: number } {
    const successRate = this.metrics.totalRequests > 0 
      ? (this.metrics.successfulRequests / this.metrics.totalRequests) * 100 
      : 0;

    return {
      ...this.metrics,
      successRate: Math.round(successRate * 100) / 100,
    };
  }

  public reset(): void {
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      totalResponseTime: 0,
      lastRequestTime: null,
    };
  }
}

const metricsCollector = new APIMetricsCollector();

// Request validation schema
interface ValidatedRequest {
  messages: Message[];
  sessionId: string;
  userId?: string;
  metadata?: {
    userAgent?: string;
    ip?: string;
    timestamp: Date;
  };
}

// Enhanced request validation
function validateRequest(req: NextApiRequest): ValidatedRequest {
  const { messages, sessionId, userId } = req.body;

  // Validate required fields
  if (!messages || !Array.isArray(messages)) {
    throw createValidationError('Messages array is required', {
      body: req.body,
    });
  }

  if (messages.length === 0) {
    throw createValidationError('Messages array cannot be empty', {
      body: req.body,
    });
  }

  // Validate each message
  const validatedMessages: Message[] = messages.map((msg, index) => {
    try {
      return validateMessage({
        ...msg,
        messageId: msg.messageId || generateId(),
        conversationId: sessionId || generateId(),
        timestamp: msg.timestamp || new Date(),
      });
    } catch (error) {
      throw createValidationError(
        `Invalid message at index ${index}: ${error instanceof Error ? error.message : String(error)}`,
        { messageIndex: index, message: msg }
      );
    }
  });

  // Validate session ID (generate if missing)
  const validatedSessionId = sessionId || generateId();

  return {
    messages: validatedMessages,
    sessionId: validatedSessionId,
    userId,
    metadata: {
      userAgent: req.headers['user-agent'],
      ip: req.headers['x-forwarded-for']?.toString() || req.connection.remoteAddress,
      timestamp: new Date(),
    },
  };
}

// Rate limiting (simple in-memory implementation)
class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private readonly windowMs: number = 60000; // 1 minute
  private readonly maxRequests: number = 30; // 30 requests per minute per IP

  public isAllowed(identifier: string): boolean {
    const now = Date.now();
    const requests = this.requests.get(identifier) || [];
    
    // Remove old requests outside the window
    const validRequests = requests.filter(time => now - time < this.windowMs);
    
    if (validRequests.length >= this.maxRequests) {
      return false;
    }
    
    // Add current request
    validRequests.push(now);
    this.requests.set(identifier, validRequests);
    
    return true;
  }

  public cleanup(): void {
    const now = Date.now();
    for (const [identifier, requests] of this.requests.entries()) {
      const validRequests = requests.filter(time => now - time < this.windowMs);
      if (validRequests.length === 0) {
        this.requests.delete(identifier);
      } else {
        this.requests.set(identifier, validRequests);
      }
    }
  }
}

const rateLimiter = new RateLimiter();

// Cleanup rate limiter every 5 minutes
setInterval(() => {
  rateLimiter.cleanup();
  toolMiddleware.cleanupOldContexts();
}, 300000);

// Main enhanced API handler
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const startTime = Date.now();
  let success = false;

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    const error = createAPIError('Method not allowed', {
      method: req.method,
      url: req.url,
    });
    
    metricsCollector.recordRequest(Date.now() - startTime, false);
    
    return res.status(405).json({ 
      error: 'Method not allowed',
      errorId: error.id,
      allowedMethods: ['POST'],
    });
  }

  try {
    console.log('🚀 Enhanced AI Agent API request received');
    
    // Rate limiting check
    const clientId = req.headers['x-forwarded-for']?.toString() || 
                    req.connection.remoteAddress || 
                    'unknown';
    
    if (!rateLimiter.isAllowed(clientId)) {
      const error = createAPIError('Rate limit exceeded', {
        clientId,
        limit: '30 requests per minute',
      });
      
      metricsCollector.recordRequest(Date.now() - startTime, false);
      
      return res.status(429).json({
        error: 'Rate limit exceeded. Please try again later.',
        errorId: error.id,
        retryAfter: 60,
      });
    }

    // Validate request
    const validatedRequest = validateRequest(req);
    console.log('✅ Request validation successful');

    // Process with enhanced AI
    const response = await enhancedAIProcessor.processWithEnhancedAI(
      validatedRequest.messages,
      validatedRequest.sessionId,
      validatedRequest.userId
    );

    console.log('✅ AI processing completed successfully');
    
    success = true;
    const responseTime = Date.now() - startTime;
    
    // Record metrics
    metricsCollector.recordRequest(responseTime, true);
    
    // Return successful response
    res.status(200).json({
      response,
      metadata: {
        processingTime: responseTime,
        sessionId: validatedRequest.sessionId,
        timestamp: new Date().toISOString(),
        version: '2.0.0-phase1',
      },
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error('💥 Enhanced AI Agent API error:', error);
    
    // Record failed request
    metricsCollector.recordRequest(responseTime, false);
    
    // Handle different types of errors
    let statusCode = 500;
    let errorResponse: any = {
      error: 'Internal server error',
      timestamp: new Date().toISOString(),
    };

    if (error && typeof error === 'object' && 'category' in error) {
      // This is an enhanced error
      const enhancedError = error as any;
      
      // Try to handle the error
      const recovery = await errorHandler.handleError(enhancedError);
      
      if (recovery?.userGuidance) {
        statusCode = 400;
        errorResponse = {
          error: recovery.message,
          type: 'validation_error',
          errorId: enhancedError.id,
          guidance: true,
        };
      } else if (recovery?.fallback || recovery?.safeResponse) {
        statusCode = 200; // Return successful response with fallback
        errorResponse = {
          response: recovery.message,
          metadata: {
            processingTime: responseTime,
            fallback: true,
            timestamp: new Date().toISOString(),
          },
        };
      } else {
        // No recovery possible
        switch (enhancedError.category) {
          case 'validation':
            statusCode = 400;
            errorResponse.error = 'Invalid request data';
            break;
          case 'rate_limit':
            statusCode = 429;
            errorResponse.error = 'Rate limit exceeded';
            errorResponse.retryAfter = 60;
            break;
          case 'network':
          case 'api':
            statusCode = 503;
            errorResponse.error = 'Service temporarily unavailable';
            break;
          default:
            statusCode = 500;
            errorResponse.error = 'Internal server error';
        }
        
        errorResponse.errorId = enhancedError.id;
        errorResponse.type = enhancedError.category;
      }
    } else {
      // Handle regular errors
      const enhancedError = createAPIError(
        error instanceof Error ? error.message : String(error),
        {
          url: req.url,
          method: req.method,
          userAgent: req.headers['user-agent'],
        }
      );
      
      errorResponse.errorId = enhancedError.id;
    }

    res.status(statusCode).json(errorResponse);
  }
}

// Health check endpoint
export async function healthCheck(req: NextApiRequest, res: NextApiResponse) {
  try {
    const metrics = metricsCollector.getMetrics();
    const toolMetrics = toolMiddleware.getMetrics();
    const errorStats = errorHandler.getErrorStats();
    
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '2.0.0-phase1',
      uptime: process.uptime(),
      api: {
        ...metrics,
      },
      tools: toolMetrics,
      errors: errorStats,
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        memory: process.memoryUsage(),
      },
    };

    res.status(200).json(health);
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    });
  }
}

// Export metrics endpoint for monitoring
export async function getMetrics(req: NextApiRequest, res: NextApiResponse) {
  try {
    const apiMetrics = metricsCollector.getMetrics();
    const toolMetrics = toolMiddleware.getMetrics();
    const errorStats = errorHandler.getErrorStats();
    
    res.status(200).json({
      timestamp: new Date().toISOString(),
      api: apiMetrics,
      tools: toolMetrics,
      errors: errorStats,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve metrics',
      timestamp: new Date().toISOString(),
    });
  }
}