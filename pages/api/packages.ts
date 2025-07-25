import type { NextApiRequest, NextApiResponse } from 'next';
import { getPackages, getPackageById } from '../../lib/api/tripxplo';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { destination, duration, plan, id } = req.query;

  if (id && typeof id === 'string') {
    try {
      const allPackages = await getPackages();
      const found = allPackages.filter(pkg =>
        pkg.packageId === id || pkg._id === id
      );
      if (found.length > 0) {
        return res.status(200).json(found);
      }
      return res.status(404).json({ error: 'Package not found' });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

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
