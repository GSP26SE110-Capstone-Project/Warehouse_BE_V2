import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import * as binController from '../controllers/bin.controller.js';

const router = Router({ mergeParams: true });

/**
 * @swagger
 * components:
 *   schemas:
 *     Bin:
 *       type: object
 *       properties:
 *         binId:
 *           type: string
 *           format: uuid
 *         rackLevelId:
 *           type: string
 *           format: uuid
 *         binCode:
 *           type: string
 *         supportedBoxType:
 *           type: string
 *           enum: [SMALL, MEDIUM, LARGE, EXTRA]
 *         maxLpnCount:
 *           type: integer
 *         currentLpnCount:
 *           type: integer
 *         maxVolumeUnits:
 *           type: integer
 *         usedVolumeUnits:
 *           type: integer
 *         maxOwnerCount:
 *           type: integer
 *         reservationType:
 *           type: string
 *           enum: [SHARED, RESERVED, DEDICATED]
 *         status:
 *           type: string
 *           enum: [EMPTY, PARTIAL, FULL, RESERVED, BLOCKED]
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     BinInput:
 *       type: object
 *       required:
 *         - binCode
 *         - maxLpnCount
 *         - maxVolumeUnits
 *       properties:
 *         binCode:
 *           type: string
 *         supportedBoxType:
 *           type: string
 *           enum: [SMALL, MEDIUM, LARGE, EXTRA]
 *         maxLpnCount:
 *           type: integer
 *         maxVolumeUnits:
 *           type: integer
 *         maxOwnerCount:
 *           type: integer
 *         reservationType:
 *           type: string
 *           enum: [SHARED, RESERVED, DEDICATED]
 *         status:
 *           type: string
 *           enum: [EMPTY, PARTIAL, FULL, RESERVED, BLOCKED]
 */

/**
 * @swagger
 * /api/warehouses/{warehouseId}/zones/{zoneId}/racks/{rackId}/levels/{rackLevelId}/bins:
 *   post:
 *     summary: Create a bin on a rack level
 *     tags: [Bin]
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
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BinInput'
 *     responses:
 *       201:
 *         description: Bin created
 *       404:
 *         description: Rack level not found
 *       409:
 *         description: Duplicate bin code on level
 *   get:
 *     summary: List bins on a rack level
 *     tags: [Bin]
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
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [EMPTY, PARTIAL, FULL, RESERVED, BLOCKED]
 *       - in: query
 *         name: reservationType
 *         schema:
 *           type: string
 *           enum: [SHARED, RESERVED, DEDICATED]
 *       - in: query
 *         name: supportedBoxType
 *         schema:
 *           type: string
 *           enum: [SMALL, MEDIUM, LARGE, EXTRA]
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
 *         description: Paginated bin list
 */
router.post('/', asyncHandler(binController.create));
router.get('/', asyncHandler(binController.list));

/**
 * @swagger
 * /api/warehouses/{warehouseId}/zones/{zoneId}/racks/{rackId}/levels/{rackLevelId}/bins/{binId}:
 *   get:
 *     summary: Get bin by ID
 *     tags: [Bin]
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
 *       - in: path
 *         name: binId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Bin details
 *       404:
 *         description: Not found
 *   patch:
 *     summary: Update bin
 *     tags: [Bin]
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
 *       - in: path
 *         name: binId
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
 *               supportedBoxType:
 *                 type: string
 *                 enum: [SMALL, MEDIUM, LARGE, EXTRA]
 *               maxLpnCount:
 *                 type: integer
 *               maxVolumeUnits:
 *                 type: integer
 *               maxOwnerCount:
 *                 type: integer
 *               reservationType:
 *                 type: string
 *                 enum: [SHARED, RESERVED, DEDICATED]
 *               status:
 *                 type: string
 *                 enum: [EMPTY, PARTIAL, FULL, RESERVED, BLOCKED]
 *     responses:
 *       200:
 *         description: Bin updated
 *       404:
 *         description: Not found
 *   delete:
 *     summary: Delete bin
 *     tags: [Bin]
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
 *       - in: path
 *         name: binId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Bin deleted
 *       404:
 *         description: Not found
 *       400:
 *         description: Cannot delete (referenced by LPNs or reservations)
 */
router.get('/:binId', asyncHandler(binController.getById));
router.patch('/:binId', asyncHandler(binController.update));
router.delete('/:binId', asyncHandler(binController.remove));

export default router;
