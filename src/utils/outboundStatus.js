import AppError from './AppError.js';
import { OUTBOUND_STATUS_TRANSITIONS } from '../constants/outboundWorkflow.js';

export function assertOutboundStatusTransition(currentStatus, nextStatus) {
  if (currentStatus === nextStatus) return;

  const allowed = OUTBOUND_STATUS_TRANSITIONS[currentStatus];
  if (!allowed?.includes(nextStatus)) {
    throw new AppError(
      `Cannot change outbound status from ${currentStatus} to ${nextStatus}`,
      400,
      'INVALID_STATUS_TRANSITION'
    );
  }
}
