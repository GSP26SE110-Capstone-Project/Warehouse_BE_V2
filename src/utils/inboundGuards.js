import { getInboundRequest } from '../services/inboundRequest.service.js';
import { assertInboundInReceivingPhase } from './inboundStatus.js';

export async function assertInboundAllowsReceivingOps(inboundRequestId) {
  const inbound = await getInboundRequest(inboundRequestId);
  assertInboundInReceivingPhase(inbound, 'receiving operations');
  return inbound;
}
