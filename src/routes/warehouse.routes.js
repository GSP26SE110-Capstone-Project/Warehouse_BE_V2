import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import * as warehouseController from '../controllers/warehouse.controller.js';

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Warehouse:
 *       type: object
 *       properties:
 *         warehouseId:
 *           type: string
 *           format: uuid
 *         warehouseCode:
 *           type: string
 *         warehouseName:
 *           type: string
 *         address:
 *           type: string
 *         totalAreaM2:
 *           type: number
 *         usableAreaM2:
 *           type: number
 *         status:
 *           type: string
 *           enum: [ACTIVE, INACTIVE, MAINTENANCE, CLOSED]
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     WarehouseInput:
 *       type: object
 *       required:
 *         - warehouseCode
 *         - warehouseName
 *       properties:
 *         warehouseCode:
 *           type: string
 *         warehouseName:
 *           type: string
 *         address:
 *           type: string
 *         totalAreaM2:
 *           type: number
 *         usableAreaM2:
 *           type: number
 *         status:
 *           type: string
 *           enum: [ACTIVE, INACTIVE, MAINTENANCE, CLOSED]
 */

/**
 * @swagger
 * /api/warehouses:
 *   post:
 *     summary: Create a warehouse
 *     tags: [Warehouse]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/WarehouseInput'
 *     responses:
 *       201:
 *         description: Warehouse created
 *       409:
 *         description: Duplicate warehouse code
 *   get:
 *     summary: List warehouses
 *     tags: [Warehouse]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [ACTIVE, INACTIVE, MAINTENANCE, CLOSED]
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
 *         description: Paginated warehouse list
 */
router.post('/', asyncHandler(warehouseController.create));
router.get('/', asyncHandler(warehouseController.list));

/**
 * @swagger
 * /api/warehouses/{warehouseId}:
 *   get:
 *     summary: Get warehouse by ID
 *     tags: [Warehouse]
 *     parameters:
 *       - in: path
 *         name: warehouseId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Warehouse details
 *       404:
 *         description: Not found
 *   patch:
 *     summary: Update warehouse
 *     tags: [Warehouse]
 *     parameters:
 *       - in: path
 *         name: warehouseId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/WarehouseInput'
 *     responses:
 *       200:
 *         description: Warehouse updated
 *       404:
 *         description: Not found
 *   delete:
 *     summary: Delete warehouse
 *     tags: [Warehouse]
 *     parameters:
 *       - in: path
 *         name: warehouseId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Warehouse deleted
 *       404:
 *         description: Not found
 *       400:
 *         description: Cannot delete (referenced by child records)
 */
router.get('/:warehouseId', asyncHandler(warehouseController.getById));
router.patch('/:warehouseId', asyncHandler(warehouseController.update));
router.delete('/:warehouseId', asyncHandler(warehouseController.remove));

export default router;
