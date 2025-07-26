import { logger } from './logger';

export enum ErrorCode {
  // API Errors
  API_AUTHENTICATION_FAILED = 'API_AUTHENTICATION_FAILED',
  API_RATE_LIMIT_EXCEEDED = 'API_RATE_LIMIT_EXCEEDED',
  API_REQUEST_FAILED = 'API_REQUEST_FAILED',
  API_TIMEOUT = 'API_TIMEOUT',
  
  // AI Errors
  AI_MODEL_ERROR = 'AI_MODEL_ERROR',
  AI_PROMPT_ERROR = 'AI_PROMPT_ERROR',
  AI_RESPONSE_PARSING_ERROR = 'AI_RESPONSE_PARSING_ERROR',
  
  // Data Errors
  DATA_VALIDATION_ERROR = 'DATA_VALIDATION_ERROR',
  DATA_NOT_FOUND = 'DATA_NOT_FOUND',
  DATA_PROCESSING_ERROR = 'DATA_PROCESSING_ERROR',
  
  // System Errors
  SYSTEM_CONFIGURATION_ERROR = 'SYSTEM_CONFIGURATION_ERROR',
  SYSTEM_RESOURCE_ERROR = 'SYSTEM_RESOURCE_ERROR',
  
  // User Errors
  USER_INPUT_INVALID = 'USER_INPUT_INVALID',
  USER_UNAUTHORIZED = 'USER_UNAUTHORIZED'
}

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly statusCode: number = 500,
    public readonly isOperational: boolean = true,
    public readonly context?: Record<string, any>
  ) {
    super(message);
    this.name = 'AppError';
    
    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);
    
    // Log the error
    logger.error(`AppError: ${code}`, this, {
      component: 'ErrorHandler',
      code,
      statusCode,
      isOperational,
      context
    });
  }
}

export class ValidationError extends AppError {
  constructor(message: string, field?: string, value?: any) {
    super(
      ErrorCode.DATA_VALIDATION_ERROR,
      message,
      400,
      true,
      { field, value }
    );
    this.name = 'ValidationError';
  }
}

export class APIError extends AppError {
  constructor(
    code: ErrorCode,
    message: string,
    statusCode: number = 500,
    context?: Record<string, any>
  ) {
    super(code, message, statusCode, true, context);
    this.name = 'APIError';
  }
}

export function handleError(error: unknown, context?: Record<string, any>): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof Error) {
    // Handle specific error types
    if (error.message.includes('fetch')) {
      return new APIError(
        ErrorCode.API_REQUEST_FAILED,
        `Network request failed: ${error.message}`,
        503,
        { originalError: error.message, ...context }
      );
    }

    if (error.message.includes('timeout')) {
      return new APIError(
        ErrorCode.API_TIMEOUT,
        `Request timeout: ${error.message}`,
        408,
        { originalError: error.message, ...context }
      );
    }

    if (error.message.includes('401') || error.message.includes('unauthorized')) {
      return new APIError(
        ErrorCode.API_AUTHENTICATION_FAILED,
        `Authentication failed: ${error.message}`,
        401,
        { originalError: error.message, ...context }
      );
    }

    if (error.message.includes('429') || error.message.includes('rate limit')) {
      return new APIError(
        ErrorCode.API_RATE_LIMIT_EXCEEDED,
        `Rate limit exceeded: ${error.message}`,
        429,
        { originalError: error.message, ...context }
      );
    }

    // Generic error handling
    return new AppError(
      ErrorCode.SYSTEM_RESOURCE_ERROR,
      error.message,
      500,
      true,
      { originalError: error.message, stack: error.stack, ...context }
    );
  }

  // Handle non-Error objects
  return new AppError(
    ErrorCode.SYSTEM_RESOURCE_ERROR,
    'An unknown error occurred',
    500,
    false,
    { originalError: String(error), ...context }
  );
}

export function createUserFriendlyMessage(error: AppError): string {
  switch (error.code) {
    case ErrorCode.API_AUTHENTICATION_FAILED:
      return "🔐 **Authentication Issue**\n\nThere's a temporary issue with our travel database connection. Please try again in a moment.";
    
    case ErrorCode.API_RATE_LIMIT_EXCEEDED:
      return "⏱️ **Service Busy**\n\nOur travel system is experiencing high demand. Please wait a moment and try again.";
    
    case ErrorCode.API_TIMEOUT:
      return "⏰ **Connection Timeout**\n\nThe request is taking longer than expected. Please try again with a simpler query.";
    
    case ErrorCode.DATA_NOT_FOUND:
      return "🔍 **No Results Found**\n\nI couldn't find any packages matching your criteria. Try adjusting your search parameters.";
    
    case ErrorCode.USER_INPUT_INVALID:
      return "📝 **Invalid Input**\n\nPlease check your request and try again with valid travel details.";
    
    case ErrorCode.AI_MODEL_ERROR:
      return "🤖 **AI Service Temporarily Unavailable**\n\nOur AI assistant is briefly offline. Please try again in a moment.";
    
    default:
      return "🔧 **Service Temporarily Unavailable**\n\nWe're experiencing a brief technical issue. Please try again shortly.\n\n✨ *Great travel experiences are worth the wait!* 🌟";
  }
}