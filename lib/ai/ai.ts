import OpenAI from "openai";
import { logger } from '../utils/logger';
import { withRetry, RetryError } from '../utils/retry';
import { handleError, AppError, ErrorCode, createUserFriendlyMessage } from '../utils/errors';
import { getPromptTemplate, getErrorMessage } from './prompts';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface TripIntent {
  intent: 'get_packages' | 'ask_general' | 'unknown';
  destination: string | null;
  duration: number | null;
  planType: string | null;
  confidence?: number;
}


const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Configuration
const AI_CONFIG = {
  model: "gpt-4o",
  maxTokens: {
    intent: 200,
    followUp: 200,
    general: 500,
    format: 600
  },
  temperature: {
    intent: 0.1,
    followUp: 0.7,
    general: 0.6,
    format: 0.6
  },
  timeout: 30000, // 30 seconds
  retryOptions: {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 5000,
    backoffMultiplier: 2
  }
};

// Analyze user intent using GPT
async function analyzeUserIntent(messages: Message[]): Promise<TripIntent> {
  const requestId = `intent-${Date.now()}`;
  logger.info('Starting intent analysis', {
    component: 'IntentAnalyzer',
    requestId,
    messageCount: messages.length
  });

  try {
    const conversationHistory = messages.map(m => `${m.role}: ${m.content}`).join('\n');
    
    const response = await withRetry(
      async () => {
        logger.debug('Making OpenAI request for intent analysis', {
          component: 'IntentAnalyzer',
          requestId,
          model: AI_CONFIG.model
        });

        return await openai.chat.completions.create({
          messages: [
            {
              role: 'system',
              content: getPromptTemplate('INTENT_ANALYZER')
            },
            {
              role: 'user',
              content: `Analyze this conversation:\n\n${conversationHistory}`
            }
          ],
          model: AI_CONFIG.model,
          temperature: AI_CONFIG.temperature.intent,
          max_tokens: AI_CONFIG.maxTokens.intent
        });
      },
      AI_CONFIG.retryOptions,
      {
        operation: 'OpenAI Intent Analysis',
        metadata: { requestId, messageCount: messages.length }
      }
    );

    const content = response.choices?.[0]?.message?.content?.trim();
    if (!content) {
      logger.warn('Empty response from OpenAI intent analysis', {
        component: 'IntentAnalyzer',
        requestId
      });
      return { intent: 'unknown', destination: null, duration: null, planType: null, confidence: 0.0 };
    }

    try {
      const parsed = JSON.parse(content);
      const result = {
        intent: parsed.intent || 'unknown',
        destination: parsed.destination || null,
        duration: parsed.duration || null,
        planType: parsed.planType || null,
        confidence: parsed.confidence || 0.5
      };

      logger.info('Intent analysis completed successfully', {
        component: 'IntentAnalyzer',
        requestId,
        result
      });

      return result;
    } catch (parseError) {
      logger.error('Intent parsing error', parseError as Error, {
        component: 'IntentAnalyzer',
        requestId,
        rawContent: content
      });
      return {
        intent: 'unknown',
        destination: null,
        duration: null,
        planType: null,
        confidence: 0.0
      };
    }
  } catch (error) {
    const appError = handleError(error, {
      component: 'IntentAnalyzer',
      requestId,
      operation: 'analyzeUserIntent'
    });

    logger.error('Intent analysis failed', appError, {
      component: 'IntentAnalyzer',
      requestId
    });

    return { intent: 'unknown', destination: null, duration: null, planType: null, confidence: 0.0 };
  }
}


export async function processWithai(messages: Message[]): Promise<string> {
  const requestId = `process-${Date.now()}`;
  logger.info('Starting AI processing', {
    component: 'AIProcessor',
    requestId,
    messageCount: messages.length
  });

  logger.time(`AI-Processing-${requestId}`);
  
  const lastUserMessage = messages.filter(m => m.role === 'user').pop();
  if (!lastUserMessage) {
    logger.info('No user message found, returning welcome message', {
      component: 'AIProcessor',
      requestId
    });
    return getErrorMessage('GENERIC_ERROR');
  }

  // Use GPT to analyze user intent and extract structured information
  const intent = await analyzeUserIntent(messages);
  logger.info('Intent analysis completed', {
    component: 'AIProcessor',
    requestId,
    intent
  });

  // Handle different intents
  let result: string;
  try {
  switch (intent.intent) {
    case 'get_packages':
        result = await handlePackageRequest(intent, messages, requestId);
        break;
    
    case 'ask_general':
        result = await handleGeneralQuery(messages, requestId);
        break;
    
    default:
        result = await handleGeneralQuery(messages, requestId);
        break;
  }

    logger.timeEnd(`AI-Processing-${requestId}`);
    logger.info('AI processing completed successfully', {
      component: 'AIProcessor',
      requestId,
      responseLength: result.length
    });

    return result;
  } catch (error) {
    logger.timeEnd(`AI-Processing-${requestId}`);
    const appError = handleError(error, {
      component: 'AIProcessor',
      requestId,
      intent
    });

    logger.error('AI processing failed', appError, {
      component: 'AIProcessor',
      requestId
    });

    return createUserFriendlyMessage(appError);
  }
}

