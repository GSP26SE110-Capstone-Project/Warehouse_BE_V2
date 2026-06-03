import pool from '../config/db.js';
import OutboundRequestItem from '../models/OutboundRequestItem.js';
import AppError from '../utils/AppError.js';
import { parseUuid } from '../utils/validate.js';
import OutboundRequest from '../models/OutboundRequest.js';
import { assertSufficientInventory } from '../utils/outboundInventory.js';
import { getSku } from './sku.service.js';

const CREATE_FIELDS = ['outboundRequestId', 'skuId', 'requestedQuantity'];
const UPDATE_FIELDS = ['requestedQuantity'];

const EDITABLE_OUTBOUND_STATUSES = Object.freeze(['DRAFT', 'PENDING']);

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
    outboundRequestItemId: row.outbound_request_item_id ?? row.outboundRequestItemId,
    outboundRequestId: row.outbound_request_id ?? row.outboundRequestId,
    skuId: row.sku_id ?? row.skuId,
    requestedQuantity: row.requested_quantity ?? row.requestedQuantity,
    allocatedQuantity: row.allocated_quantity ?? row.allocatedQuantity ?? 0,
    pickedQuantity: row.picked_quantity ?? row.pickedQuantity ?? 0,
    ...(sku ? { sku } : {}),
  };
}

async function findItemByOutboundAndSku(outboundRequestId, skuId, excludeItemId = null) {
  const rows = await OutboundRequestItem.findAll({ outboundRequestId });
  return rows.find(
    (row) => row.skuId === skuId && row.outboundRequestItemId !== excludeItemId
  );
}

async function loadOutboundRequest(outboundRequestId) {
  const id = parseUuid(outboundRequestId, 'outboundRequestId');
  const outbound = await OutboundRequest.findById(id);
  if (!outbound) {
    throw new AppError('Outbound request not found', 404, 'NOT_FOUND');
  }
  return outbound;
}

async function assertSkuMatchesOutboundTenant(outbound, skuId) {
  const sku = await getSku(skuId);
  if (sku.tenantId !== outbound.tenantId) {
    throw new AppError('skuId does not belong to this outbound tenant', 400, 'VALIDATION_ERROR');
  }
  return sku;
}

function assertOutboundAllowsItemEdits(outbound) {
  if (!EDITABLE_OUTBOUND_STATUSES.includes(outbound.status)) {
    throw new AppError(
      'Cannot modify items on outbound in current status',
      400,
      'INVALID_OUTBOUND_STATUS'
    );
  }
}

function normalizeCreatePayload(body, outboundRequestIdFromPath = null) {
  const data = pickFields(body, CREATE_FIELDS);

  const outboundRequestId = outboundRequestIdFromPath ?? data.outboundRequestId;
  if (!outboundRequestId) {
    throw new AppError('outboundRequestId is required', 400, 'VALIDATION_ERROR');
  }
  if (!data.skuId) {
    throw new AppError('skuId is required', 400, 'VALIDATION_ERROR');
  }
  if (data.requestedQuantity == null) {
    throw new AppError('requestedQuantity is required', 400, 'VALIDATION_ERROR');
  }

  return {
    outboundRequestId: parseUuid(outboundRequestId, 'outboundRequestId'),
    skuId: parseUuid(data.skuId, 'skuId'),
    requestedQuantity: parsePositiveInt(data.requestedQuantity, 'requestedQuantity'),
    allocatedQuantity: 0,
    pickedQuantity: 0,
  };
}

function normalizeUpdatePayload(body) {
  const data = pickFields(body, UPDATE_FIELDS);

  if (data.requestedQuantity != null) {
    data.requestedQuantity = parsePositiveInt(data.requestedQuantity, 'requestedQuantity');
  }

  if (Object.keys(data).length === 0) {
    throw new AppError('No valid fields to update', 400, 'VALIDATION_ERROR');
  }

  return data;
}

export async function getOutboundRequestItem(outboundRequestItemId) {
  const id = parseUuid(outboundRequestItemId, 'outboundRequestItemId');
  const item = await OutboundRequestItem.findById(id);
  if (!item) {
    throw new AppError('Outbound request item not found', 404, 'NOT_FOUND');
  }
  return item;
}

export async function getOutboundRequestItemWithSku(outboundRequestItemId) {
  const id = parseUuid(outboundRequestItemId, 'outboundRequestItemId');
  const result = await pool.query(
    `SELECT oi.outbound_request_item_id, oi.outbound_request_id, oi.sku_id,
            oi.requested_quantity, oi.allocated_quantity, oi.picked_quantity,
            s.sku_code, s.product_name, s.product_kind, s.color, s.size
     FROM outbound_request_items oi
     INNER JOIN skus s ON s.sku_id = oi.sku_id
     WHERE oi.outbound_request_item_id = $1`,
    [id]
  );
  if (result.rows.length === 0) {
    throw new AppError('Outbound request item not found', 404, 'NOT_FOUND');
  }
  return mapItemRow(result.rows[0]);
}

