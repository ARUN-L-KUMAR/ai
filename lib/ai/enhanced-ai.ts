// Enhanced AI System - Integrating Phase 1 Final improvements with GPT-4o
import OpenAI from "openai";
import { 
  Message, 
  TripIntent, 
  TripIntentSchema, 
  ConversationContext, 
  ConversationState,
  generateId,
  validateTripIntent 
} from '../types/agent-types';
import { 
  errorHandler, 
  createAPIError, 
  createValidationError, 
  createSystemError,
  ErrorCategory,
  ErrorSeverity 
} from '../error-handling/enhanced-error-handler';
import { toolMiddleware } from '../middleware/tool-middleware';
import { logger, LogCategory } from '../logging/comprehensive-logger';
import { retryAIOperation } from '../error-handling/advanced-retry-mechanisms';
import { 
  generateIntentAnalysisPrompt,
  generatePackageRecommendationPrompt,
  generateGeneralQueryPrompt,
  generateFollowUpQuestionPrompt 
} from '../prompts/enhanced-prompt-templates';
import { executeEnhancedTool } from '../tools/enhanced-tool-integration';

// Enhanced OpenAI client with better configuration
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 30000, // 30 second timeout
  maxRetries: 3,
});

// Configuration for AI processing
interface AIConfig {
  model: string;
  temperature: number;
  maxTokens: number;
  timeout: number;
  retryAttempts: number;
}

const aiConfig: AIConfig = {
  model: "gpt-4o",
  temperature: 0.6,
  maxTokens: 1000,
  timeout: 30000,
  retryAttempts: 3,
};

// Enhanced AI processor with middleware integration
export class EnhancedAIProcessor {
  private conversations: Map<string, ConversationContext> = new Map();

  constructor() {
    // Register error notification handler
    errorHandler.onError((error) => {
      if (error.severity === ErrorSeverity.CRITICAL) {
        console.error('🚨 Critical AI error detected:', error.message);
      }
    });
  }

  // Main processing function with enhanced error handling
  public async processWithEnhancedAI(
    messages: Message[],
    sessionId: string = generateId(),
    userId?: string
  ): Promise<string> {
    const startTime = Date.now();
    const conversationId = generateId();
    
    try {
      console.log('🚀 Starting enhanced AI processing...');
      console.log('📝 Input messages:', messages.map(m => ({ 
        role: m.role, 
        content: m.content.substring(0, 100) + (m.content.length > 100 ? '...' : '')
      })));
      
      // Get or create conversation context
      const context = this.getOrCreateContext(conversationId, sessionId, userId);
      
      // Add messages to context
      context.messages.push(...messages);
      context.metadata.totalMessages += messages.length;
      
      const lastUserMessage = messages.filter(m => m.role === 'user').pop();
      if (!lastUserMessage) {
        return this.getWelcomeMessage();
      }

      // Update conversation state
      context.state = ConversationState.INTENT_ANALYSIS;
      
      // Analyze user intent with enhanced error handling
      const intent = await this.analyzeUserIntentEnhanced(messages, context);
      context.currentIntent = intent;
      
      console.log('🎯 Analyzed intent:', intent);

      // Route to appropriate handler based on intent
      let result: string;
      
      switch (intent.intent) {
        case 'get_packages':
          context.state = ConversationState.PACKAGE_SEARCH;
          result = await this.handlePackageRequestEnhanced(intent, context);
          break;
        
        case 'get_details':
          context.state = ConversationState.PACKAGE_DETAILS;
          result = await this.handlePackageDetailsEnhanced(intent, context);
          break;
        
        case 'get_pricing':
          context.state = ConversationState.PACKAGE_DETAILS;
          result = await this.handlePricingRequestEnhanced(intent, context);
          break;
        
        case 'ask_general':
          result = await this.handleGeneralQueryEnhanced(messages, context);
          break;
        
        default:
          result = await this.handleGeneralQueryEnhanced(messages, context);
      }

      // Update context metrics
      const processingTime = Date.now() - startTime;
      context.metadata.lastActivity = new Date();
      context.metadata.averageResponseTime = 
        ((context.metadata.averageResponseTime * (context.metadata.totalMessages - 1)) + processingTime) / 
        context.metadata.totalMessages;

      console.log(`✅ AI processing completed in ${processingTime}ms`);
      return result;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error('💥 Enhanced AI processing error:', error);
      
      // Create enhanced error
      const enhancedError = errorHandler.createEnhancedError(
        error instanceof Error ? error : new Error(String(error)),
        ErrorCategory.SYSTEM,
        ErrorSeverity.HIGH,
        {
          sessionId,
          userId,
          conversationId,
          processingTime,
          messageCount: messages.length,
        }
      );

      // Try to handle the error
      const recovery = await errorHandler.handleError(enhancedError);
      
      if (recovery?.fallback || recovery?.safeResponse) {
        return recovery.message;
      }

      // Fallback to safe response
      return this.getSafeErrorResponse();
    }
  }

