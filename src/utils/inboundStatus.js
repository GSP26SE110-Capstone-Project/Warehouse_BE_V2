import AppError from './AppError.js';
import { INBOUND_STATUS_TRANSITIONS } from '../constants/inboundWorkflow.js';

export function assertInboundStatusTransition(currentStatus, nextStatus) {
  if (currentStatus === nextStatus) return;

  const allowed = INBOUND_STATUS_TRANSITIONS[currentStatus];
  if (!allowed?.includes(nextStatus)) {
    throw new AppError(
      `Cannot change inbound status from ${currentStatus} to ${nextStatus}`,
      400,
      'INVALID_STATUS_TRANSITION'
    );
  }
}

export function assertInboundInReceivingPhase(inbound, actionLabel = 'this action') {
  const allowed = ['ARRIVED', 'RECEIVING'];
  if (!allowed.includes(inbound.status)) {
    throw new AppError(
      `Inbound request must be ARRIVED or RECEIVING for ${actionLabel} (current: ${inbound.status})`,
      400,
      'INVALID_INBOUND_STATUS'
    );
  }
}
