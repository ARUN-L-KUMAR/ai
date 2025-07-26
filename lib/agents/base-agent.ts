// Base Agent Framework - Foundation for Multi-Agent System
import { 
  Agent, 
  AgentRole, 
  AgentMessage, 
  AgentTask, 
  TaskContext, 
  ConversationContext,
  Message,
  TripIntent,
  generateId 
} from '../types/agent-types';
import { toolMiddleware, ToolExecutionContext } from '../middleware/tool-middleware';

// Abstract base class for all agents
export abstract class BaseAgent implements Agent {
  public id: string;
  public name: string;
  public role: AgentRole;
  public description: string;
  public capabilities: string[];
  public tools: string[];
  public priority: number;
  public status: 'active' | 'busy' | 'idle' | 'error' = 'idle';
  public metadata: {
    version: string;
    lastUpdate: Date;
    successRate?: number;
    avgResponseTime?: number;
  };

  // Agent performance metrics
  private metrics = {
    tasksCompleted: 0,
    tasksFailed: 0,
    totalResponseTime: 0,
    lastTaskTime: 0,
  };

  constructor(config: {
    name: string;
    role: AgentRole;
    description: string;
    capabilities: string[];
    tools: string[];
    priority: number;
  }) {
    this.id = generateId();
    this.name = config.name;
    this.role = config.role;
    this.description = config.description;
    this.capabilities = config.capabilities;
    this.tools = config.tools;
    this.priority = config.priority;
    this.metadata = {
      version: '1.0.0',
      lastUpdate: new Date(),
    };
  }

  // Abstract methods that each agent must implement
  abstract canHandle(task: AgentTask): boolean;
  abstract processTask(task: AgentTask, context: ConversationContext): Promise<any>;
  abstract generateResponse(result: any, context: ConversationContext): Promise<string>;

  // Core agent execution method
  public async execute(task: AgentTask, context: ConversationContext): Promise<string> {
    const startTime = Date.now();
    this.status = 'busy';
    
    try {
      console.log(`🤖 Agent '${this.name}' starting task: ${task.type}`);
      
      // Check if agent can handle this task
      if (!this.canHandle(task)) {
        throw new Error(`Agent '${this.name}' cannot handle task type: ${task.type}`);
      }
      
      // Update task status
      task.status = 'processing';
      task.assignedAgent = this.id;
      
      // Process the task
      const result = await this.processTask(task, context);
      
      // Generate response
      const response = await this.generateResponse(result, context);
      
      // Update metrics
      const responseTime = Date.now() - startTime;
      this.updateMetrics(responseTime, true);
      
      // Update task completion
      task.status = 'completed';
      task.completedAt = new Date();
      task.result = result;
      
      console.log(`✅ Agent '${this.name}' completed task in ${responseTime}ms`);
      
      this.status = 'idle';
      return response;
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.updateMetrics(responseTime, false);
      
      // Update task failure
      task.status = 'failed';
      task.error = error instanceof Error ? error.message : String(error);
      
      console.error(`❌ Agent '${this.name}' failed task: ${task.error}`);
      
      this.status = 'error';
      throw error;
    }
  }

  // Execute tool with middleware
  protected async executeTool(
    toolName: string, 
    parameters: any, 
    context: ConversationContext
  ): Promise<any> {
    const toolContext: ToolExecutionContext = toolMiddleware.getContext(
      context.sessionId,
      context.id
    );
    
    // Import the executeTool function dynamically to avoid circular dependency
    const { executeTool } = await import('../ai/tools');
    
    return toolMiddleware.executeToolWithMiddleware(
      toolName,
      parameters,
      toolContext,
      executeTool
    );
  }

  // Update agent performance metrics
  private updateMetrics(responseTime: number, success: boolean): void {
    if (success) {
      this.metrics.tasksCompleted++;
    } else {
      this.metrics.tasksFailed++;
    }
    
    this.metrics.totalResponseTime += responseTime;
    this.metrics.lastTaskTime = responseTime;
    
    // Calculate success rate and average response time
    const totalTasks = this.metrics.tasksCompleted + this.metrics.tasksFailed;
    this.metadata.successRate = (this.metrics.tasksCompleted / totalTasks) * 100;
    this.metadata.avgResponseTime = this.metrics.totalResponseTime / totalTasks;
  }

  // Get agent performance metrics
  public getMetrics(): {
    tasksCompleted: number;
    tasksFailed: number;
    successRate: number;
    avgResponseTime: number;
    lastTaskTime: number;
  } {
    const totalTasks = this.metrics.tasksCompleted + this.metrics.tasksFailed;
    return {
      tasksCompleted: this.metrics.tasksCompleted,
      tasksFailed: this.metrics.tasksFailed,
      successRate: totalTasks > 0 ? (this.metrics.tasksCompleted / totalTasks) * 100 : 0,
      avgResponseTime: totalTasks > 0 ? this.metrics.totalResponseTime / totalTasks : 0,
      lastTaskTime: this.metrics.lastTaskTime,
    };
  }