// Handle package requests with smart conversation flow
async function handlePackageRequest(intent: TripIntent, messages: Message[], requestId: string): Promise<string> {
  logger.info('Handling package request', {
    component: 'PackageHandler',
    requestId,
    intent
  });

  const { destination, duration, planType } = intent;
  
  // Check what information we have and what we need
  const missingInfo = [];
  if (!destination) missingInfo.push('destination');
  if (!duration) missingInfo.push('duration');
  
  // If we have all required info, fetch packages
  if (missingInfo.length === 0) {
    logger.info('All required info available, fetching packages', {
      component: 'PackageHandler',
      requestId,
      destination,
      duration,
      planType
    });
    
    try {
      // Build API URL for packages
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
      
      let apiUrl = `${baseUrl}/api/packages?destination=${encodeURIComponent(destination!)}&duration=${duration!}`;
      if (planType) {
        apiUrl += `&plan=${encodeURIComponent(planType)}`;
      }
      
      const packages = await withRetry(
        async () => {
          logger.debug('Fetching packages from API', {
            component: 'PackageHandler',
            requestId,
            apiUrl
          });

          const response = await fetch(apiUrl);
          if (!response.ok) {
            throw new Error(`API responded with status: ${response.status}`);
          }
          return await response.json();
        },
        AI_CONFIG.retryOptions,
        {
          operation: 'Package API Fetch',
          metadata: { requestId, destination, duration, planType }
        }
      );
      
      if (!packages || packages.length === 0) {
        logger.info('No packages found', {
          component: 'PackageHandler',
          requestId,
          destination,
          duration,
          planType
        });
        return await generateNoPackagesResponse(destination, duration, planType, requestId);
      }
      
      logger.info('Packages found, formatting response', {
        component: 'PackageHandler',
        requestId,
        packageCount: packages.length
      });
      return await formatPackagesResponse(packages, destination, duration, planType, requestId);
      
    } catch (error) {
      const appError = handleError(error, {
        component: 'PackageHandler',
        requestId,
        operation: 'fetchPackages',
        destination,
        duration,
        planType
      });

      if (appError instanceof RetryError) {
        return getErrorMessage('API_CONNECTION_FAILED');
      }

      return createUserFriendlyMessage(appError);
    }
  }
  
  // Generate natural follow-up questions for missing information
  logger.info('Missing information, generating follow-up question', {
    component: 'PackageHandler',
    requestId,
    missingInfo
  });
  return await generateFollowUpQuestion(intent, missingInfo, messages, requestId);
}

// Generate natural follow-up questions when information is missing
async function generateFollowUpQuestion(intent: TripIntent, missingInfo: string[], messages: Message[], requestId: string): Promise<string> {
  logger.info('Generating follow-up question', {
    component: 'FollowUpGenerator',
    requestId,
    missingInfo,
    intent
  });

  try {
    const conversationHistory = messages.map(m => `${m.role}: ${m.content}`).join('\n');
    
    const response = await withRetry(
      async () => {
        return await openai.chat.completions.create({
          messages: [
            {
              role: 'system',
              content: getPromptTemplate('FOLLOW_UP_GENERATOR')
            },
            {
              role: 'user',
              content: `Generate a follow-up question based on this conversation and missing info: ${missingInfo.join(', ')}\n\nConversation:\n${conversationHistory}`
            }
          ],
          model: AI_CONFIG.model,
          temperature: AI_CONFIG.temperature.followUp,
          max_tokens: AI_CONFIG.maxTokens.followUp
        });
      },
      AI_CONFIG.retryOptions,
      {
        operation: 'Follow-up Question Generation',
        metadata: { requestId, missingInfo }
      }
    );

    const result = response.choices?.[0]?.message?.content?.trim() || 
      "I'd love to help you find the perfect trip! Could you tell me more about what you're looking for? 🌍";

    logger.info('Follow-up question generated successfully', {
      component: 'FollowUpGenerator',
      requestId,
      responseLength: result.length
    });

    return result;
      
  } catch (error) {
    const appError = handleError(error, {
      component: 'FollowUpGenerator',
      requestId,
      operation: 'generateFollowUpQuestion',
      missingInfo
    });

    logger.error('Follow-up question generation failed', appError, {
      component: 'FollowUpGenerator',
      requestId
    });
    
    // Fallback questions based on missing info
    if (missingInfo.includes('destination')) {
      return "I'd love to help you find the perfect trip! 🌍 Where would you like to go?";
    } else if (missingInfo.includes('duration')) {
      return `Great choice! ${intent.destination} sounds amazing! 🎯 How many days are you planning for this trip?`;
    }
    
    return "I'd love to help you find the perfect trip! Could you tell me more about what you're looking for? 🌍";
  }
}

