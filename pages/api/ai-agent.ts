import { NextApiRequest, NextApiResponse } from 'next';
import { processWithai } from '../../lib/ai/enhanced-ai';

// Updated to use enhanced AI system while maintaining backward compatibility
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    // Use enhanced AI processor with backward compatibility
    const response = await processWithai(messages);
    
    res.status(200).json({ 
      response,
      version: '2.0.0-phase1-compat'
    });
  } catch (error) {
    console.error('AI Agent error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}