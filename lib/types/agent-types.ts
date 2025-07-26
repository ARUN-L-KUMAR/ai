// Type Safety and Validation - Enhanced types for multi-agent system foundation
import { z } from 'zod';

// Base message interface with enhanced typing
export interface Message {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: Date;
  messageId: string;
  conversationId: string;
  metadata?: {
    toolCalls?: ToolCall[];
    intent?: TripIntent;
    agentId?: string;
    processingTime?: number;
    tokens?: number;
  };
}

// Enhanced trip intent with validation
export const TripIntentSchema = z.object({
  intent: z.enum(['get_packages', 'ask_general', 'get_pricing', 'get_details', 'customize_package', 'unknown']),
  destination: z.string().nullable(),
  duration: z.number().min(1).max(30).nullable(),
  planType: z.string().nullable(),
  budget: z.object({
    min: z.number().optional(),
    max: z.number().optional(),
    currency: z.string().default('INR'),
  }).optional(),
  travelers: z.object({
    adults: z.number().min(1).default(1),
    children: z.number().min(0).default(0),
    rooms: z.number().min(1).default(1),
  }).optional(),
  preferences: z.array(z.string()).optional(),
  urgency: z.enum(['low', 'medium', 'high']).default('medium'),
  confidence: z.number().min(0).max(1).default(0.8),
});

export type TripIntent = z.infer<typeof TripIntentSchema>;

// Tool call interface with enhanced structure
export interface ToolCall {
  id: string;
  name: string;
  parameters: Record<string, any>;
  result?: any;
  error?: string;
  executionTime?: number;
  attempts?: number;
  status: 'pending' | 'running' | 'success' | 'failed' | 'timeout';
}

// Agent interface for multi-agent foundation
export interface Agent {
  id: string;
  name: string;
  role: AgentRole;
  description: string;
  capabilities: string[];
  tools: string[];
  priority: number;
  status: 'active' | 'busy' | 'idle' | 'error';
  metadata: {
    version: string;
    lastUpdate: Date;
    successRate?: number;
    avgResponseTime?: number;
  };
}

// Agent roles enum for type safety
export enum AgentRole {
  SUPERVISOR = 'supervisor',
  CUSTOMER_SUPPORT = 'customer_support',
  PACKAGE_RECOMMENDATION = 'package_recommendation', 
  PACKAGE_CUSTOMIZATION = 'package_customization',
  BOOKING = 'booking',
  GENERAL = 'general',
}

// Agent communication message structure
export interface AgentMessage {
  from: string;
  to: string;
  messageType: 'task' | 'response' | 'error' | 'status';
  content: any;
  timestamp: Date;
  correlationId: string;
  priority: 'low' | 'medium' | 'high';
}

// Task definition for agent routing
export interface AgentTask {
  id: string;
  type: string;
  priority: 'low' | 'medium' | 'high';
  assignedAgent?: string;
  status: 'pending' | 'assigned' | 'processing' | 'completed' | 'failed';
  payload: any;
  context: TaskContext;
  createdAt: Date;
  completedAt?: Date;
  result?: any;
  error?: string;
}

export interface TaskContext {
  conversationId: string;
  userId?: string;
  sessionId: string;
  intent: TripIntent;
  previousTasks: string[];
  userPreferences?: UserPreferences;
}

// User preferences for personalization
export const UserPreferencesSchema = z.object({
  destinations: z.array(z.string()).optional(),
  budgetRange: z.object({
    min: z.number(),
    max: z.number(),
    currency: z.string().default('INR'),
  }).optional(),
  travelStyle: z.enum(['budget', 'mid-range', 'luxury']).optional(),
  interests: z.array(z.string()).optional(),
  groupSize: z.object({
    adults: z.number().min(1),
    children: z.number().min(0),
  }).optional(),
  accessibility: z.array(z.string()).optional(),
  language: z.string().default('en'),
});

export type UserPreferences = z.infer<typeof UserPreferencesSchema>;

// Conversation context with enhanced state management
export interface ConversationContext {
  id: string;
  userId?: string;
  sessionId: string;
  state: ConversationState;
  messages: Message[];
  currentIntent?: TripIntent;
  activeAgent?: string;
  taskQueue: AgentTask[];
  userPreferences?: UserPreferences;
  metadata: {
    startTime: Date;
    lastActivity: Date;
    totalMessages: number;
    averageResponseTime: number;
  };
}

