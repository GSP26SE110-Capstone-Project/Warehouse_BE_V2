import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import * as rackController from '../controllers/rack.controller.js';

const router = Router({ mergeParams: true });

/**
 * @swagger
 * components:
 *   schemas:
 *     Rack:
 *       type: object
 *       properties:
 *         rackId:
 *           type: string
 *           format: uuid
 *         zoneId:
 *           type: string
 *           format: uuid
 *         rackCode:
 *           type: string
 *         rackType:
 *           type: string
 *           enum: [STANDARD, HIGH_CAPACITY]
 *         maxLevels:
 *           type: integer
 *         status:
 *           type: string
 *           enum: [ACTIVE, BLOCKED]
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     RackInput:
 *       type: object
 *       required:
 *         - rackCode
 *       properties:
 *         rackCode:
 *           type: string
 *         rackType:
 *           type: string
 *           enum: [STANDARD, HIGH_CAPACITY]
 *         maxLevels:
 *           type: integer
 *         status:
 *           type: string
 *           enum: [ACTIVE, BLOCKED]
 */

/**
 * @swagger
 * /api/warehouses/{warehouseId}/zones/{zoneId}/racks:
 *   post:
 *     summary: Create a rack in a zone
 *     tags: [Rack]
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RackInput'
 *     responses:
 *       201:
 *         description: Rack created
 *       404:
 *         description: Zone not found
 *       409:
 *         description: Duplicate rack code in zone
 *   get:
 *     summary: List racks in a zone
 *     tags: [Rack]
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
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [ACTIVE, BLOCKED]
 *       - in: query
 *         name: rackType
 *         schema:
 *           type: string
 *           enum: [STANDARD, HIGH_CAPACITY]
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
 *         description: Paginated rack list
 */
router.post('/', asyncHandler(rackController.create));
router.get('/', asyncHandler(rackController.list));

/**
 * @swagger
 * /api/warehouses/{warehouseId}/zones/{zoneId}/racks/{rackId}:
 *   get:
 *     summary: Get rack by ID
 *     tags: [Rack]
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
 *     responses:
 *       200:
 *         description: Rack details
 *       404:
 *         description: Not found
 *   patch:
 *     summary: Update rack
 *     tags: [Rack]
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
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RackInput'
 *     responses:
 *       200:
 *         description: Rack updated
 *       404:
 *         description: Not found
 *   delete:
 *     summary: Delete rack
 *     tags: [Rack]
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
 *     responses:
 *       200:
 *         description: Rack deleted
 *       404:
 *         description: Not found
 *       400:
 *         description: Cannot delete (referenced by rack levels)
 */
router.get('/:rackId', asyncHandler(rackController.getById));
router.patch('/:rackId', asyncHandler(rackController.update));
router.delete('/:rackId', asyncHandler(rackController.remove));

export default router;
