import Batch from '../models/Batch.js';
import InboundRequest from '../models/InboundRequest.js';
import AppError from '../utils/AppError.js';
import { parseUuid } from '../utils/validate.js';

export async function getBatch(batchId) {
  const id = parseUuid(batchId, 'batchId');
  const batch = await Batch.findById(id);
  if (!batch) {
    throw new AppError('Batch not found', 404, 'NOT_FOUND');
  }
  return batch;
}

/** Batch + tenantId from parent inbound request. */
export async function getBatchContext(batchId) {
  const batch = await getBatch(batchId);
  const inbound = await InboundRequest.findById(batch.inboundRequestId);
  if (!inbound) {
    throw new AppError('Inbound request not found for batch', 404, 'NOT_FOUND');
  }
  return { batch, tenantId: inbound.tenantId };
}
