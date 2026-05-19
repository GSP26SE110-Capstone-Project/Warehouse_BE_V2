import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import * as zoneController from '../controllers/warehouseZone.controller.js';

const router = Router({ mergeParams: true });

/**
 * @swagger
 * components:
 *   schemas:
 *     WarehouseZone:
 *       type: object
 *       properties:
 *         zoneId:
 *           type: string
 *           format: uuid
 *         warehouseId:
 *           type: string
 *           format: uuid
 *         zoneCode:
 *           type: string
 *         zoneName:
 *           type: string
 *         zoneType:
 *           type: string
 *           enum: [SHARED, FAST_MOVING, BULK, PREMIUM, QC, RETURN]
 *         areaM2:
 *           type: number
 *         isDedicated:
 *           type: boolean
 *         status:
 *           type: string
 *           enum: [ACTIVE, BLOCKED]
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     WarehouseZoneInput:
 *       type: object
 *       required:
 *         - zoneCode
 *       properties:
 *         zoneCode:
 *           type: string
 *         zoneName:
 *           type: string
 *         zoneType:
 *           type: string
 *           enum: [SHARED, FAST_MOVING, BULK, PREMIUM, QC, RETURN]
 *         areaM2:
 *           type: number
 *         isDedicated:
 *           type: boolean
 *         status:
 *           type: string
 *           enum: [ACTIVE, BLOCKED]
 */

/**
 * @swagger
 * /api/warehouses/{warehouseId}/zones:
 *   post:
 *     summary: Create a zone in a warehouse
 *     tags: [Zone]
 *     parameters:
 *       - in: path
 *         name: warehouseId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/WarehouseZoneInput'
 *     responses:
 *       201:
 *         description: Zone created
 *       404:
 *         description: Warehouse not found
 *       409:
 *         description: Duplicate zone code in warehouse
 *   get:
 *     summary: List zones in a warehouse
 *     tags: [Zone]
 *     parameters:
 *       - in: path
 *         name: warehouseId
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
 *         name: zoneType
 *         schema:
 *           type: string
 *           enum: [SHARED, FAST_MOVING, BULK, PREMIUM, QC, RETURN]
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
 *         description: Paginated zone list
 */
router.post('/', asyncHandler(zoneController.create));
router.get('/', asyncHandler(zoneController.list));

/**
 * @swagger
 * /api/warehouses/{warehouseId}/zones/{zoneId}:
 *   get:
 *     summary: Get zone by ID
 *     tags: [Zone]
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
 *     responses:
 *       200:
 *         description: Zone details
 *       404:
 *         description: Not found
 *   patch:
 *     summary: Update zone
 *     tags: [Zone]
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
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/WarehouseZoneInput'
 *     responses:
 *       200:
 *         description: Zone updated
 *       404:
 *         description: Not found
 *   delete:
 *     summary: Delete zone
 *     tags: [Zone]
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
 *     responses:
 *       200:
 *         description: Zone deleted
 *       404:
 *         description: Not found
 *       400:
 *         description: Cannot delete (referenced by racks)
 */
router.get('/:zoneId', asyncHandler(zoneController.getById));
router.patch('/:zoneId', asyncHandler(zoneController.update));
router.delete('/:zoneId', asyncHandler(zoneController.remove));

export default router;