// Handle general travel queries
async function handleGeneralQuery(messages: Message[], requestId: string): Promise<string> {
  logger.info('Handling general travel query', {
    component: 'GeneralQueryHandler',
    requestId,
    messageCount: messages.length
  });

  try {
    const response = await withRetry(
      async () => {
        return await openai.chat.completions.create({
          messages: [{
            role: 'system',
            content: getPromptTemplate('TRAVEL_ASSISTANT')
          }, ...messages],
          model: AI_CONFIG.model,
          temperature: AI_CONFIG.temperature.general,
          max_tokens: AI_CONFIG.maxTokens.general
        });
      },
      AI_CONFIG.retryOptions,
      {
        operation: 'General Query Processing',
        metadata: { requestId, messageCount: messages.length }
      }
    );

    const messageContent = response.choices?.[0]?.message?.content ?? "";
    
    logger.info('General query processed successfully', {
      component: 'GeneralQueryHandler',
      requestId,
      responseLength: messageContent.length
    });

    if (!messageContent) {
      logger.warn('Empty response from general query processing', {
        component: 'GeneralQueryHandler',
        requestId
      });
      return getErrorMessage('GENERIC_ERROR');
    }

    return messageContent;
  } catch (error) {
    const appError = handleError(error, {
      component: 'GeneralQueryHandler',
      requestId,
      operation: 'handleGeneralQuery'
    });

    logger.error('General query processing failed', appError, {
      component: 'GeneralQueryHandler',
      requestId
    });

    return createUserFriendlyMessage(appError);
  }
}

// Generate response when no packages are found
async function generateNoPackagesResponse(destination: string | null, duration: number | null, planType: string | null, requestId: string): Promise<string> {
  logger.info('Generating no packages response', {
    component: 'NoPackagesGenerator',
    requestId,
    destination,
    duration,
    planType
  });

  const planText = planType ? ` for ${planType} trips` : '';
  const durationText = duration ? `${duration}-day ` : '';
  const destinationText = destination || 'your chosen destination';
  return `😕 **No packages found**\n\nSorry, I couldn't find any ${durationText}packages${planText} for ${destinationText} right now.\n\n🔄 **Try:**\n• Different duration (3-7 days are popular)\n• Different destination\n• Remove specific trip type filter\n\n💡 *Our inventory updates regularly, so check back soon!*`;
}

// Format packages response using GPT
async function formatPackagesResponse(packages: any[], destination: string | null, duration: number | null, planType: string | null, requestId: string): Promise<string> {
  logger.info('Formatting packages response', {
    component: 'PackageFormatter',
    requestId,
    packageCount: packages.length,
    destination,
    duration,
    planType
  });

  try {
    const packagesData = JSON.stringify({
      packages: packages.slice(0, 3).map(pkg => ({
        name: pkg.packageName,
        destination: pkg.destinationName || destination,
        days: pkg.noOfDays,
        nights: pkg.noOfNight,
        startFrom: pkg.startFrom,
        hotels: pkg.hotelCount || 0,
        activities: pkg.activityCount || 0,
        packageId: pkg.packageId
      })),
      searchCriteria: { destination, duration, planType }
    });

    const response = await withRetry(
      async () => {
        return await openai.chat.completions.create({
          messages: [
            {
              role: 'system',
              content: getPromptTemplate('PACKAGE_FORMATTER')
            },
            {
              role: 'user',
              content: `Format these travel packages beautifully: ${packagesData}`
            }
          ],
          model: AI_CONFIG.model,
          temperature: AI_CONFIG.temperature.format,
          max_tokens: AI_CONFIG.maxTokens.format
        });
      },
      AI_CONFIG.retryOptions,
      {
        operation: 'Package Response Formatting',
        metadata: { requestId, packageCount: packages.length }
      }
    );

    const result = response.choices?.[0]?.message?.content ?? 
      `✨ Found ${packages.length} packages for your ${duration}-day trip to ${destination}!\n\n${packages.slice(0, 3).map(pkg => 
        `🌍 ${pkg.packageName}\n📅 ${pkg.noOfDays} Days / ${pkg.noOfNight} Nights\n💸 From ₹${pkg.startFrom}\n🔖 ID: ${pkg.packageId}`
      ).join('\n\n')}`;

    logger.info('Package response formatted successfully', {
      component: 'PackageFormatter',
      requestId,
      responseLength: result.length
    });

    return result;
      
  } catch (error) {
    const appError = handleError(error, {
      component: 'PackageFormatter',
      requestId,
      operation: 'formatPackagesResponse',
      packageCount: packages.length
    });

    logger.error('Package formatting failed', appError, {
      component: 'PackageFormatter',
      requestId
    });

    // Return fallback formatting
    return `✨ Found ${packages.length} packages for your ${duration}-day trip to ${destination}!\n\n${packages.slice(0, 3).map(pkg => 
      `🌍 ${pkg.packageName}\n📅 ${pkg.noOfDays} Days / ${pkg.noOfNight} Nights\n💸 From ₹${pkg.startFrom}\n🔖 ID: ${pkg.packageId}`
    ).join('\n\n')}`;
  }
}