  // Enhanced intent analysis with validation
  private async analyzeUserIntentEnhanced(
    messages: Message[], 
    context: ConversationContext
  ): Promise<TripIntent> {
    const startTime = Date.now();
    
    try {
      logger.info(LogCategory.AI, 'Starting enhanced intent analysis', {
        messageCount: messages.length,
        conversationId: context.id,
      });

      const conversationHistory = messages.map(m => `${m.role}: ${m.content}`).join('\n');
      
      // Use enhanced prompt templates
      const { systemPrompt, userPrompt } = generateIntentAnalysisPrompt(
        conversationHistory,
        context.userPreferences,
        context.currentIntent
      );

      const response = await retryAIOperation(
        async () => {
          return await openai.chat.completions.create({
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ],
            model: aiConfig.model,
            temperature: 0.1,
            max_tokens: 600,
            timeout: aiConfig.timeout,
          });
        },
        'intent_analysis',
        { maxAttempts: 2 }
      );

      const content = response.choices?.[0]?.message?.content?.trim();
      if (!content) {
        throw new Error('Empty response from intent analysis');
      }

      // Parse and validate the response
      const parsed = JSON.parse(content);
      const validatedIntent = validateTripIntent(parsed);
      
      const duration = Date.now() - startTime;
      logger.logAIInteraction(
        'intent_analysis',
        duration,
        true,
        context.userId,
        context.sessionId,
        context.id,
        { confidence: validatedIntent.confidence }
      );

      return validatedIntent;

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(LogCategory.AI, 'Intent analysis failed', error as Error, {
        conversationId: context.id,
        messageCount: messages.length,
        duration,
      });
      
      logger.logAIInteraction(
        'intent_analysis',
        duration,
        false,
        context.userId,
        context.sessionId,
        context.id,
        { error: (error as Error).message }
      );
      
      // Create enhanced error for intent analysis failure
      const enhancedError = createValidationError(
        `Intent analysis failed: ${error instanceof Error ? error.message : String(error)}`,
        { 
          conversationId: context.id,
          sessionId: context.sessionId,
          messageCount: messages.length 
        }
      );

      // Try to recover
      const recovery = await errorHandler.handleError(enhancedError);
      
      // Return default intent if recovery fails
      return {
        intent: 'unknown',
        destination: null,
        duration: null,
        planType: null,
        budget: { min: null, max: null, currency: 'INR' },
        travelers: { adults: 1, children: 0, rooms: 1 },
        preferences: [],
        urgency: 'medium',
        confidence: 0.3,
      };
    }
  }

  // Enhanced package request handling
  private async handlePackageRequestEnhanced(
    intent: TripIntent, 
    context: ConversationContext
  ): Promise<string> {
    const startTime = Date.now();
    
    try {
      const { destination, duration, planType } = intent;
      
      logger.info(LogCategory.AI, 'Processing package request', {
        destination,
        duration,
        planType,
        conversationId: context.id,
      });
      
      // Check what information we have and what we need
      const missingInfo = [];
      if (!destination) missingInfo.push('destination');
      if (!duration) missingInfo.push('duration');
      
      // If we have all required info, fetch packages
      if (missingInfo.length === 0) {
        logger.info(LogCategory.TOOL, `Fetching packages for: ${destination}, ${duration} days, ${planType || 'any'}`);
        
        // Use enhanced tool execution
        const toolResult = await executeEnhancedTool(
          'get_packages',
          { 
            search: destination,
            days: duration 
          },
          {
            sessionId: context.sessionId,
            userId: context.userId,
            priority: intent.urgency === 'high' ? 'high' : 'medium'
          }
        );
        
        if (!toolResult.success || !toolResult.data || toolResult.data.length === 0) {
          return await this.generateNoPackagesResponseEnhanced(destination, duration, planType, context);
        }
        
        return await this.formatPackagesResponseEnhanced(toolResult.data, destination, duration, planType, context);
      }
      
      // Generate natural follow-up questions for missing information
      return await this.generateFollowUpQuestionEnhanced(intent, missingInfo, context);

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(LogCategory.AI, 'Package request failed', error as Error, {
        conversationId: context.id,
        sessionId: context.sessionId,
        intent: intent,
        duration,
      });

      const enhancedError = createAPIError(
        `Package request failed: ${error instanceof Error ? error.message : String(error)}`,
        {
          conversationId: context.id,
          sessionId: context.sessionId,
          intent: intent,
        }
      );

      const recovery = await errorHandler.handleError(enhancedError);
      
      if (recovery?.fallback) {
        return recovery.message;
      }

      return "🔄 **Service Temporarily Unavailable**\n\nI'm having trouble accessing our travel database right now. Please try again in a moment!\n\n✨ *Great travel experiences are worth the wait* 🌟";
    }
  }

  // Enhanced general query handling
  private async handleGeneralQueryEnhanced(
    messages: Message[], 
    context: ConversationContext
  ): Promise<string> {
    const startTime = Date.now();
    
    try {
      logger.info(LogCategory.AI, 'Processing general travel query', {
        conversationId: context.id,
        messageCount: messages.length,
      });
      
      const conversationHistory = messages.map(m => `${m.role}: ${m.content}`).join('\n');
      const lastUserMessage = messages.filter(m => m.role === 'user').pop();
      
      // Use enhanced prompt templates
      const { systemPrompt, userPrompt } = generateGeneralQueryPrompt(
        lastUserMessage?.content || '',
        conversationHistory,
        context.userPreferences
      );

      const response = await retryAIOperation(
        async () => {
          return await openai.chat.completions.create({
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ],
            model: aiConfig.model,
            temperature: 0.6,
            max_tokens: 600,
            timeout: aiConfig.timeout,
          });
        },
        'general_query',
        { maxAttempts: 2 }
      );

      const messageContent = response.choices?.[0]?.message?.content ?? "";
      
      const duration = Date.now() - startTime;
      logger.logAIInteraction(
        'general_query',
        duration,
        true,
        context.userId,
        context.sessionId,
        context.id,
        { messageLength: messageContent.length }
      );

      if (!messageContent) {
        return this.getWelcomeMessage();
      }

      return messageContent;

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(LogCategory.AI, 'General query processing failed', error as Error, {
        conversationId: context.id,
        sessionId: context.sessionId,
        duration,
      });
      
      logger.logAIInteraction(
        'general_query',
        duration,
        false,
        context.userId,
        context.sessionId,
        context.id,
        { error: (error as Error).message }
      );

      const enhancedError = createAPIError(
        `General query processing failed: ${error instanceof Error ? error.message : String(error)}`,
        {
          conversationId: context.id,
          sessionId: context.sessionId,
        }
      );

      const recovery = await errorHandler.handleError(enhancedError);
      
      if (recovery?.fallback) {
        return recovery.message;
      }

      return this.getWelcomeMessage();
    }
  }

  // Additional helper methods...
  private async handlePackageDetailsEnhanced(intent: TripIntent, context: ConversationContext): Promise<string> {
    // Implementation for package details with enhanced error handling
    return "Package details feature will be implemented in Phase 2.";
  }

  private async handlePricingRequestEnhanced(intent: TripIntent, context: ConversationContext): Promise<string> {
    // Implementation for pricing requests with enhanced error handling
    return "Pricing request feature will be implemented in Phase 2.";
  }

  private async generateFollowUpQuestionEnhanced(
    intent: TripIntent, 
    missingInfo: string[], 
    context: ConversationContext
  ): Promise<string> {
    // Enhanced follow-up question generation with context awareness
    return "Enhanced follow-up questions will be implemented shortly.";
  }

  private async generateNoPackagesResponseEnhanced(
    destination: string | null, 
    duration: number | null, 
    planType: string | null,
    context: ConversationContext
  ): Promise<string> {
    const planText = planType ? ` for ${planType} trips` : '';
    const durationText = duration ? `${duration}-day ` : '';
    const destinationText = destination || 'your chosen destination';
    return `😕 **No packages found**\n\nSorry, I couldn't find any ${durationText}packages${planText} for ${destinationText} right now.\n\n🔄 **Try:**\n• Different duration (3-7 days are popular)\n• Different destination\n• Remove specific trip type filter\n\n💡 *Our inventory updates regularly, so check back soon!*`;
  }

  private async formatPackagesResponseEnhanced(
    packages: any, 
    destination: string | null, 
    duration: number | null, 
    planType: string | null,
    context: ConversationContext
  ): Promise<string> {
    // Enhanced package formatting with better presentation
    return "Enhanced package formatting will be implemented shortly.";
  }

  // Context management
  private getOrCreateContext(conversationId: string, sessionId: string, userId?: string): ConversationContext {
    const existing = this.conversations.get(conversationId);
    if (existing) {
      return existing;
    }

    const newContext: ConversationContext = {
      id: conversationId,
      userId,
      sessionId,
      state: ConversationState.INITIATED,
      messages: [],
      taskQueue: [],
      metadata: {
        startTime: new Date(),
        lastActivity: new Date(),
        totalMessages: 0,
        averageResponseTime: 0,
      },
    };

    this.conversations.set(conversationId, newContext);
    return newContext;
  }

  // Safe responses
  private getWelcomeMessage(): string {
    return "✨ **TripXplo AI** - Your Travel Companion\n\nHello! I'm here to help you discover amazing travel experiences.\n\n💫 Ask me about destinations, packages, or travel tips!\n\n*What adventure are you dreaming of?* 🌍";
  }

  private getSafeErrorResponse(): string {
    return "✨ **TripXplo AI** - Temporary Service Interruption\n\nI'm experiencing some technical difficulties right now. Our team has been notified and we're working to resolve this quickly.\n\n🔄 **Please try:**\n• Refreshing the page\n• Rephrasing your question\n• Trying again in a few minutes\n\n💫 *Amazing travel experiences are worth the wait!* 🌟";
  }
}

// Global enhanced AI processor instance
export const enhancedAIProcessor = new EnhancedAIProcessor();

// Backward compatibility function
export async function processWithai(messages: any[]): Promise<string> {
  // Convert messages to proper format
  const formattedMessages: Message[] = messages.map(m => ({
    role: m.role,
    content: m.content,
    timestamp: new Date(),
    messageId: generateId(),
    conversationId: generateId(),
  }));

  return enhancedAIProcessor.processWithEnhancedAI(formattedMessages);
}