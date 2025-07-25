import type { NextApiRequest, NextApiResponse } from 'next';
import { getPackages } from '../../lib/api/tripxplo';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { destination, duration } = req.query;
  if (!destination || typeof destination !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid destination parameter' });
  }

  try {
    let allPackages = await getPackages(destination);
    if (duration) {
      const durationNum = Number(duration);
      allPackages = allPackages.filter(pkg => pkg.noOfDays === durationNum);
    }
    // Extract unique durations and plans
    const durationsSet = new Set<number>();
    const plansSet = new Set<string>();
    for (const pkg of allPackages) {
      if (pkg.noOfDays) durationsSet.add(pkg.noOfDays);
      if (pkg.planName) plansSet.add(pkg.planName); // <-- THIS IS THE CORRECT FIELD
      // (You can remove the other plan/Plan/packageType checks if you want)
    }
    const durations = Array.from(durationsSet).sort((a, b) => Number(a) - Number(b));
    const plans = Array.from(plansSet);
    res.status(200).json({ durations, plans });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch package options' });
  }
} 