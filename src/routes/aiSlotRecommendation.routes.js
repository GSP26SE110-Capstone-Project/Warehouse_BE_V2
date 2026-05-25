import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import * as aiSlotRecommendationController from '../controllers/aiSlotRecommendation.controller.js';

const router = Router();

router.get('/ollama/health', asyncHandler(aiSlotRecommendationController.ollamaHealth));
router.post('/preview', asyncHandler(aiSlotRecommendationController.preview));
router.post('/', asyncHandler(aiSlotRecommendationController.create));
router.get('/', asyncHandler(aiSlotRecommendationController.list));
router.get(
  '/:recommendationId/explain',
  asyncHandler(aiSlotRecommendationController.explain)
);
router.get('/:recommendationId', asyncHandler(aiSlotRecommendationController.getById));
router.patch('/:recommendationId', asyncHandler(aiSlotRecommendationController.update));

export default router;
