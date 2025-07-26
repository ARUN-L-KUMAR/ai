import { NextApiRequest, NextApiResponse } from 'next';
import { processWithai } from '../../lib/ai/ai';
import { logger } from '../../lib/utils/logger';
import { handleError, createUserFriendlyMessage } from '../../lib/utils/errors';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const requestId = `api-${Date.now()}`;
  
  logger.info('AI Agent API request received', {
    component: 'AIAgentAPI',
    requestId,
    method: req.method,
    userAgent: req.headers['user-agent']?.substring(0, 100),
    ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress
  });

  if (req.method !== 'POST') {
    logger.warn('Invalid method used', {
      component: 'AIAgentAPI',
      requestId,
      method: req.method
    });
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      logger.warn('Invalid request body', {
        component: 'AIAgentAPI',
        requestId,
        hasMessages: !!messages,
        isArray: Array.isArray(messages)
      });
      return res.status(400).json({ error: 'Messages array is required' });
    }

    logger.info('Processing AI request', {
      component: 'AIAgentAPI',
      requestId,
      messageCount: messages.length,
      lastMessagePreview: messages[messages.length - 1]?.content?.substring(0, 100)
    });

    logger.time(`AIProcessing-${requestId}`);
    const response = await processWithai(messages);
    logger.timeEnd(`AIProcessing-${requestId}`);
    
    logger.info('AI processing completed successfully', {
      component: 'AIAgentAPI',
      requestId,
      responseLength: response.length
    });
    
    res.status(200).json({ response });
  } catch (error) {
    const appError = handleError(error, {
      component: 'AIAgentAPI',
      requestId,
      operation: 'handleAIRequest'
    });

    logger.error('AI Agent API error', appError, {
      component: 'AIAgentAPI',
      requestId
    });

    // Return user-friendly error message
    const userMessage = createUserFriendlyMessage(appError);
    res.status(appError.statusCode || 500).json({ 
      response: userMessage,
      error: process.env.NODE_ENV === 'development' ? appError.message : 'Internal server error'
    });
  }
}