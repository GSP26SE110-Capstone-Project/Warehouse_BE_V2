import AiSlotRecommendation from '../models/AiSlotRecommendation.js';
import AppError from '../utils/AppError.js';
import { parseUuid } from '../utils/validate.js';
import { recommendSlotForLpn } from './aiSlotting/recommendation.service.js';
import { getLpn } from './lpn.service.js';
import { getWarehouseById } from './warehouse.service.js';
import { getBin } from './bin.service.js';
import { getZone } from './warehouseZone.service.js';
import { explainSlotRecommendation as explainViaOllama } from './ollama.service.js';
import InboundRequest from '../models/InboundRequest.js';

function wantsLlmExplanation(body) {
  return body.explainWithLlm === true || body.explainWithLlm === 'true';
}

async function attachLlmExplanation(payload) {
  try {
    const llm = await explainViaOllama({
      lpnCode: payload.lpnCode,
      zoneCode: payload.zoneCode,
      binCode: payload.binCode,
      recommendedZoneId: payload.recommendedZoneId,
      recommendedBinId: payload.recommendedBinId,
      score: payload.score ?? payload.recommendationScore,
      modelVersion: payload.modelVersion,
      reasons: payload.reasons ?? payload.parsedReason?.reasons,
      featureSnapshot: payload.featureSnapshot ?? payload.parsedReason?.featureSnapshot,
      suggestedRackType: payload.suggestedRackType,
      alternatives: payload.alternatives,
    });
    return {
      ...payload,
      llmExplanation: llm.explanation,
      llmModel: llm.llmModel,
      ollamaBaseUrl: llm.ollamaBaseUrl,
    };
  } catch (err) {
    if (err instanceof AppError && (err.code === 'OLLAMA_UNAVAILABLE' || err.code === 'OLLAMA_DISABLED')) {
      return {
        ...payload,
        llmExplanation: null,
        llmError: err.message,
        llmErrorCode: err.code,
      };
    }
    throw err;
  }
}

async function buildLlmContextFromRecommendationRow(row) {
  const formatted = formatRecommendation(row);
  let zoneCode = null;
  let binCode = null;

  if (row.recommendedBinId) {
    try {
      const bin = await getBin(row.recommendedBinId);
      binCode = bin.binCode;
    } catch {
      /* bin may have been removed */
    }
  }
  if (row.recommendedZoneId) {
    try {
      const zone = await getZone(row.recommendedZoneId);
      zoneCode = zone.zoneCode;
    } catch {
      /* zone may have been removed */
    }
  }

  let lpnCode = null;
  if (row.lpnId) {
    try {
      const lpn = await getLpn(row.lpnId);
      lpnCode = lpn.lpnCode;
    } catch {
      /* ignore */
    }
  }

  return {
    recommendationId: row.recommendationId,
    lpnId: row.lpnId,
    lpnCode,
    recommendedZoneId: row.recommendedZoneId,
    recommendedBinId: row.recommendedBinId,
    zoneCode,
    binCode,
    recommendationScore: row.recommendationScore,
    score: row.recommendationScore,
    modelVersion: formatted.parsedReason?.modelVersion,
    reasons: formatted.parsedReason?.reasons ?? [],
    featureSnapshot: formatted.parsedReason?.featureSnapshot ?? null,
    isApplied: row.isApplied,
  };
}

async function assertInboundRequestForLpn(inboundRequestId, lpn) {
  const id = parseUuid(inboundRequestId, 'inboundRequestId');
  const inbound = await InboundRequest.findById(id);
  if (!inbound) {
    throw new AppError('Inbound request not found', 404, 'NOT_FOUND');
  }
  if (inbound.tenantId !== lpn.tenantId) {
    throw new AppError(
      'inboundRequestId does not belong to the same tenant as LPN',
      400,
      'VALIDATION_ERROR'
    );
  }
  return inbound;
}

export async function getRecommendation(recommendationId) {
  const id = parseUuid(recommendationId, 'recommendationId');
  const row = await AiSlotRecommendation.findById(id);
  if (!row) {
    throw new AppError('AI slot recommendation not found', 404, 'NOT_FOUND');
  }
  return formatRecommendation(row);
}

function formatRecommendation(row) {
  let parsedReason = null;
  if (row.reason) {
    try {
      parsedReason = JSON.parse(row.reason);
    } catch {
      parsedReason = { reasons: [row.reason] };
    }
  }

  return {
    ...row,
    parsedReason,
  };
}

