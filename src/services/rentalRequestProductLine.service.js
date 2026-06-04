import pool from '../config/db.js';
import RentalRequest from '../models/RentalRequest.js';
import RentalRequestProductLine from '../models/RentalRequestProductLine.js';
import { fromDbRecord } from '../models/utils/fieldMapper.js';
import { rentalRequestProductLineSchema } from '../models/RentalRequestProductLine.js';
import AppError from '../utils/AppError.js';
import {
  allocateBoxes,
  allocationToArray,
  assertValidBoxTypeHint,
  roundVolumeUnits,
  totalBoxCount,
} from '../utils/volumeUnitsAllocation.js';
import { getProductKind } from './productKindCatalog.service.js';
import { resolveSizeGroup, getSizeFactorValue } from './sizeFactorCatalog.service.js';

function mapLineRow(row) {
  return row ? fromDbRecord(rentalRequestProductLineSchema, row) : null;
}

function parsePositiveInt(value, fieldName) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) {
    throw new AppError(`${fieldName} must be a positive integer`, 400, 'VALIDATION_ERROR');
  }
  return n;
}

function normalizeSizeValue(size) {
  if (size == null || String(size).trim() === '') return null;
  return String(size).trim().toUpperCase();
}

export async function listProductLinesForRentalRequest(rentalRequestId, client) {
  const rows = await RentalRequestProductLine.findAll(
    { rentalRequestId },
    { orderBy: 'sort_order ASC, created_at ASC' },
    client
  );
  return rows;
}

export async function listProductLinesByRentalRequestIds(rentalRequestIds, client) {
  if (!rentalRequestIds.length) return new Map();

  const db = client || pool;
  const rows = await db.query(
    `SELECT * FROM rental_request_product_lines
     WHERE rental_request_id = ANY($1::uuid[])
     ORDER BY rental_request_id, sort_order ASC, created_at ASC`,
    [rentalRequestIds]
  );

  const grouped = new Map();
  for (const row of rows.rows) {
    const line = mapLineRow(row);
    const key = line.rentalRequestId;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(line);
  }
  return grouped;
}

async function buildComputedLine(rawLine, index) {
  const fieldPrefix = `productLines[${index}]`;
  const productKindCode = String(rawLine?.productKind ?? '').trim().toUpperCase();
  if (!productKindCode) {
    throw new AppError(`${fieldPrefix}.productKind is required`, 400, 'VALIDATION_ERROR');
  }

  const quantity = parsePositiveInt(rawLine.quantity, `${fieldPrefix}.quantity`);
  // quantity = số cái cam kết trung bình mỗi tháng (peak inventory), không nhân số tháng HĐ.
  const catalogKind = await getProductKind(productKindCode);

  if (catalogKind.status && catalogKind.status !== 'ACTIVE') {
    throw new AppError(`${fieldPrefix}.productKind is inactive`, 400, 'VALIDATION_ERROR');
  }

  const sizeGroup = await resolveSizeGroup({
    size: rawLine.size,
    sizeGroup: rawLine.sizeGroup,
    hasSize: catalogKind.hasSize !== false,
    fieldPrefix,
  });

  const sizeFactor = await getSizeFactorValue(sizeGroup);
  const baseU = roundVolumeUnits(Number(catalogKind.baseVolumeUnitsPerPiece));
  const finalU = roundVolumeUnits(baseU * sizeFactor);
  const lineU = roundVolumeUnits(finalU * quantity);

  return {
    productKind: productKindCode,
    size: catalogKind.hasSize === false ? null : normalizeSizeValue(rawLine.size),
    sizeGroup,
    quantity,
    baseVolumeUnitsPerPiece: baseU,
    sizeFactor,
    finalVolumeUnitsPerPiece: finalU,
    lineVolumeUnits: lineU,
    sortOrder: rawLine.sortOrder != null ? Number(rawLine.sortOrder) : index,
  };
}

export async function validateAndComputeProductLines(rawLines) {
  if (!Array.isArray(rawLines) || rawLines.length === 0) {
    throw new AppError('productLines must be a non-empty array', 400, 'VALIDATION_ERROR');
  }

  const lines = [];
  for (let i = 0; i < rawLines.length; i += 1) {
    lines.push(await buildComputedLine(rawLines[i], i));
  }

  const totalCommittedVolumeUnits = roundVolumeUnits(
    lines.reduce((sum, line) => sum + line.lineVolumeUnits, 0)
  );

  if (totalCommittedVolumeUnits <= 0) {
    throw new AppError(
      'productLines must result in totalCommittedVolumeUnits > 0',
      400,
      'VALIDATION_ERROR'
    );
  }

  const allocation = allocateBoxes(totalCommittedVolumeUnits);
  const boxAllocation = allocationToArray(allocation);

  return {
    lines,
    totalCommittedVolumeUnits,
    boxAllocation,
    boxAllocationJson: boxAllocation,
    estimatedBoxCount: totalBoxCount(allocation),
    estimatedSkuCount: lines.reduce((sum, line) => sum + line.quantity, 0),
  };
}

export async function replaceProductLinesForRentalRequest(
  rentalRequestId,
  rawLines,
  { selectedBoxTypeHint } = {},
  client
) {
  const computed = await validateAndComputeProductLines(rawLines);
  const hint = assertValidBoxTypeHint(selectedBoxTypeHint);

  await RentalRequestProductLine.query(
    `DELETE FROM rental_request_product_lines WHERE rental_request_id = $1`,
    [rentalRequestId],
    client
  );

  for (const line of computed.lines) {
    await RentalRequestProductLine.create(
      {
        rentalRequestId,
        ...line,
      },
      client
    );
  }

  await RentalRequest.updateById(
    rentalRequestId,
    {
      totalCommittedVolumeUnits: computed.totalCommittedVolumeUnits,
      boxAllocationJson: JSON.stringify(computed.boxAllocationJson),
      estimatedBoxCount: computed.estimatedBoxCount,
      estimatedSkuCount: computed.estimatedSkuCount,
      selectedBoxTypeHint: hint ?? null,
    },
    client
  );

  return computed;
}

export async function attachProductLinesToRentalRequest(item, client) {
  if (!item?.rentalRequestId) return item;

  const productLines = await listProductLinesForRentalRequest(item.rentalRequestId, client);
  let boxAllocation = [];
  if (Array.isArray(item.boxAllocationJson)) {
    boxAllocation = item.boxAllocationJson;
  } else if (typeof item.boxAllocationJson === 'string') {
    try {
      const parsed = JSON.parse(item.boxAllocationJson);
      boxAllocation = Array.isArray(parsed) ? parsed : [];
    } catch {
      boxAllocation = [];
    }
  }

  return {
    ...item,
    productLines,
    boxAllocation,
  };
}

export async function enrichRentalRequestsWithProductLines(items, client) {
  if (!items.length) return items;

  const ids = items.map((item) => item.rentalRequestId);
  const grouped = await listProductLinesByRentalRequestIds(ids, client);

  return items.map((item) => ({
    ...item,
    productLines: grouped.get(item.rentalRequestId) ?? [],
    boxAllocation: (() => {
      if (Array.isArray(item.boxAllocationJson)) return item.boxAllocationJson;
      if (typeof item.boxAllocationJson === 'string') {
        try {
          const parsed = JSON.parse(item.boxAllocationJson);
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      }
      return [];
    })(),
  }));
}
