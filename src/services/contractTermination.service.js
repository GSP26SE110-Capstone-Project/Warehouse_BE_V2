import pool from '../config/db.js';
import ContractTerminationRequest from '../models/ContractTerminationRequest.js';
import Contract from '../models/Contract.js';
import AppError from '../utils/AppError.js';
import { assertEnum, parseUuid } from '../utils/validate.js';
import {
  TERMINATION_REQUEST_STATUS,
  YEARLY_EARLY_REFUND_PROCESSING_RATE,
} from '../constants/tenantOnboarding.js';
import {
  contractMonthCount,
  deriveMonthlyRent,
  usedContractMonths,
} from '../utils/contractBilling.js';
import { getContract } from './contract.service.js';

async function contractHasInbound(contractId) {
  const { rows } = await pool.query(
    `SELECT EXISTS (
       SELECT 1 FROM inbound_requests
       WHERE contract_id = $1
         AND status IS DISTINCT FROM 'CANCELLED'
     ) AS has_inbound`,
    [contractId]
  );
  return Boolean(rows[0]?.hasInbound ?? rows[0]?.has_inbound);
}

async function sumPaidInvoiceTotal(contractId) {
  const { rows } = await pool.query(
    `SELECT COALESCE(SUM(total_amount), 0)::numeric AS total
     FROM invoices
     WHERE contract_id = $1 AND payment_status = 'PAID'`,
    [contractId]
  );
  const n = Number(rows[0]?.total ?? 0);
  if (n > 0) return Math.round(n);
  return 0;
}

export function computeTerminationSettlement(contract, { hasInbound, totalPaid }) {
  const billingCycle = contract.billingCycle ?? 'MONTHLY';
  const contractMonths = contractMonthCount(contract.startDate, contract.endDate);
  const monthlyRate = deriveMonthlyRent(contract);
  const paid =
    totalPaid > 0 ? totalPaid : Math.round(Number(contract.estimatedTotalAmount) || 0);
  const usedMonths = usedContractMonths(contract);
  const unusedMonths = Math.max(0, contractMonths - usedMonths);

  let processingFee = 0;
  let terminationFee = 0;
  let refundAmount = 0;

  if (billingCycle === 'MONTHLY') {
    terminationFee = 0;
    refundAmount = 0;
  } else if (billingCycle === 'YEARLY') {
    if (!hasInbound) {
      processingFee = Math.round(paid * YEARLY_EARLY_REFUND_PROCESSING_RATE);
      refundAmount = Math.max(0, paid - processingFee);
    } else {
      terminationFee = monthlyRate;
      refundAmount = Math.max(
        0,
        paid - unusedMonths * monthlyRate - terminationFee
      );
    }
  }

  return {
    billingCycle,
    hasInbound,
    totalPaid: paid,
    monthlyRate,
    contractMonths,
    usedMonths,
    unusedMonths,
    processingFee,
    terminationFee,
    refundAmount,
    processingRatePercent: billingCycle === 'YEARLY' && !hasInbound ? 1 : 0,
  };
}

export async function previewTermination(contractId) {
  const id = parseUuid(contractId, 'contractId');
  const contract = await getContract(id);

  if (!['ACTIVE', 'PENDING_PAYMENT'].includes(contract.status)) {
    throw new AppError(
      'Chỉ xem trước chấm dứt khi HĐ đang ACTIVE hoặc PENDING_PAYMENT',
      400,
      'VALIDATION_ERROR'
    );
  }

  const hasInbound = await contractHasInbound(id);
  const totalPaid = await sumPaidInvoiceTotal(id);
  const settlement = computeTerminationSettlement(contract, { hasInbound, totalPaid });

  return {
    contractId: id,
    contractStatus: contract.status,
    ...settlement,
  };
}

export async function requestTermination(contractId, body = {}) {
  const id = parseUuid(contractId, 'contractId');
  const contract = await getContract(id);

  if (contract.status !== 'ACTIVE') {
    throw new AppError(
      'Chỉ chấm dứt HĐ đang ACTIVE (đã thanh toán invoice đầu)',
      400,
      'VALIDATION_ERROR'
    );
  }

  const pending = await ContractTerminationRequest.findAll(
    { contractId: id, status: 'PENDING' },
    { limit: 1 }
  );
  if (pending.length > 0) {
    throw new AppError('Đã có yêu cầu chấm dứt đang chờ duyệt', 409, 'TERMINATION_PENDING');
  }

  const hasInbound = await contractHasInbound(id);
  const totalPaid = await sumPaidInvoiceTotal(id);
  const settlement = computeTerminationSettlement(contract, { hasInbound, totalPaid });

  const requestedBy =
    body.requestedBy != null ? parseUuid(body.requestedBy, 'requestedBy') : undefined;

  const row = await ContractTerminationRequest.create({
    contractId: id,
    tenantId: contract.tenantId,
    requestedBy,
    status: 'PENDING',
    billingCycle: settlement.billingCycle,
    hasInbound: settlement.hasInbound,
    totalPaid: settlement.totalPaid,
    monthlyRate: settlement.monthlyRate,
    contractMonths: settlement.contractMonths,
    usedMonths: settlement.usedMonths,
    unusedMonths: settlement.unusedMonths,
    processingFee: settlement.processingFee,
    terminationFee: settlement.terminationFee,
    refundAmount: settlement.refundAmount,
    reason: body.reason != null ? String(body.reason).trim() : null,
  });

  return { request: row, settlement };
}

export async function approveTermination(terminationRequestId, reviewedBy) {
  const id = parseUuid(terminationRequestId, 'terminationRequestId');
  const existing = await ContractTerminationRequest.findById(id);
  if (!existing) {
    throw new AppError('Termination request not found', 404, 'NOT_FOUND');
  }
  assertEnum(existing.status, TERMINATION_REQUEST_STATUS, 'status');
  if (existing.status !== 'PENDING') {
    throw new AppError('Yêu cầu không ở trạng thái PENDING', 400, 'VALIDATION_ERROR');
  }

  const reviewerId =
    reviewedBy != null ? parseUuid(reviewedBy, 'reviewedBy') : undefined;

  const updated = await ContractTerminationRequest.updateById(id, {
    status: 'APPROVED',
    reviewedBy: reviewerId,
    reviewedAt: new Date(),
  });

  await Contract.updateById(existing.contractId, { status: 'TERMINATED' });

  return updated;
}
