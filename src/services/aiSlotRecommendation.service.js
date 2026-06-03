import AiSlotRecommendation from '../models/AiSlotRecommendation.js';
import AppError from '../utils/AppError.js';
import { parseUuid } from '../utils/validate.js';
import { recommendSlotForLpn } from './aiSlotting/recommendation.service.js';
import { getLpn } from './lpn.service.js';
import { getWarehouseById } from './warehouse.service.js';
import { getBin } from './bin.service.js';
import { getRack } from './rack.service.js';
import { getRackLevel } from './rackLevel.service.js';
import { getZone } from './warehouseZone.service.js';
import { explainSlotRecommendationStrict } from './aiExplain.service.js';
import InboundRequest from '../models/InboundRequest.js';

function rejectLegacyExplainOnSlotApi(body) {
  if (body.explainWithLlm === true || body.explainWithLlm === 'true') {
    throw new AppError(
      'explainWithLlm is no longer supported on preview/create. Use POST /api/ai/slot-recommendations/explain with llmProvider "gemini" or "ollama".',
      400,
      'USE_EXPLAIN_ENDPOINT'
    );
  }
}

function buildExplainContextFromSlotPayload(payload) {
  return {
    lpnCode: payload.lpnCode,
    zoneCode: payload.zoneCode,
    rackCode: payload.rackCode,
    binCode: payload.binCode,
    recommendedZoneId: payload.recommendedZoneId,
    recommendedRackId: payload.recommendedRackId,
    recommendedBinId: payload.recommendedBinId,
    score: payload.score ?? payload.recommendationScore,
    modelVersion: payload.modelVersion,
    reasons: payload.reasons ?? payload.parsedReason?.reasons,
    featureSnapshot: payload.featureSnapshot ?? payload.parsedReason?.featureSnapshot,
    suggestedRackType: payload.suggestedRackType,
    alternatives: payload.alternatives,
  };
}

async function buildLlmContextFromRecommendationRow(row) {
  const formatted = formatRecommendation(row);
  let zoneCode = null;
  let rackCode = null;
  let binCode = null;

  if (row.recommendedBinId) {
    try {
      const bin = await getBin(row.recommendedBinId);
      binCode = bin.binCode;
      if (bin.rackLevelId) {
        try {
          const level = await getRackLevel(bin.rackLevelId);
          const rack = await getRack(level.rackId);
          rackCode = rack.rackCode;
        } catch {
          /* rack level may have been removed */
        }
      }
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
    rackCode,
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
  rejectLegacyExplainOnSlotApi(body);

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
    rackCode: preview.rackCode,
    binCode: preview.binCode,
    recommendedRackId: preview.recommendedRackId,
    recommendedRackLevelId: preview.recommendedRackLevelId,
    levelNumber: preview.levelNumber,
    reasons: preview.reasons,
    featureSnapshot: preview.featureSnapshot,
    modelVersion: preview.modelVersion,
  };

  return result;
}

/**
 * After putaway: mark latest (or explicit) recommendation applied if bin matches AI suggestion.
 */
export async function resolveRecommendationOnPutaway(
  lpnId,
  actualBinId,
  { recommendationId, client } = {}
) {
  const lpnUuid = parseUuid(lpnId, 'lpnId');
  const binUuid = parseUuid(actualBinId, 'actualBinId');

  let rec = null;

  if (recommendationId) {
    const recId = parseUuid(recommendationId, 'recommendationId');
    rec = await AiSlotRecommendation.findById(recId, client);
    if (!rec) {
      return null;
    }
    if (rec.lpnId && rec.lpnId !== lpnUuid) {
      throw new AppError('recommendationId does not match this LPN', 400, 'VALIDATION_ERROR');
    }
  } else {
    const pending = await AiSlotRecommendation.findAll(
      { lpnId: lpnUuid, isApplied: false },
      { orderBy: 'created_at DESC', limit: 1 },
      client
    );
    rec = pending[0] ?? null;
  }

  if (!rec || rec.isApplied) {
    return null;
  }

  const matchesAiBin = rec.recommendedBinId === binUuid;
  const updated = await AiSlotRecommendation.updateById(
    rec.recommendationId,
    { isApplied: matchesAiBin },
    client
  );

  return {
    recommendationId: updated.recommendationId,
    isApplied: updated.isApplied,
    wasOverridden: !matchesAiBin,
    recommendedBinId: rec.recommendedBinId,
    actualBinId: binUuid,
  };
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
  rejectLegacyExplainOnSlotApi(body);

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

  return recommendSlotForLpn(lpnId, { warehouseId, inboundRequestId });
}

/**
 * Dedicated explain API — requires llmProvider; never calls the other provider.
 *
 * Mode A: { llmProvider, recommendationId }
 * Mode B: { llmProvider, lpnId, warehouseId, inboundRequestId? } — runs rule engine then explains
 * Mode C: { llmProvider, reasons, zoneCode, binCode, ... } — explains from preview payload
 */
export async function explainSlotRecommendationBody(body) {
  const { llmProvider } = body;

  if (body.recommendationId) {
    return explainRecommendation(body.recommendationId, { llmProvider });
  }

  let slotPayload = body.slot ?? body;

  if (body.lpnId && body.warehouseId) {
    const lpn = await getLpn(body.lpnId);
    if (body.inboundRequestId) {
      await assertInboundRequestForLpn(body.inboundRequestId, lpn);
    }
    await getWarehouseById(parseUuid(body.warehouseId, 'warehouseId'));
    slotPayload = await recommendSlotForLpn(body.lpnId, {
      warehouseId: body.warehouseId,
      inboundRequestId: body.inboundRequestId,
    });
  }

  const reasons = slotPayload.reasons ?? slotPayload.parsedReason?.reasons;
  if (!reasons?.length) {
    throw new AppError(
      'Provide recommendationId, or lpnId+warehouseId, or slot preview fields (reasons, binCode, ...)',
      400,
      'VALIDATION_ERROR'
    );
  }

  const context = buildExplainContextFromSlotPayload(slotPayload);
  const llm = await explainSlotRecommendationStrict(context, { provider: llmProvider });

  return {
    ...context,
    ...llm,
  };
}

/**
 * LLM explains an existing recommendation — bin choice stays from rule engine.
 */
export async function explainRecommendation(recommendationId, { llmProvider } = {}) {
  const id = parseUuid(recommendationId, 'recommendationId');
  const row = await AiSlotRecommendation.findById(id);
  if (!row) {
    throw new AppError('AI slot recommendation not found', 404, 'NOT_FOUND');
  }

  const context = await buildLlmContextFromRecommendationRow(row);
  const llm = await explainSlotRecommendationStrict(context, { provider: llmProvider });

  return {
    ...context,
    ...llm,
  };
}
