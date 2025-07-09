import { NextApiRequest, NextApiResponse } from 'next';
import { processWithai } from '../../lib/ai/ai';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    const response = await processWithai(messages);
    
    res.status(200).json({ response });
  } catch (error) {
    console.error('AI Agent error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}