export async function listRecommendations({
  lpnId,
  inboundRequestId,
  isApplied,
  page,
  limit,
  offset,
}) {
  const filters = {};
  if (lpnId) filters.lpnId = parseUuid(lpnId, 'lpnId');
  if (inboundRequestId) {
    filters.inboundRequestId = parseUuid(inboundRequestId, 'inboundRequestId');
  }
  if (isApplied !== undefined && isApplied !== '') {
    filters.isApplied = isApplied === 'true' || isApplied === true;
  }

  const [items, total] = await Promise.all([
    AiSlotRecommendation.findAll(filters, {
      orderBy: 'created_at DESC',
      limit,
      offset,
    }),
    AiSlotRecommendation.count(filters),
  ]);

  return {
    items: items.map(formatRecommendation),
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 0,
    },
  };
}

/**
 * Run rule engine and persist top recommendation (Phase 1a).
 */
export async function createRecommendation(body) {
  const { lpnId, warehouseId, inboundRequestId } = body;

  if (!lpnId) {
    throw new AppError('lpnId is required', 400, 'VALIDATION_ERROR');
  }
  if (!warehouseId) {
    throw new AppError('warehouseId is required', 400, 'VALIDATION_ERROR');
  }

  const lpn = await getLpn(lpnId);
  if (inboundRequestId) {
    await assertInboundRequestForLpn(inboundRequestId, lpn);
  }

  const preview = await recommendSlotForLpn(lpnId, { warehouseId, inboundRequestId });

  const record = await AiSlotRecommendation.create({
    inboundRequestId: preview.inboundRequestId ?? undefined,
    lpnId: preview.lpnId,
    skuId: preview.skuId ?? undefined,
    recommendedZoneId: preview.recommendedZoneId,
    recommendedBinId: preview.recommendedBinId,
    recommendationScore: preview.score,
    reason: preview.reasonPayload,
    isApplied: false,
  });

  let result = {
    ...formatRecommendation(record),
    lpnCode: preview.lpnCode,
    alternatives: preview.alternatives,
    suggestedRackType: preview.suggestedRackType,
    zoneCode: preview.zoneCode,
    binCode: preview.binCode,
    reasons: preview.reasons,
    featureSnapshot: preview.featureSnapshot,
    modelVersion: preview.modelVersion,
  };

  if (wantsLlmExplanation(body)) {
    result = await attachLlmExplanation(result);
  }

  return result;
}

export async function updateRecommendation(recommendationId, body) {
  const id = parseUuid(recommendationId, 'recommendationId');
  const existing = await AiSlotRecommendation.findById(id);
  if (!existing) {
    throw new AppError('AI slot recommendation not found', 404, 'NOT_FOUND');
  }

  const data = {};
  if (body.isApplied !== undefined) {
    data.isApplied = Boolean(body.isApplied);
  }

  if (Object.keys(data).length === 0) {
    throw new AppError('No valid fields to update', 400, 'VALIDATION_ERROR');
  }

  const updated = await AiSlotRecommendation.updateById(id, data);
  return formatRecommendation(updated);
}

/**
 * Preview only — same as recommend without saving.
 */
export async function previewRecommendation(body) {
  const { lpnId, warehouseId, inboundRequestId } = body;
  if (!lpnId) {
    throw new AppError('lpnId is required', 400, 'VALIDATION_ERROR');
  }
  if (!warehouseId) {
    throw new AppError('warehouseId is required', 400, 'VALIDATION_ERROR');
  }

  const lpn = await getLpn(lpnId);
  if (inboundRequestId) {
    await assertInboundRequestForLpn(inboundRequestId, lpn);
  }
  await getWarehouseById(parseUuid(warehouseId, 'warehouseId'));

  let result = await recommendSlotForLpn(lpnId, { warehouseId, inboundRequestId });

  if (wantsLlmExplanation(body)) {
    result = await attachLlmExplanation(result);
  }

  return result;
}

/**
 * Llama (Ollama) explains an existing recommendation — bin choice stays from rule engine.
 */
export async function explainRecommendation(recommendationId) {
  const id = parseUuid(recommendationId, 'recommendationId');
  const row = await AiSlotRecommendation.findById(id);
  if (!row) {
    throw new AppError('AI slot recommendation not found', 404, 'NOT_FOUND');
  }

  const context = await buildLlmContextFromRecommendationRow(row);
  const llm = await explainViaOllama(context);

  return {
    ...context,
    ...llm,
  };
}
