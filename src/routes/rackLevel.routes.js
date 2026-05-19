import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import * as rackLevelController from '../controllers/rackLevel.controller.js';

const router = Router({ mergeParams: true });

/**
 * @swagger
 * components:
 *   schemas:
 *     RackLevel:
 *       type: object
 *       properties:
 *         rackLevelId:
 *           type: string
 *           format: uuid
 *         rackId:
 *           type: string
 *           format: uuid
 *         levelCode:
 *           type: string
 *         levelNumber:
 *           type: integer
 *         maxBins:
 *           type: integer
 *         maxWeightKg:
 *           type: number
 *         heightCm:
 *           type: number
 *         levelPriority:
 *           type: integer
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     RackLevelInput:
 *       type: object
 *       required:
 *         - levelNumber
 *       properties:
 *         levelCode:
 *           type: string
 *         levelNumber:
 *           type: integer
 *         maxBins:
 *           type: integer
 *         maxWeightKg:
 *           type: number
 *         heightCm:
 *           type: number
 *         levelPriority:
 *           type: integer
 */

/**
 * @swagger
 * /api/warehouses/{warehouseId}/zones/{zoneId}/racks/{rackId}/levels:
 *   post:
 *     summary: Create a rack level
 *     tags: [RackLevel]
 *     parameters:
 *       - in: path
 *         name: warehouseId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: zoneId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: rackId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RackLevelInput'
 *     responses:
 *       201:
 *         description: Rack level created
 *       404:
 *         description: Rack not found
 *       409:
 *         description: Duplicate level number in rack
 *   get:
 *     summary: List rack levels
 *     tags: [RackLevel]
 *     parameters:
 *       - in: path
 *         name: warehouseId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: zoneId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: rackId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Paginated rack level list
 */
router.post('/', asyncHandler(rackLevelController.create));
router.get('/', asyncHandler(rackLevelController.list));

/**
 * @swagger
 * /api/warehouses/{warehouseId}/zones/{zoneId}/racks/{rackId}/levels/{rackLevelId}:
 *   get:
 *     summary: Get rack level by ID
 *     tags: [RackLevel]
 *     parameters:
 *       - in: path
 *         name: warehouseId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: zoneId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: rackId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: rackLevelId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Rack level details
 *       404:
 *         description: Not found
 *   patch:
 *     summary: Update rack level
 *     tags: [RackLevel]
 *     parameters:
 *       - in: path
 *         name: warehouseId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: zoneId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: rackId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: rackLevelId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               levelCode:
 *                 type: string
 *               maxBins:
 *                 type: integer
 *               maxWeightKg:
 *                 type: number
 *               heightCm:
 *                 type: number
 *               levelPriority:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Rack level updated
 *       404:
 *         description: Not found
 *   delete:
 *     summary: Delete rack level
 *     tags: [RackLevel]
 *     parameters:
 *       - in: path
 *         name: warehouseId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: zoneId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: rackId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: rackLevelId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Rack level deleted
 *       404:
 *         description: Not found
 *       400:
 *         description: Cannot delete (referenced by bins)
 */
router.get('/:rackLevelId', asyncHandler(rackLevelController.getById));
router.patch('/:rackLevelId', asyncHandler(rackLevelController.update));
router.delete('/:rackLevelId', asyncHandler(rackLevelController.remove));

export default router;
