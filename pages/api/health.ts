// Health Check API Endpoint
import { NextApiRequest, NextApiResponse } from 'next';
import { toolMiddleware } from '../../lib/middleware/tool-middleware';
import { errorHandler } from '../../lib/error-handling/enhanced-error-handler';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Check database connection (TripXplo API)
    let dbStatus = 'unknown';
    try {
      const { getAccessToken } = await import('../../lib/api/tripxplo');
      await getAccessToken();
      dbStatus = 'connected';
    } catch (error) {
      dbStatus = 'disconnected';
    }

    // Get system metrics
    const toolMetrics = toolMiddleware.getMetrics();
    const errorStats = errorHandler.getErrorStats();
    
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '2.0.0-phase1',
      uptime: Math.floor(process.uptime()),
      database: {
        tripxplo: dbStatus,
      },
      tools: toolMetrics,
      errors: errorStats,
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
          external: Math.round(process.memoryUsage().external / 1024 / 1024),
        },
        cpu: process.cpuUsage(),
      },
    };

    // Determine overall health status
    let overallStatus = 'healthy';
    if (dbStatus === 'disconnected') {
      overallStatus = 'degraded';
    }

    const totalErrors = Object.values(errorStats).reduce((sum, count) => sum + count, 0);
    if (totalErrors > 100) { // More than 100 errors indicates issues
      overallStatus = 'degraded';
    }

    health.status = overallStatus;
    const statusCode = overallStatus === 'healthy' ? 200 : 503;
    
    res.status(statusCode).json(health);
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
      version: '2.0.0-phase1',
    });
  }
}