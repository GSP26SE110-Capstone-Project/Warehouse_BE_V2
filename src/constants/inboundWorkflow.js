import { INBOUND_STATUS } from './inbound.js';

/** Allowed status transitions for inbound requests. */
export const INBOUND_STATUS_TRANSITIONS = Object.freeze({
  DRAFT: ['PENDING', 'CANCELLED'],
  PENDING: ['APPROVED', 'CANCELLED'],
  APPROVED: ['ARRIVED', 'CANCELLED', 'PENDING'],
  ARRIVED: ['RECEIVING', 'CANCELLED'],
  RECEIVING: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
});

/** Statuses that allow batch / LPN creation and receiving updates. */
export const INBOUND_RECEIVING_PHASE_STATUSES = Object.freeze(['ARRIVED', 'RECEIVING']);

export { INBOUND_STATUS };
