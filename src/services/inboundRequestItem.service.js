import pool from '../config/db.js';
import InboundRequestItem from '../models/InboundRequestItem.js';
import AppError from '../utils/AppError.js';
import { parseUuid } from '../utils/validate.js';
import { getInboundRequest } from './inboundRequest.service.js';
import { getSku } from './sku.service.js';
import { assertContractInboundWithinCommittedPieces } from './contractInboundCommitment.service.js';
import { assertInboundInReceivingPhase } from '../utils/inboundStatus.js';

const CREATE_FIELDS = ['inboundRequestId', 'skuId', 'expectedQuantity'];
const UPDATE_FIELDS = ['expectedQuantity', 'receivedQuantity', 'discrepancyQuantity'];

function pickFields(source, fields) {
  const result = {};
  for (const field of fields) {
    if (source[field] !== undefined) {
      result[field] = source[field];
    }
  }
  return result;
}

function parsePositiveInt(value, fieldName) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) {
    throw new AppError(`${fieldName} must be a positive integer`, 400, 'VALIDATION_ERROR');
  }
  return n;
}

function parseNonNegativeInt(value, fieldName) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) {
    throw new AppError(`${fieldName} must be a non-negative integer`, 400, 'VALIDATION_ERROR');
  }
  return n;
}

function mapItemRow(row) {
  if (!row) return null;
  const sku = row.sku_code
    ? {
        skuId: row.sku_id,
        skuCode: row.sku_code,
        productName: row.product_name,
        productKind: row.product_kind ?? null,
        color: row.color,
        size: row.size,
      }
    : undefined;

  return {
    inboundRequestItemId: row.inbound_request_item_id ?? row.inboundRequestItemId,
    inboundRequestId: row.inbound_request_id ?? row.inboundRequestId,
    skuId: row.sku_id ?? row.skuId,
    expectedQuantity: row.expected_quantity ?? row.expectedQuantity,
    receivedQuantity: row.received_quantity ?? row.receivedQuantity,
    discrepancyQuantity: row.discrepancy_quantity ?? row.discrepancyQuantity,
    createdAt: row.created_at ?? row.createdAt,
    ...(sku ? { sku } : {}),
  };
}

function computeDiscrepancy(expectedQuantity, receivedQuantity) {
  return expectedQuantity - receivedQuantity;
}

async function findItemByInboundAndSku(inboundRequestId, skuId, excludeItemId = null) {
  const rows = await InboundRequestItem.findAll({ inboundRequestId });
  return rows.find(
    (row) => row.skuId === skuId && row.inboundRequestItemId !== excludeItemId
  );
}

async function assertSkuMatchesInboundTenant(inbound, skuId) {
  const sku = await getSku(skuId);
  if (sku.tenantId !== inbound.tenantId) {
    throw new AppError('skuId does not belong to this inbound tenant', 400, 'VALIDATION_ERROR');
  }
  return sku;
}

function normalizeCreatePayload(body, inboundRequestIdFromPath = null) {
  const data = pickFields(body, CREATE_FIELDS);

  const inboundRequestId = inboundRequestIdFromPath ?? data.inboundRequestId;
  if (!inboundRequestId) {
    throw new AppError('inboundRequestId is required', 400, 'VALIDATION_ERROR');
  }
  if (!data.skuId) {
    throw new AppError('skuId is required', 400, 'VALIDATION_ERROR');
  }
  if (data.expectedQuantity == null) {
    throw new AppError('expectedQuantity is required', 400, 'VALIDATION_ERROR');
  }

  return {
    inboundRequestId: parseUuid(inboundRequestId, 'inboundRequestId'),
    skuId: parseUuid(data.skuId, 'skuId'),
    expectedQuantity: parsePositiveInt(data.expectedQuantity, 'expectedQuantity'),
    receivedQuantity: 0,
    discrepancyQuantity: parsePositiveInt(data.expectedQuantity, 'expectedQuantity'),
  };
}

