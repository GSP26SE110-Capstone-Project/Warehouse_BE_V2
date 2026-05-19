import { Router } from 'express';
import pool from '../config/db.js';
import asyncHandler from '../middleware/asyncHandler.js';
import AppError from '../utils/AppError.js';
import { success } from '../utils/apiResponse.js';

const router = Router();

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: API and database health check
 *     tags: [System]
 *     responses:
 *       200:
 *         description: Service is healthy
 *       503:
 *         description: Database unavailable
 */
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