export enum ConversationState {
  INITIATED = 'initiated',
  INTENT_ANALYSIS = 'intent_analysis',
  INFORMATION_GATHERING = 'information_gathering',
  PACKAGE_SEARCH = 'package_search',
  PACKAGE_DETAILS = 'package_details',
  CUSTOMIZATION = 'customization',
  BOOKING = 'booking',
  COMPLETED = 'completed',
  ERROR = 'error',
}

// API response interfaces with strict typing
export const PackageSchema = z.object({
  packageId: z.string(),
  packageName: z.string(),
  destinationName: z.string(),
  startFrom: z.number(),
  noOfDays: z.number(),
  noOfNight: z.number(),
  hotelCount: z.number().optional(),
  activityCount: z.number().optional(),
  planName: z.string().optional(),
  description: z.string().optional(),
  perfectFor: z.string().optional(),
  images: z.array(z.string()).optional(),
  rating: z.number().min(0).max(5).optional(),
  reviews: z.number().optional(),
});

export type Package = z.infer<typeof PackageSchema>;

export const DestinationSchema = z.object({
  id: z.string(),
  destinationName: z.string(),
  state: z.string().optional(),
  country: z.string().optional(),
  description: z.string().optional(),
  popularityScore: z.number().optional(),
  averageRating: z.number().optional(),
});

export type Destination = z.infer<typeof DestinationSchema>;

// Error types for better error handling
export class ValidationError extends Error {
  constructor(public field: string, public value: any, public schema: string) {
    super(`Validation failed for field '${field}' with value '${value}' against schema '${schema}'`);
    this.name = 'ValidationError';
  }
}

export class AgentError extends Error {
  constructor(
    public agentId: string,
    public operation: string,
    public originalError: Error
  ) {
    super(`Agent '${agentId}' failed during '${operation}': ${originalError.message}`);
    this.name = 'AgentError';
  }
}

export class IntentAnalysisError extends Error {
  constructor(public input: string, public reason: string) {
    super(`Intent analysis failed for input '${input}': ${reason}`);
    this.name = 'IntentAnalysisError';
  }
}

// Utility functions for type validation
export function validateMessage(message: any): Message {
  try {
    return {
      role: message.role,
      content: message.content,
      timestamp: new Date(message.timestamp),
      messageId: message.messageId || generateId(),
      conversationId: message.conversationId,
      metadata: message.metadata,
    };
  } catch (error) {
    throw new ValidationError('message', message, 'Message');
  }
}

export function validateTripIntent(intent: any): TripIntent {
  try {
    return TripIntentSchema.parse(intent);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError('tripIntent', intent, 'TripIntent');
    }
    throw error;
  }
}

export function validatePackage(pkg: any): Package {
  try {
    return PackageSchema.parse(pkg);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError('package', pkg, 'Package');
    }
    throw error;
  }
}

// Helper function for ID generation
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Type guards for runtime type checking
export function isMessage(obj: any): obj is Message {
  return obj && typeof obj.role === 'string' && typeof obj.content === 'string';
}

export function isTripIntent(obj: any): obj is TripIntent {
  try {
    TripIntentSchema.parse(obj);
    return true;
  } catch {
    return false;
  }
}

export function isPackage(obj: any): obj is Package {
  try {
    PackageSchema.parse(obj);
    return true;
  } catch {
    return false;
  }
}

// Configuration interfaces
export interface SystemConfig {
  ai: {
    model: string;
    temperature: number;
    maxTokens: number;
    timeout: number;
  };
  agents: {
    maxConcurrentTasks: number;
    taskTimeout: number;
    retryAttempts: number;
  };
  api: {
    baseUrl: string;
    timeout: number;
    retryAttempts: number;
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    enableMetrics: boolean;
  };
}

export const defaultSystemConfig: SystemConfig = {
  ai: {
    model: 'gpt-4o',
    temperature: 0.6,
    maxTokens: 1000,
    timeout: 30000,
  },
  agents: {
    maxConcurrentTasks: 5,
    taskTimeout: 60000,
    retryAttempts: 3,
  },
  api: {
    baseUrl: process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
    timeout: 30000,
    retryAttempts: 3,
  },
  logging: {
    level: 'info',
    enableMetrics: true,
  },
};