function normalizeUpdatePayload(body) {
  const data = pickFields(body, UPDATE_FIELDS);

  if (data.expectedQuantity != null) {
    data.expectedQuantity = parsePositiveInt(data.expectedQuantity, 'expectedQuantity');
  }
  if (data.receivedQuantity != null) {
    data.receivedQuantity = parseNonNegativeInt(data.receivedQuantity, 'receivedQuantity');
  }
  if (data.discrepancyQuantity != null) {
    data.discrepancyQuantity = parseNonNegativeInt(
      data.discrepancyQuantity,
      'discrepancyQuantity'
    );
  }

  if (Object.keys(data).length === 0) {
    throw new AppError('No valid fields to update', 400, 'VALIDATION_ERROR');
  }

  return data;
}

export async function getInboundRequestItem(inboundRequestItemId) {
  const id = parseUuid(inboundRequestItemId, 'inboundRequestItemId');
  const item = await InboundRequestItem.findById(id);
  if (!item) {
    throw new AppError('Inbound request item not found', 404, 'NOT_FOUND');
  }
  return item;
}

export async function getInboundRequestItemWithSku(inboundRequestItemId) {
  const id = parseUuid(inboundRequestItemId, 'inboundRequestItemId');
  const result = await pool.query(
    `SELECT i.inbound_request_item_id, i.inbound_request_id, i.sku_id,
            i.expected_quantity, i.received_quantity, i.discrepancy_quantity, i.created_at,
            s.sku_code, s.product_name, s.product_kind, s.color, s.size
     FROM inbound_request_items i
     INNER JOIN skus s ON s.sku_id = i.sku_id
     WHERE i.inbound_request_item_id = $1`,
    [id]
  );
  if (result.rows.length === 0) {
    throw new AppError('Inbound request item not found', 404, 'NOT_FOUND');
  }
  return mapItemRow(result.rows[0]);
}

export async function getInboundRequestWithItems(inboundRequestId) {
  const inbound = await getInboundRequest(inboundRequestId);
  const { items } = await listInboundRequestItems(inbound.inboundRequestId, {
    page: 1,
    limit: 500,
    offset: 0,
  });
  return { ...inbound, items };
}

export async function listInboundRequestItems(inboundRequestId, { page, limit, offset }) {
  const inboundUuid = parseUuid(inboundRequestId, 'inboundRequestId');
  await getInboundRequest(inboundUuid);

  const [rowsResult, countResult] = await Promise.all([
    pool.query(
      `SELECT i.inbound_request_item_id, i.inbound_request_id, i.sku_id,
              i.expected_quantity, i.received_quantity, i.discrepancy_quantity, i.created_at,
              s.sku_code, s.product_name, s.product_kind, s.color, s.size
       FROM inbound_request_items i
       INNER JOIN skus s ON s.sku_id = i.sku_id
       WHERE i.inbound_request_id = $1
       ORDER BY s.sku_code ASC
       LIMIT $2 OFFSET $3`,
      [inboundUuid, limit, offset]
    ),
    pool.query(
      `SELECT COUNT(*)::int AS count FROM inbound_request_items WHERE inbound_request_id = $1`,
      [inboundUuid]
    ),
  ]);

  const total = countResult.rows[0].count;

  return {
    items: rowsResult.rows.map(mapItemRow),
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 0,
    },
  };
}

export async function createInboundRequestItem(body, inboundRequestIdFromPath = null) {
  const data = normalizeCreatePayload(body, inboundRequestIdFromPath);
  const inbound = await getInboundRequest(data.inboundRequestId);

  if (!['DRAFT', 'PENDING', 'APPROVED', 'ARRIVED', 'RECEIVING'].includes(inbound.status)) {
    throw new AppError(
      'Cannot add items to inbound in current status',
      400,
      'INVALID_INBOUND_STATUS'
    );
  }

  await assertSkuMatchesInboundTenant(inbound, data.skuId);

  const duplicate = await findItemByInboundAndSku(data.inboundRequestId, data.skuId);
  if (duplicate) {
    throw new AppError(
      'This SKU is already on the inbound request; update quantity instead',
      409,
      'DUPLICATE'
    );
  }

  await assertContractInboundWithinCommittedPieces(inbound.contractId, {
    additionalPieces: data.expectedQuantity,
    items: [{ skuId: data.skuId, expectedQuantity: data.expectedQuantity }],
  });

  data.discrepancyQuantity = data.expectedQuantity;
  const created = await InboundRequestItem.create(data);
  return getInboundRequestItemWithSku(created.inboundRequestItemId);
}

