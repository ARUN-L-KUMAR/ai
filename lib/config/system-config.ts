// System Configuration - Phase 1 Foundation
import { SystemConfig, defaultSystemConfig } from '../types/agent-types';

// Environment-based configuration
export class ConfigManager {
  private config: SystemConfig;

  constructor() {
    this.config = this.loadConfiguration();
  }

  private loadConfiguration(): SystemConfig {
    return {
      ai: {
        model: process.env.AI_MODEL || defaultSystemConfig.ai.model,
        temperature: parseFloat(process.env.AI_TEMPERATURE || '0.6'),
        maxTokens: parseInt(process.env.AI_MAX_TOKENS || '1000'),
        timeout: parseInt(process.env.AI_TIMEOUT || '30000'),
      },
      agents: {
        maxConcurrentTasks: parseInt(process.env.AGENTS_MAX_CONCURRENT || '5'),
        taskTimeout: parseInt(process.env.AGENTS_TASK_TIMEOUT || '60000'),
        retryAttempts: parseInt(process.env.AGENTS_RETRY_ATTEMPTS || '3'),
      },
      api: {
        baseUrl: process.env.NEXT_PUBLIC_BASE_URL || defaultSystemConfig.api.baseUrl,
        timeout: parseInt(process.env.API_TIMEOUT || '30000'),
        retryAttempts: parseInt(process.env.API_RETRY_ATTEMPTS || '3'),
      },
      logging: {
        level: (process.env.LOG_LEVEL as any) || defaultSystemConfig.logging.level,
        enableMetrics: process.env.ENABLE_METRICS !== 'false',
      },
    };
  }

  public getConfig(): SystemConfig {
    return { ...this.config };
  }

  public updateConfig(updates: Partial<SystemConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  public getAIConfig() {
    return this.config.ai;
  }

  public getAgentConfig() {
    return this.config.agents;
  }

  public getAPIConfig() {
    return this.config.api;
  }

  public getLoggingConfig() {
    return this.config.logging;
  }

  public isDevelopment(): boolean {
    return process.env.NODE_ENV === 'development';
  }

  public isProduction(): boolean {
    return process.env.NODE_ENV === 'production';
  }
}

// Global configuration instance
export const configManager = new ConfigManager();

// Helper functions for quick access
export const getAIConfig = () => configManager.getAIConfig();
export const getAgentConfig = () => configManager.getAgentConfig();
export const getAPIConfig = () => configManager.getAPIConfig();
export const getLoggingConfig = () => configManager.getLoggingConfig();