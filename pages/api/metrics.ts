// Metrics API Endpoint for Monitoring
import { NextApiRequest, NextApiResponse } from 'next';
import { toolMiddleware } from '../../lib/middleware/tool-middleware';
import { errorHandler } from '../../lib/error-handling/enhanced-error-handler';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const toolMetrics = toolMiddleware.getMetrics();
    const errorStats = errorHandler.getErrorStats();
    const recentErrors = errorHandler.getRecentErrors(10);
    
    const metrics = {
      timestamp: new Date().toISOString(),
      version: '2.0.0-phase1',
      tools: {
        summary: toolMetrics,
        totalCalls: Object.values(toolMetrics).reduce((sum, metric) => sum + metric.calls, 0),
        totalFailures: Object.values(toolMetrics).reduce((sum, metric) => sum + metric.failures, 0),
        averageResponseTime: Object.values(toolMetrics).reduce((sum, metric) => sum + metric.avgTime, 0) / Object.keys(toolMetrics).length || 0,
      },
      errors: {
        summary: errorStats,
        totalErrors: Object.values(errorStats).reduce((sum, count) => sum + count, 0),
        recentErrors: recentErrors.map(error => ({
          id: error.id,
          category: error.category,
          severity: error.severity,
          message: error.message.substring(0, 100),
          timestamp: error.context?.timestamp,
          handled: error.handled,
        })),
      },
      system: {
        uptime: Math.floor(process.uptime()),
        memory: process.memoryUsage(),
        nodeVersion: process.version,
        platform: process.platform,
      },
    };

    res.status(200).json(metrics);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve metrics',
      message: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    });
  }
}