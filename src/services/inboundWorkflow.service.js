import pool from '../config/db.js';
import InboundRequest from '../models/InboundRequest.js';
import Batch from '../models/Batch.js';
import Lpn from '../models/Lpn.js';
import AiSlotRecommendation from '../models/AiSlotRecommendation.js';
import AppError from '../utils/AppError.js';
import { parseUuid } from '../utils/validate.js';
import { assertInboundStatusTransition } from '../utils/inboundStatus.js';
import { assertInboundAllowsReceivingOps } from '../utils/inboundGuards.js';
import { getInboundRequest } from './inboundRequest.service.js';
import { listInboundRequestItems } from './inboundRequestItem.service.js';
import { receiveInboundItems } from './inboundRequestItem.service.js';
import { getLpnWithDetails } from './lpnDetail.service.js';
import { getBatchContext } from './batch.service.js';
import { getBin } from './bin.service.js';
import {
  applyBinPutaway,
  assertNoInventoryForLpn,
  createPutawayInventoryRecords,
} from './inventory.service.js';

function parseOptionalUserId(value, fieldName) {
  if (value == null || value === '') return undefined;
  return parseUuid(value, fieldName);
}

export async function startReceiving(inboundRequestId, body = {}) {
  const id = parseUuid(inboundRequestId, 'inboundRequestId');
  const inbound = await getInboundRequest(id);

  assertInboundStatusTransition(inbound.status, 'RECEIVING');

  const data = { status: 'RECEIVING' };
  if (body.receivedBy != null && body.receivedBy !== '') {
    data.receivedBy = parseOptionalUserId(body.receivedBy, 'receivedBy');
  }

  return InboundRequest.updateById(id, data);
}

export async function completeReceiving(inboundRequestId, body = {}) {
  const id = parseUuid(inboundRequestId, 'inboundRequestId');
  const inbound = await getInboundRequest(id);

  if (inbound.status !== 'RECEIVING') {
    throw new AppError(
      'Inbound must be in RECEIVING status to complete receiving',
      400,
      'INVALID_INBOUND_STATUS'
    );
  }

  let items = [];
  if (body.items?.length) {
    items = await receiveInboundItems(id, body.items);
  } else {
    const listed = await listInboundRequestItems(id, { page: 1, limit: 500, offset: 0 });
    const missing = listed.items.filter(
      (row) => (row.receivedQuantity ?? 0) === 0 && row.expectedQuantity > 0
    );
    if (missing.length > 0) {
      throw new AppError(
        'All line items must have receivedQuantity before completing receiving (send items in body or PATCH each item)',
        400,
        'RECEIVING_INCOMPLETE'
      );
    }
    items = listed.items;
  }

  return {
    inboundRequestId: id,
    status: inbound.status,
    items,
    message: 'Receiving quantities recorded',
  };
}

export async function completeInbound(inboundRequestId, body = {}) {
  const id = parseUuid(inboundRequestId, 'inboundRequestId');
  const inbound = await getInboundRequest(id);

  assertInboundStatusTransition(inbound.status, 'COMPLETED');

  const batches = await Batch.findAll({ inboundRequestId: id });
  if (batches.length === 0) {
    throw new AppError(
      'Cannot complete inbound without at least one batch',
      400,
      'VALIDATION_ERROR'
    );
  }

  const batchIds = batches.map((b) => b.batchId);
  let allLpns = [];
  for (const batchId of batchIds) {
    const batchLpns = await Lpn.findAll({ batchId });
    allLpns = allLpns.concat(batchLpns);
  }

  if (allLpns.length === 0) {
    throw new AppError(
      'Cannot complete inbound without at least one LPN',
      400,
      'VALIDATION_ERROR'
    );
  }

  const notStored = allLpns.filter((lpn) => lpn.status !== 'STORED');
  if (notStored.length > 0) {
    throw new AppError(
      `All LPNs must be STORED before completing inbound (${notStored.length} pending putaway)`,
      400,
      'LPN_PUTAWAY_INCOMPLETE'
    );
  }

  const data = { status: 'COMPLETED' };
  if (body.receivedBy != null && body.receivedBy !== '') {
    data.receivedBy = parseOptionalUserId(body.receivedBy, 'receivedBy');
  }

  return InboundRequest.updateById(id, data);
}

export async function putawayLpn(lpnId, body) {
  const lpnUuid = parseUuid(lpnId, 'lpnId');
  const binId = parseUuid(body.binId, 'binId');

  if (!body.binId) {
    throw new AppError('binId is required', 400, 'VALIDATION_ERROR');
  }

  const lpn = await getLpnWithDetails(lpnUuid);

  if (lpn.status !== 'RECEIVING') {
    throw new AppError(
      `LPN must be in RECEIVING status for putaway (current: ${lpn.status})`,
      400,
      'INVALID_LPN_STATUS'
    );
  }

  if (lpn.currentBinId) {
    throw new AppError('LPN is already assigned to a bin', 400, 'LPN_ALREADY_PUTAWAY');
  }

  if (!lpn.details?.length) {
    throw new AppError('LPN has no SKU details; add lpn-details before putaway', 400, 'VALIDATION_ERROR');
  }

  const { batch, tenantId } = await getBatchContext(lpn.batchId);
  const inbound = await assertInboundAllowsReceivingOps(batch.inboundRequestId);

  if (tenantId !== lpn.tenantId) {
    throw new AppError('LPN tenant does not match inbound tenant', 400, 'VALIDATION_ERROR');
  }

  const bin = await getBin(binId);

  if (body.recommendationId) {
    const recId = parseUuid(body.recommendationId, 'recommendationId');
    const rec = await AiSlotRecommendation.findById(recId);
    if (!rec) {
      throw new AppError('AI slot recommendation not found', 404, 'NOT_FOUND');
    }
    if (rec.lpnId && rec.lpnId !== lpn.lpnId) {
      throw new AppError('recommendationId does not match this LPN', 400, 'VALIDATION_ERROR');
    }
    if (rec.recommendedBinId && rec.recommendedBinId !== binId) {
      throw new AppError(
        'binId does not match recommended bin on this recommendation',
        400,
        'VALIDATION_ERROR'
      );
    }
  }

  const movedBy =
    body.movedBy != null && body.movedBy !== ''
      ? parseOptionalUserId(body.movedBy, 'movedBy')
      : undefined;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await assertNoInventoryForLpn(lpn.lpnId, client);

    await createPutawayInventoryRecords(
      {
        tenantId,
        batchId: lpn.batchId,
        lpnId: lpn.lpnId,
        binId,
        receivedAt: batch.warehouseReceivedAt,
        details: lpn.details,
        movedBy,
        lpnCode: lpn.lpnCode,
      },
      client
    );

    await Lpn.updateById(
      lpn.lpnId,
      { currentBinId: binId, status: 'STORED' },
      client
    );

    await applyBinPutaway(bin, lpn.volumeUnits, client);

    if (body.recommendationId) {
      const recId = parseUuid(body.recommendationId, 'recommendationId');
      await AiSlotRecommendation.updateById(recId, { isApplied: true }, client);
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  return {
    lpn: await getLpnWithDetails(lpn.lpnId),
    inboundRequestId: inbound.inboundRequestId,
    inboundStatus: inbound.status,
  };
}
