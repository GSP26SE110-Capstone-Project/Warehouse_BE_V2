import Lpn from '../models/Lpn.js';
import LpnDetail from '../models/LpnDetail.js';
import pool from '../config/db.js';
import AppError from '../utils/AppError.js';
import { parseUuid } from '../utils/validate.js';
import { getLpn } from './lpn.service.js';
import { getSku } from './sku.service.js';

const CREATE_FIELDS = ['lpnId', 'skuId', 'quantity'];
const UPDATE_FIELDS = ['quantity'];

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

function mapDetailRow(row) {
  return {
    lpnDetailId: row.lpn_detail_id,
    lpnId: row.lpn_id,
    skuId: row.sku_id,
    quantity: row.quantity,
    sku: {
      skuId: row.sku_id,
      skuCode: row.sku_code,
      productName: row.product_name,
      color: row.color,
      size: row.size,
    },
  };
}

async function findDetailByLpnAndSku(lpnId, skuId, excludeDetailId = null) {
  const rows = await LpnDetail.findAll({ lpnId });
  return rows.find(
    (row) => row.skuId === skuId && row.lpnDetailId !== excludeDetailId
  );
}

async function syncLpnActualQuantity(lpnId) {
  const rows = await LpnDetail.findAll({ lpnId });
  const total = rows.reduce((sum, row) => sum + Number(row.quantity || 0), 0);

  const lpn = await Lpn.findById(lpnId);
  const update = { actualQuantity: total };

  if (lpn?.maxCapacity != null && lpn.maxCapacity > 0) {
    const pct = Math.min(100, Math.round((total / lpn.maxCapacity) * 10000) / 100);
    update.fillPercentage = pct;
  }

  await Lpn.updateById(lpnId, update);
}

async function assertLpnSkuSameTenant(lpn, sku) {
  if (lpn.tenantId !== sku.tenantId) {
    throw new AppError('skuId does not belong to the same tenant as LPN', 400, 'VALIDATION_ERROR');
  }
}

function normalizeCreatePayload(body) {
  const data = pickFields(body, CREATE_FIELDS);

  if (!data.lpnId) {
    throw new AppError('lpnId is required', 400, 'VALIDATION_ERROR');
  }
  if (!data.skuId) {
    throw new AppError('skuId is required', 400, 'VALIDATION_ERROR');
  }
  if (data.quantity == null) {
    throw new AppError('quantity is required', 400, 'VALIDATION_ERROR');
  }

  data.lpnId = parseUuid(data.lpnId, 'lpnId');
  data.skuId = parseUuid(data.skuId, 'skuId');
  data.quantity = parsePositiveInt(data.quantity, 'quantity');

  return data;
}

function normalizeUpdatePayload(body) {
  const data = pickFields(body, UPDATE_FIELDS);

  if (data.quantity != null) {
    data.quantity = parsePositiveInt(data.quantity, 'quantity');
  }

  if (Object.keys(data).length === 0) {
    throw new AppError('No valid fields to update', 400, 'VALIDATION_ERROR');
  }

  return data;
}

export async function getLpnDetail(lpnDetailId) {
  const id = parseUuid(lpnDetailId, 'lpnDetailId');
  const detail = await LpnDetail.findById(id);
  if (!detail) {
    throw new AppError('LPN detail not found', 404, 'NOT_FOUND');
  }
  return detail;
}

export async function getLpnDetailWithSku(lpnDetailId) {
  const id = parseUuid(lpnDetailId, 'lpnDetailId');
  const result = await pool.query(
    `SELECT d.lpn_detail_id, d.lpn_id, d.sku_id, d.quantity,
            s.sku_code, s.product_name, s.color, s.size
     FROM lpn_details d
     INNER JOIN skus s ON s.sku_id = d.sku_id
     WHERE d.lpn_detail_id = $1`,
    [id]
  );
  if (result.rows.length === 0) {
    throw new AppError('LPN detail not found', 404, 'NOT_FOUND');
  }
  return mapDetailRow(result.rows[0]);
}

export async function listLpnDetails(lpnId, { page, limit, offset }) {
  const lpnUuid = parseUuid(lpnId, 'lpnId');
  await getLpn(lpnUuid);

  const [rowsResult, countResult] = await Promise.all([
    pool.query(
      `SELECT d.lpn_detail_id, d.lpn_id, d.sku_id, d.quantity,
              s.sku_code, s.product_name, s.color, s.size
       FROM lpn_details d
       INNER JOIN skus s ON s.sku_id = d.sku_id
       WHERE d.lpn_id = $1
       ORDER BY s.sku_code ASC
       LIMIT $2 OFFSET $3`,
      [lpnUuid, limit, offset]
    ),
    pool.query(
      `SELECT COUNT(*)::int AS count FROM lpn_details WHERE lpn_id = $1`,
      [lpnUuid]
    ),
  ]);

  const total = countResult.rows[0].count;

  return {
    items: rowsResult.rows.map(mapDetailRow),
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 0,
    },
  };
}

export async function getLpnWithDetails(lpnId) {
  const lpn = await getLpn(lpnId);
  const { items } = await listLpnDetails(lpn.lpnId, {
    page: 1,
    limit: 500,
    offset: 0,
  });

  const refreshed = await getLpn(lpn.lpnId);
  return {
    ...refreshed,
    details: items,
  };
}

export async function createLpnDetail(body) {
  const data = normalizeCreatePayload(body);

  const lpn = await getLpn(data.lpnId);
  const sku = await getSku(data.skuId);
  await assertLpnSkuSameTenant(lpn, sku);

  const duplicate = await findDetailByLpnAndSku(data.lpnId, data.skuId);
  if (duplicate) {
    throw new AppError(
      'This SKU is already in the LPN; update quantity instead',
      409,
      'DUPLICATE'
    );
  }

  const created = await LpnDetail.create(data);
  await syncLpnActualQuantity(data.lpnId);
  return getLpnDetailWithSku(created.lpnDetailId);
}

export async function updateLpnDetail(lpnDetailId, body) {
  const id = parseUuid(lpnDetailId, 'lpnDetailId');
  const existing = await getLpnDetail(id);

  const data = normalizeUpdatePayload(body);
  await LpnDetail.updateById(id, data);
  await syncLpnActualQuantity(existing.lpnId);
  return getLpnDetailWithSku(id);
}

export async function deleteLpnDetail(lpnDetailId) {
  const id = parseUuid(lpnDetailId, 'lpnDetailId');
  const existing = await getLpnDetail(id);

  const deleted = await LpnDetail.deleteById(id);
  if (!deleted) {
    throw new AppError('LPN detail not found', 404, 'NOT_FOUND');
  }

  await syncLpnActualQuantity(existing.lpnId);

  const sku = await getSku(existing.skuId);
  return {
    lpnDetailId: deleted.lpnDetailId,
    lpnId: deleted.lpnId,
    skuId: deleted.skuId,
    quantity: deleted.quantity,
    sku: {
      skuId: sku.skuId,
      skuCode: sku.skuCode,
      productName: sku.productName,
      color: sku.color,
      size: sku.size,
    },
  };
}