export async function getOutboundRequestWithItems(outboundRequestId) {
  const outbound = await loadOutboundRequest(outboundRequestId);
  const { items } = await listOutboundRequestItems(outbound.outboundRequestId, {
    page: 1,
    limit: 500,
    offset: 0,
  });
  return { ...outbound, items };
}

export async function listOutboundRequestItems(outboundRequestId, { page, limit, offset }) {
  const outboundUuid = parseUuid(outboundRequestId, 'outboundRequestId');
  await loadOutboundRequest(outboundUuid);

  const [rowsResult, countResult] = await Promise.all([
    pool.query(
      `SELECT oi.outbound_request_item_id, oi.outbound_request_id, oi.sku_id,
              oi.requested_quantity, oi.allocated_quantity, oi.picked_quantity,
              s.sku_code, s.product_name, s.product_kind, s.color, s.size
       FROM outbound_request_items oi
       INNER JOIN skus s ON s.sku_id = oi.sku_id
       WHERE oi.outbound_request_id = $1
       ORDER BY s.sku_code ASC
       LIMIT $2 OFFSET $3`,
      [outboundUuid, limit, offset]
    ),
    pool.query(
      `SELECT COUNT(*)::int AS count FROM outbound_request_items WHERE outbound_request_id = $1`,
      [outboundUuid]
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

export async function assertOutboundHasAtLeastOneItem(outboundRequestId) {
  const outboundUuid = parseUuid(outboundRequestId, 'outboundRequestId');
  const count = await OutboundRequestItem.count({ outboundRequestId: outboundUuid });
  if (count < 1) {
    throw new AppError(
      'Outbound request must have at least one line item (SKU + quantity)',
      400,
      'VALIDATION_ERROR'
    );
  }
}

export async function assertOutboundInventorySufficient(outboundRequestId) {
  const outbound = await loadOutboundRequest(outboundRequestId);
  const items = await OutboundRequestItem.findAll({ outboundRequestId: outbound.outboundRequestId });

  for (const item of items) {
    await assertSufficientInventory({
      tenantId: outbound.tenantId,
      warehouseId: outbound.warehouseId,
      skuId: item.skuId,
      requestedQuantity: item.requestedQuantity,
      excludeOutboundRequestItemId: item.outboundRequestItemId,
    });
  }
}

export async function createOutboundRequestItem(body, outboundRequestIdFromPath = null) {
  const data = normalizeCreatePayload(body, outboundRequestIdFromPath);
  const outbound = await loadOutboundRequest(data.outboundRequestId);
  assertOutboundAllowsItemEdits(outbound);

  await assertSkuMatchesOutboundTenant(outbound, data.skuId);

  const duplicate = await findItemByOutboundAndSku(data.outboundRequestId, data.skuId);
  if (duplicate) {
    throw new AppError(
      'This SKU is already on the outbound request; update quantity instead',
      409,
      'DUPLICATE'
    );
  }

  await assertSufficientInventory({
    tenantId: outbound.tenantId,
    warehouseId: outbound.warehouseId,
    skuId: data.skuId,
    requestedQuantity: data.requestedQuantity,
  });

  const created = await OutboundRequestItem.create(data);
  return getOutboundRequestItemWithSku(created.outboundRequestItemId);
}

export async function updateOutboundRequestItem(outboundRequestItemId, body) {
  const id = parseUuid(outboundRequestItemId, 'outboundRequestItemId');
  const existing = await getOutboundRequestItem(id);
  const outbound = await loadOutboundRequest(existing.outboundRequestId);
  assertOutboundAllowsItemEdits(outbound);

  const data = normalizeUpdatePayload(body);
  const requestedQuantity =
    data.requestedQuantity != null ? data.requestedQuantity : existing.requestedQuantity;

  if (data.requestedQuantity != null) {
    await assertSufficientInventory({
      tenantId: outbound.tenantId,
      warehouseId: outbound.warehouseId,
      skuId: existing.skuId,
      requestedQuantity,
      excludeOutboundRequestItemId: id,
    });
  }

  await OutboundRequestItem.updateById(id, data);
  return getOutboundRequestItemWithSku(id);
}

export async function deleteOutboundRequestItem(outboundRequestItemId) {
  const id = parseUuid(outboundRequestItemId, 'outboundRequestItemId');
  const existing = await getOutboundRequestItem(id);
  const outbound = await loadOutboundRequest(existing.outboundRequestId);
  assertOutboundAllowsItemEdits(outbound);

  const deleted = await OutboundRequestItem.deleteById(id);
  if (!deleted) {
    throw new AppError('Outbound request item not found', 404, 'NOT_FOUND');
  }
  return {
    outboundRequestItemId: deleted.outboundRequestItemId,
    outboundRequestId: deleted.outboundRequestId,
    skuId: deleted.skuId,
    requestedQuantity: deleted.requestedQuantity,
    allocatedQuantity: deleted.allocatedQuantity,
    pickedQuantity: deleted.pickedQuantity,
  };
}