  // Agent communication methods
  public async sendMessage(to: string, message: AgentMessage): Promise<void> {
    // This will be implemented in Phase 2 for inter-agent communication
    console.log(`📨 Agent '${this.name}' sending message to '${to}':`, message.messageType);
  }

  public async receiveMessage(message: AgentMessage): Promise<void> {
    // This will be implemented in Phase 2 for inter-agent communication
    console.log(`📬 Agent '${this.name}' received message:`, message.messageType);
  }

  // Utility methods for common agent operations
  protected extractKeywords(text: string): string[] {
    return text
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 3)
      .slice(0, 10); // Limit to top 10 keywords
  }

  protected calculateConfidence(factors: { [key: string]: number }): number {
    const weights = Object.values(factors);
    const sum = weights.reduce((acc, weight) => acc + weight, 0);
    return Math.min(Math.max(sum / weights.length, 0), 1);
  }

  protected async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Agent status management
  public setStatus(status: 'active' | 'busy' | 'idle' | 'error'): void {
    this.status = status;
    this.metadata.lastUpdate = new Date();
  }

  public isAvailable(): boolean {
    return this.status === 'idle' || this.status === 'active';
  }

  public getInfo(): {
    id: string;
    name: string;
    role: string;
    status: string;
    capabilities: string[];
    metrics: any;
  } {
    return {
      id: this.id,
      name: this.name,
      role: this.role,
      status: this.status,
      capabilities: this.capabilities,
      metrics: this.getMetrics(),
    };
  }
}

// Agent Registry for managing all agents
export class AgentRegistry {
  private agents: Map<string, BaseAgent> = new Map();
  private agentsByRole: Map<AgentRole, BaseAgent[]> = new Map();

  // Register a new agent
  public register(agent: BaseAgent): void {
    this.agents.set(agent.id, agent);
    
    // Group by role
    if (!this.agentsByRole.has(agent.role)) {
      this.agentsByRole.set(agent.role, []);
    }
    this.agentsByRole.get(agent.role)!.push(agent);
    
    console.log(`📋 Registered agent: ${agent.name} (${agent.role})`);
  }

  // Get agent by ID
  public getAgent(id: string): BaseAgent | undefined {
    return this.agents.get(id);
  }

  // Get agents by role
  public getAgentsByRole(role: AgentRole): BaseAgent[] {
    return this.agentsByRole.get(role) || [];
  }

  // Find best agent for a task
  public findBestAgent(task: AgentTask): BaseAgent | null {
    const candidates: BaseAgent[] = [];
    
    // Find all agents that can handle the task
    for (const agent of this.agents.values()) {
      if (agent.canHandle(task) && agent.isAvailable()) {
        candidates.push(agent);
      }
    }
    
    if (candidates.length === 0) {
      return null;
    }
    
    // Sort by priority and performance
    candidates.sort((a, b) => {
      const aMetrics = a.getMetrics();
      const bMetrics = b.getMetrics();
      
      // Primary: Priority
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      
      // Secondary: Success rate
      if (aMetrics.successRate !== bMetrics.successRate) {
        return bMetrics.successRate - aMetrics.successRate;
      }
      
      // Tertiary: Response time (lower is better)
      return aMetrics.avgResponseTime - bMetrics.avgResponseTime;
    });
    
    return candidates[0];
  }

  // Get all agents status
  public getAllAgentsStatus(): Array<{
    id: string;
    name: string;
    role: string;
    status: string;
    metrics: any;
  }> {
    return Array.from(this.agents.values()).map(agent => agent.getInfo());
  }

  // Clean up inactive agents
  public cleanup(): void {
    const now = Date.now();
    const maxInactiveTime = 3600000; // 1 hour
    
    for (const [id, agent] of this.agents.entries()) {
      const inactiveTime = now - agent.metadata.lastUpdate.getTime();
      
      if (inactiveTime > maxInactiveTime && agent.status === 'idle') {
        this.agents.delete(id);
        
        // Remove from role mapping
        const roleAgents = this.agentsByRole.get(agent.role);
        if (roleAgents) {
          const index = roleAgents.indexOf(agent);
          if (index > -1) {
            roleAgents.splice(index, 1);
          }
        }
        
        console.log(`🧹 Cleaned up inactive agent: ${agent.name}`);
      }
    }
  }
}

// Global agent registry instance
export const agentRegistry = new AgentRegistry();