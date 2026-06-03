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
import rentalRequestRoutes from './rentalRequest.routes.js';
import tenantCompanyRoutes from './tenantCompany.routes.js';
import contractRoutes from './contract.routes.js';
import contractItemRoutes from './contractItem.routes.js';
import storageReservationRoutes from './storageReservation.routes.js';
import lpnRoutes from './lpn.routes.js';
import lpnDetailRoutes from './lpnDetail.routes.js';
import inboundRequestRoutes from './inboundRequest.routes.js';
import inboundRequestItemRoutes from './inboundRequestItem.routes.js';
import inventoryRoutes from './inventory.routes.js';
import outboundRequestRoutes from './outboundRequest.routes.js';
import shipmentRoutes from './shipment.routes.js';
import aiSlotRecommendationRoutes from './aiSlotRecommendation.routes.js';
import batchRoutes from './batch.routes.js';
import skuRoutes from './sku.routes.js';
import categoryRoutes from './category.routes.js';
import productKindCatalogRoutes from './productKindCatalog.routes.js';
import sizeFactorCatalogRoutes from './sizeFactorCatalog.routes.js';
import seasonRoutes from './season.routes.js';
import collectionRoutes from './collection.routes.js';
import locationRoutes from './location.routes.js';
import adminNotificationRoutes from './adminNotification.routes.js';
import scanRoutes from './scan.routes.js';
import * as rentalRequestController from '../controllers/rentalRequest.controller.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/warehouses', warehouseRoutes);
router.use('/zones', zoneRoutes);
router.use('/racks', rackRoutes);
router.use('/rack-levels', rackLevelRoutes);
router.use('/bins', binRoutes);
// Registered on api router before mount — guest lookup (code + email query)
router.get(
  '/rental-requests/guest/lookup',
  asyncHandler(rentalRequestController.lookupByCode)
);
router.use('/rental-requests', rentalRequestRoutes);
router.use('/tenants', tenantCompanyRoutes);
router.use('/contracts', contractRoutes);
router.use('/contract-items', contractItemRoutes);
router.use('/storage-reservations', storageReservationRoutes);
router.use('/batches', batchRoutes);
router.use('/categories', categoryRoutes);
router.use('/product-kinds', productKindCatalogRoutes);
router.use('/size-factors', sizeFactorCatalogRoutes);
router.use('/seasons', seasonRoutes);
router.use('/collections', collectionRoutes);
router.use('/locations', locationRoutes);
router.use('/admin/notifications', adminNotificationRoutes);
router.use('/scan', scanRoutes);
router.use('/skus', skuRoutes);
router.use('/lpns', lpnRoutes);
router.use('/lpn-details', lpnDetailRoutes);
router.use('/inbound-requests', inboundRequestRoutes);
router.use('/inbound-request-items', inboundRequestItemRoutes);
router.use('/inventories', inventoryRoutes);
router.use('/outbound-requests', outboundRequestRoutes);
router.use('/shipments', shipmentRoutes);

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
