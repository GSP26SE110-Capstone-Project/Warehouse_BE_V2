import * as aiSlotRecommendationService from '../services/aiSlotRecommendation.service.js';
import { checkOllamaHealth } from '../services/ollama.service.js';
import { checkGeminiHealth } from '../services/gemini.service.js';
import { created, paginated, success } from '../utils/apiResponse.js';
import { parsePagination } from '../utils/validate.js';

export async function ollamaHealth(req, res) {
  const status = await checkOllamaHealth();
  success(res, status, status.message);
}

export async function geminiHealth(req, res) {
  const status = await checkGeminiHealth();
  success(res, status, status.message);
}

/** POST /explain — llmProvider required in body (gemini | ollama). */
export async function explainBody(req, res) {
  const result = await aiSlotRecommendationService.explainSlotRecommendationBody(
    req.body
  );
  success(res, result, 'Slot recommendation explained');
}

/** GET /:id/explain?llmProvider=gemini|ollama (required). */
export async function explainById(req, res) {
  const result = await aiSlotRecommendationService.explainRecommendation(
    req.params.recommendationId,
    { llmProvider: req.query.llmProvider }
  );
  success(res, result, 'Slot recommendation explained');
}

export async function create(req, res) {
  const result = await aiSlotRecommendationService.createRecommendation(req.body);
  created(res, result, 'Slot recommendation created');
}

export async function preview(req, res) {
  const result = await aiSlotRecommendationService.previewRecommendation(req.body);
  success(res, result, 'Slot recommendation preview');
}

export async function list(req, res) {
  const { page, limit, offset } = parsePagination(req.query);
  const { lpnId, inboundRequestId, isApplied } = req.query;

  const result = await aiSlotRecommendationService.listRecommendations({
    lpnId,
    inboundRequestId,
    isApplied,
    page,
    limit,
    offset,
  });

  paginated(res, result.items, result.meta);
}

export async function getById(req, res) {
  const row = await aiSlotRecommendationService.getRecommendation(
    req.params.recommendationId
  );
  success(res, row);
}

export async function update(req, res) {
  const row = await aiSlotRecommendationService.updateRecommendation(
    req.params.recommendationId,
    req.body
  );
  success(res, row, 'Updated successfully');
}
