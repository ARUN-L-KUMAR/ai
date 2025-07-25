import type { NextApiRequest, NextApiResponse } from 'next';
import { getPackages } from '../../lib/api/tripxplo';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const allPackages = await getPackages();
    // Extract unique destinations from packages
    const destinationMap = new Map();
    for (const pkg of allPackages) {
      const name = pkg.destinationName || pkg.startFrom;
      if (name && !destinationMap.has(name)) {
        destinationMap.set(name, {
          destinationName: name,
          // Optionally add more fields if needed
        });
      }
    }
    const destinations = Array.from(destinationMap.values());
    res.status(200).json({ destinations });
  } catch (error: any) {
    console.error('Error in /api/destinations:', error?.message, error?.stack);
    res.status(500).json({ error: 'Failed to fetch destinations', details: error?.message });
  }
} 