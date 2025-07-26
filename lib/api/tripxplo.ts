import { logger } from '../utils/logger';
import { withRetry } from '../utils/retry';
import { handleError, AppError, ErrorCode } from '../utils/errors';

const API_BASE = "https://api.tripxplo.com/v1/api";
const LOGIN_ENDPOINT = `${API_BASE}/admin/auth/login`;
const PACKAGE_ENDPOINT = `${API_BASE}/admin/package`;

const DEFAULT_HEADERS = {
  "Content-Type": "application/json",
  "Origin": "https://admin.tripxplo.com",
  "Referer": "https://admin.tripxplo.com/",
  "User-Agent": "Mozilla/5.0",
};

let cachedToken: string | null = null;
let tokenExpiry: number = 0;

// Configuration
const API_CONFIG = {
  timeout: 30000, // 30 seconds
  retryOptions: {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 8000,
    backoffMultiplier: 2,
    retryCondition: (error: Error) => {
      // Retry on network errors and 5xx status codes, but not on auth errors
      return (
        error.message.includes('fetch') ||
        error.message.includes('timeout') ||
        error.message.includes('ECONNRESET') ||
        error.message.includes('ENOTFOUND') ||
        (error.message.includes('status') && /5\d\d/.test(error.message))
      ) && !error.message.includes('401') && !error.message.includes('403');
    }
  }
};

export async function getAccessToken(): Promise<string> {
  const requestId = `auth-${Date.now()}`;
  
  if (cachedToken && Date.now() < tokenExpiry) {
    logger.debug('Using cached access token', {
      component: 'TripXploAuth',
      requestId,
      expiresIn: Math.round((tokenExpiry - Date.now()) / 1000)
    });
    return cachedToken;
  }

  logger.info('Requesting new access token', {
    component: 'TripXploAuth',
    requestId
  });

  const email = process.env.TRIPXPLO_EMAIL;
  const password = process.env.TRIPXPLO_PASSWORD;
  if (!email || !password) {
    const error = new AppError(
      ErrorCode.SYSTEM_CONFIGURATION_ERROR,
      'TripXplo API credentials are missing from environment variables',
      500,
      true,
      { component: 'TripXploAuth', requestId }
    );
    throw error;
  }

  try {
    const response = await withRetry(
      async () => {
        logger.debug('Making login request to TripXplo API', {
          component: 'TripXploAuth',
          requestId,
          endpoint: LOGIN_ENDPOINT,
          email
        });

        const response = await fetch(LOGIN_ENDPOINT, {
          method: "PUT",
          headers: DEFAULT_HEADERS,
          body: JSON.stringify({ email, password }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          logger.error('TripXplo login failed', new Error(`HTTP ${response.status}`), {
            component: 'TripXploAuth',
            requestId,
            status: response.status,
            statusText: response.statusText,
            email,
            responseBody: errorText.substring(0, 200)
          });
          
          if (response.status === 401 || response.status === 403) {
            throw new AppError(
              ErrorCode.API_AUTHENTICATION_FAILED,
              `Authentication failed: Invalid credentials (${response.status})`,
              response.status,
              true,
              { requestId, email, status: response.status }
            );
          }
          
          throw new Error(`Login failed with status: ${response.status}`);
        }

        return response;
      },
      {
        ...API_CONFIG.retryOptions,
        retryCondition: (error: Error) => {
          // Don't retry auth failures
          return API_CONFIG.retryOptions.retryCondition!(error) && 
                 !error.message.includes('Authentication failed');
        }
      },
      {
        operation: 'TripXplo Authentication',
        metadata: { requestId, email }
      }
    );

    const tokens = await response.json();
    cachedToken = tokens.accessToken;
    tokenExpiry = Date.now() + 3600000; // 1 hour

    if (!cachedToken) {
      throw new AppError(
        ErrorCode.API_AUTHENTICATION_FAILED,
        'No access token received from TripXplo API',
        500,
        true,
        { requestId, email }
      );
    }

    logger.info('Access token obtained successfully', {
      component: 'TripXploAuth',
      requestId,
      expiresIn: 3600
    });

    return cachedToken;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    
    const appError = handleError(error, {
      component: 'TripXploAuth',
      requestId,
      operation: 'getAccessToken',
      email
    });
    
    throw appError;
  }
}

async function makeAuthenticatedRequest(url: string, options: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken();
  const requestId = `api-${Date.now()}`;
  
  logger.debug('Making authenticated request', {
    component: 'TripXploAPI',
    requestId,
    url: url.replace(/\?.*/, ''), // Remove query params from logs
    method: options.method || 'GET'
  });

  return await withRetry(
    async () => {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...DEFAULT_HEADERS,
          Authorization: `Bearer ${token}`,
          "Cache-Control": "no-cache",
          ...options.headers,
        },
      });

      if (!response.ok) {
        logger.warn('API request failed', {
          component: 'TripXploAPI',
          requestId,
          status: response.status,
          statusText: response.statusText,
          url: url.replace(/\?.*/, '')
        });
        
        if (response.status === 401) {
          // Clear cached token on auth failure
          cachedToken = null;
          tokenExpiry = 0;
          throw new AppError(
            ErrorCode.API_AUTHENTICATION_FAILED,
            'Authentication token expired or invalid',
            401,
            true,
            { requestId, url }
          );
        }
        
        if (response.status === 429) {
          throw new AppError(
            ErrorCode.API_RATE_LIMIT_EXCEEDED,
            'API rate limit exceeded',
            429,
            true,
            { requestId, url }
          );
        }
        
        throw new Error(`API request failed with status: ${response.status}`);
      }

      logger.debug('API request successful', {
        component: 'TripXploAPI',
        requestId,
        status: response.status
      });

      return response;
    },
    API_CONFIG.retryOptions,
    {
      operation: 'TripXplo API Request',
      metadata: { requestId, url: url.replace(/\?.*/, '') }
    }
  );
}

