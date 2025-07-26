import type { NextApiRequest, NextApiResponse } from 'next';
import { getPackages, getPackageById } from '../../lib/api/tripxplo';
import { logger } from '../../lib/utils/logger';
import { handleError, createUserFriendlyMessage } from '../../lib/utils/errors';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const requestId = `packages-api-${Date.now()}`;
  
  logger.info('Packages API request received', {
    component: 'PackagesAPI',
    requestId,
    method: req.method,
    query: req.query
  });

  if (req.method !== 'GET') {
    logger.warn('Invalid method used', {
      component: 'PackagesAPI',
      requestId,
      method: req.method
    });
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { destination, duration, plan, id } = req.query;

  if (id && typeof id === 'string') {
    logger.info('Fetching package by ID', {
      component: 'PackagesAPI',
      requestId,
      packageId: id
    });

    try {
      const allPackages = await getPackages();
      const found = allPackages.filter(pkg =>
        pkg.packageId === id || pkg._id === id
      );
      
      logger.info('Package by ID search completed', {
        component: 'PackagesAPI',
        requestId,
        packageId: id,
        found: found.length > 0
      });
      
      if (found.length > 0) {
        return res.status(200).json(found);
      }
      return res.status(404).json({ error: 'Package not found' });
    } catch (error) {
      const appError = handleError(error, {
        component: 'PackagesAPI',
        requestId,
        operation: 'getPackageById',
        packageId: id
      });

      logger.error('Package by ID fetch failed', appError, {
        component: 'PackagesAPI',
        requestId,
        packageId: id
      });

      return res.status(appError.statusCode || 500).json({ 
        error: appError.message 
      });
    }
  }

  if (!destination || typeof destination !== 'string') {
    logger.warn('Missing or invalid destination parameter', {
      component: 'PackagesAPI',
      requestId,
      destination,
      destinationType: typeof destination
    });
    return res.status(400).json({ error: 'Missing or invalid destination parameter' });
  }

  logger.info('Fetching packages with filters', {
    component: 'PackagesAPI',
    requestId,
    destination,
    duration,
    plan
  });

  try {
    logger.time(`PackageFilter-${requestId}`);
    let allPackages = await getPackages(destination);
    
    const originalCount = allPackages.length;
    logger.debug('Initial packages fetched', {
      component: 'PackagesAPI',
      requestId,
      count: originalCount,
      destination
    });
    
    if (duration) {
      const durationNum = Number(duration);
      allPackages = allPackages.filter(pkg => pkg.noOfDays === durationNum);
      logger.debug('Filtered by duration', {
        component: 'PackagesAPI',
        requestId,
        duration: durationNum,
        beforeCount: originalCount,
        afterCount: allPackages.length
      });
    }
    
    if (plan) {
      allPackages = allPackages.filter(pkg => pkg.planName === plan);
      logger.debug('Filtered by plan', {
        component: 'PackagesAPI',
        requestId,
        plan,
        finalCount: allPackages.length
      });
    }
    
    logger.timeEnd(`PackageFilter-${requestId}`);
    logger.info('Package filtering completed', {
      component: 'PackagesAPI',
      requestId,
      originalCount,
      finalCount: allPackages.length,
      destination,
      duration,
      plan
    });
    
    res.status(200).json(allPackages);
  } catch (error) {
    const appError = handleError(error, {
      component: 'PackagesAPI',
      requestId,
      operation: 'getFilteredPackages',
      destination,
      duration,
      plan
    });

    logger.error('Package filtering failed', appError, {
      component: 'PackagesAPI',
      requestId,
      destination,
      duration,
      plan
    });

    res.status(appError.statusCode || 500).json({ 
      error: appError.message 
    });
  }
}
