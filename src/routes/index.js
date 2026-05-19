import { Router } from 'express';
import pool from '../config/db.js';
import asyncHandler from '../middleware/asyncHandler.js';
import AppError from '../utils/AppError.js';
import { success } from '../utils/apiResponse.js';
import authRoutes from './auth.routes.js';
import userRoutes from './user.routes.js';
import warehouseRoutes from './warehouse.routes.js';
import zoneRoutes from './zone.routes.js';
import rackRoutes from './rack.routes.js';
import rackLevelRoutes from './rackLevel.routes.js';
import binRoutes from './bin.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/warehouses', warehouseRoutes);
router.use('/zones', zoneRoutes);
router.use('/racks', rackRoutes);
router.use('/rack-levels', rackLevelRoutes);
router.use('/bins', binRoutes);

router.get(
  '/health',
  asyncHandler(async (req, res) => {
    try {
      await pool.query('SELECT 1');
    } catch {
      throw new AppError('Database unavailable', 503, 'DB_UNAVAILABLE');
    }

    success(res, {
      status: 'ok',
      database: 'connected',
      timestamp: new Date().toISOString(),
    });
  })
);

export default router;
