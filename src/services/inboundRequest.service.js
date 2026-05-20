import InboundRequest from '../models/InboundRequest.js';
import AppError from '../utils/AppError.js';
import { parseUuid } from '../utils/validate.js';

export async function getInboundRequest(inboundRequestId) {
  const id = parseUuid(inboundRequestId, 'inboundRequestId');
  const inbound = await InboundRequest.findById(id);
  if (!inbound) {
    throw new AppError('Inbound request not found', 404, 'NOT_FOUND');
  }
  return inbound;
}
