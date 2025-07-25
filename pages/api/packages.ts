import type { NextApiRequest, NextApiResponse } from 'next';
import { getPackages } from '../../lib/api/tripxplo';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { destination, duration, plan } = req.query;
  if (!destination || typeof destination !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid destination parameter' });
  }

  try {
    let allPackages = await getPackages(destination);
    if (duration) {
      const durationNum = Number(duration);
      allPackages = allPackages.filter(pkg => pkg.noOfDays === durationNum);
    }
    if (plan) {
      allPackages = allPackages.filter(pkg => pkg.planName === plan);
    }
    res.status(200).json(allPackages);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch packages' });
  }
} 