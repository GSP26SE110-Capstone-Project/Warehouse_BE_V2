import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import * as aiSlotRecommendationController from '../controllers/aiSlotRecommendation.controller.js';

const router = Router();

router.get('/ollama/health', asyncHandler(aiSlotRecommendationController.ollamaHealth));
router.get('/gemini/health', asyncHandler(aiSlotRecommendationController.geminiHealth));
router.post('/preview', asyncHandler(aiSlotRecommendationController.preview));
router.post('/explain', asyncHandler(aiSlotRecommendationController.explainBody));
router.post('/', asyncHandler(aiSlotRecommendationController.create));
router.get('/', asyncHandler(aiSlotRecommendationController.list));
router.get(
  '/:recommendationId/explain',
  asyncHandler(aiSlotRecommendationController.explainById)
);
router.get('/:recommendationId', asyncHandler(aiSlotRecommendationController.getById));
router.patch('/:recommendationId', asyncHandler(aiSlotRecommendationController.update));

export default router;