export async function getPackages(search?: string): Promise<any[]> {
  const requestId = `packages-${Date.now()}`;
  logger.info('Fetching packages', {
    component: 'TripXploAPI',
    requestId,
    search: search || 'all'
  });

  logger.time(`PackageFetch-${requestId}`);
  
  let allPackages: any[] = [];
  let offset = 0;
  const limit = 270;
  
  try {
    while (true) {
      const url = `${PACKAGE_ENDPOINT}?limit=${limit}&offset=${offset}&search=${search || ''}`;
      
      logger.debug('Fetching package batch', {
        component: 'TripXploAPI',
        requestId,
        offset,
        limit,
        batchNumber: Math.floor(offset / limit) + 1
      });

      const response = await makeAuthenticatedRequest(url);
      const data = await response.json();
      const packages = data.result?.docs || [];
      
      logger.debug('Package batch received', {
        component: 'TripXploAPI',
        requestId,
        batchSize: packages.length,
        totalSoFar: allPackages.length + packages.length
      });
      
      if (packages.length === 0) break;
      
      allPackages.push(...packages);
      
      if (packages.length < limit) break;
      
      offset += limit;
    }
    
    logger.timeEnd(`PackageFetch-${requestId}`);
    logger.info('Package fetch completed', {
      component: 'TripXploAPI',
      requestId,
      totalPackages: allPackages.length,
      search: search || 'all'
    });
    
    return allPackages;
  } catch (error) {
    logger.timeEnd(`PackageFetch-${requestId}`);
    
    if (error instanceof AppError) {
      throw error;
    }
    
    const appError = handleError(error, {
      component: 'TripXploAPI',
      requestId,
      operation: 'getPackages',
      search,
      offset,
      totalFetched: allPackages.length
    });

    throw appError;
  }
}

export async function getPackageById(id: string): Promise<any | null> {
  const requestId = `package-${Date.now()}`;
  logger.info('Fetching package by ID', {
    component: 'TripXploAPI',
    requestId,
    packageId: id
  });

  try {
    const response = await makeAuthenticatedRequest(`${PACKAGE_ENDPOINT}/${id}`);
    const data = await response.json();
    const result = data.result || null;
    
    logger.info('Package fetch by ID completed', {
      component: 'TripXploAPI',
      requestId,
      packageId: id,
      found: !!result
    });
    
    return result;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    
    const appError = handleError(error, {
      component: 'TripXploAPI',
      requestId,
      operation: 'getPackageById',
      packageId: id
    });
    
    throw appError;
  }
}