export async function updateInboundRequestItem(inboundRequestItemId, body) {
  const id = parseUuid(inboundRequestItemId, 'inboundRequestItemId');
  const existing = await getInboundRequestItem(id);
  const inbound = await getInboundRequest(existing.inboundRequestId);
  assertInboundInReceivingPhase(inbound, 'updating received quantities');

  const data = normalizeUpdatePayload(body);

  const expected =
    data.expectedQuantity != null ? data.expectedQuantity : existing.expectedQuantity;

  if (data.receivedQuantity != null && data.discrepancyQuantity === undefined) {
    data.discrepancyQuantity = computeDiscrepancy(expected, data.receivedQuantity);
  }

  if (data.expectedQuantity != null && data.receivedQuantity == null) {
    const received = existing.receivedQuantity ?? 0;
    data.discrepancyQuantity = computeDiscrepancy(data.expectedQuantity, received);
  }

  if (data.expectedQuantity != null) {
    await assertSkuMatchesInboundTenant(inbound, existing.skuId);
    await assertContractInboundWithinCommittedPieces(inbound.contractId, {
      additionalPieces: Math.max(0, data.expectedQuantity - (existing.receivedQuantity ?? 0)),
      items: [
        {
          skuId: existing.skuId,
          expectedQuantity: data.expectedQuantity,
          receivedQuantity: existing.receivedQuantity ?? 0,
        },
      ],
      excludeInboundRequestItemId: id,
    });
  }

  await InboundRequestItem.updateById(id, data);
  return getInboundRequestItemWithSku(id);
}

export async function deleteInboundRequestItem(inboundRequestItemId) {
  const id = parseUuid(inboundRequestItemId, 'inboundRequestItemId');
  const existing = await getInboundRequestItem(id);
  const inbound = await getInboundRequest(existing.inboundRequestId);

  if (!['DRAFT', 'PENDING', 'APPROVED'].includes(inbound.status)) {
    throw new AppError(
      'Cannot delete items after inbound has arrived for receiving',
      400,
      'INVALID_INBOUND_STATUS'
    );
  }

  const deleted = await InboundRequestItem.deleteById(id);
  if (!deleted) {
    throw new AppError('Inbound request item not found', 404, 'NOT_FOUND');
  }
  return {
    inboundRequestItemId: deleted.inboundRequestItemId,
    inboundRequestId: deleted.inboundRequestId,
    skuId: deleted.skuId,
    expectedQuantity: deleted.expectedQuantity,
    receivedQuantity: deleted.receivedQuantity,
    discrepancyQuantity: deleted.discrepancyQuantity,
  };
}

/**
 * Bulk update received quantities during receiving (QC / count).
 */
export async function receiveInboundItems(inboundRequestId, items = []) {
  const inboundUuid = parseUuid(inboundRequestId, 'inboundRequestId');
  const inbound = await getInboundRequest(inboundUuid);
  assertInboundInReceivingPhase(inbound, 'recording received quantities');

  if (!Array.isArray(items) || items.length === 0) {
    throw new AppError('items array is required', 400, 'VALIDATION_ERROR');
  }

  const updated = [];
  for (const entry of items) {
    const itemId = parseUuid(entry.inboundRequestItemId, 'inboundRequestItemId');
    const existing = await getInboundRequestItem(itemId);
    if (existing.inboundRequestId !== inboundUuid) {
      throw new AppError(
        'inboundRequestItemId does not belong to this inbound request',
        400,
        'VALIDATION_ERROR'
      );
    }

    const receivedQuantity = parseNonNegativeInt(
      entry.receivedQuantity,
      'receivedQuantity'
    );
    const discrepancyQuantity = computeDiscrepancy(
      existing.expectedQuantity,
      receivedQuantity
    );

    await InboundRequestItem.updateById(itemId, {
      receivedQuantity,
      discrepancyQuantity,
    });
    updated.push(await getInboundRequestItemWithSku(itemId));
  }

  return updated;
}
