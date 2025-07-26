import { logger } from './logger';

export interface RetryOptions {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryCondition?: (error: Error) => boolean;
}

export class RetryError extends Error {
  constructor(
    message: string,
    public readonly attempts: number,
    public readonly lastError: Error
  ) {
    super(message);
    this.name = 'RetryError';
  }
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: Partial<RetryOptions> = {},
  context?: { operation: string; metadata?: Record<string, any> }
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    backoffMultiplier = 2,
    retryCondition = (error: Error) => {
      // Retry on network errors, timeouts, and 5xx status codes
      return (
        error.message.includes('fetch') ||
        error.message.includes('timeout') ||
        error.message.includes('ECONNRESET') ||
        error.message.includes('ENOTFOUND') ||
        (error.message.includes('status') && /5\d\d/.test(error.message))
      );
    }
  } = options;

  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      logger.debug(`Attempting operation: ${context?.operation || 'unknown'}`, {
        component: 'RetryMechanism',
        attempt,
        maxAttempts,
        metadata: context?.metadata
      });

      const result = await operation();
      
      if (attempt > 1) {
        logger.info(`Operation succeeded after ${attempt} attempts: ${context?.operation || 'unknown'}`, {
          component: 'RetryMechanism',
          attempts: attempt,
          metadata: context?.metadata
        });
      }
      
      return result;
    } catch (error) {
      lastError = error as Error;
      
      logger.warn(`Operation failed on attempt ${attempt}: ${context?.operation || 'unknown'}`, {
        component: 'RetryMechanism',
        attempt,
        maxAttempts,
        error: lastError.message,
        metadata: context?.metadata
      });

      if (attempt === maxAttempts || !retryCondition(lastError)) {
        break;
      }

      const delay = Math.min(baseDelay * Math.pow(backoffMultiplier, attempt - 1), maxDelay);
      logger.debug(`Retrying in ${delay}ms`, {
        component: 'RetryMechanism',
        delay,
        nextAttempt: attempt + 1
      });
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  logger.error(`Operation failed after ${maxAttempts} attempts: ${context?.operation || 'unknown'}`, lastError!, {
    component: 'RetryMechanism',
    attempts: maxAttempts,
    metadata: context?.metadata
  });

  throw new RetryError(
    `Operation failed after ${maxAttempts} attempts: ${lastError!.message}`,
    maxAttempts,
    lastError!
  );
}