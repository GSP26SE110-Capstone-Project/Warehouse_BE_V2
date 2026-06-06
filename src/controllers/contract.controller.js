import * as contractService from '../services/contract.service.js';
import * as contractInboundCommitmentService from '../services/contractInboundCommitment.service.js';
import * as contractInvoiceService from '../services/contractInvoice.service.js';
import * as contractTerminationService from '../services/contractTermination.service.js';
import * as payosPaymentService from '../services/payosPayment.service.js';
import AppError from '../utils/AppError.js';
import { created, paginated, success } from '../utils/apiResponse.js';
import { parsePagination, parseUuid } from '../utils/validate.js';

export async function list(req, res) {
  const { page, limit, offset } = parsePagination(req.query);
  const { tenantId, warehouseId, rentalRequestId, status, contractType } = req.query;

  const result = await contractService.listContracts({
    tenantId,
    warehouseId,
    rentalRequestId,
    status,
    contractType,
    page,
    limit,
    offset,
  });

  paginated(res, result.items, result.meta);
}

export async function getById(req, res) {
  const contract = await contractService.getContract(req.params.contractId);
  success(res, contract);
}

export async function getInboundCommitment(req, res) {
  const commitment =
    await contractInboundCommitmentService.getContractInboundCommitmentDetails(
      req.params.contractId
    );
  success(res, commitment);
}

export async function closeInboundCommitmentLine(req, res) {
  const result = await contractInboundCommitmentService.closeInboundCommitmentLine(
    req.params.contractId,
    req.body,
    req.user
  );
  success(res, result, 'Đã đóng phần cam kết còn lại');
}

export async function create(req, res) {
  const { tenantId, warehouseId } = req.body;
  if (!tenantId) {
    throw new AppError('tenantId is required', 400, 'VALIDATION_ERROR');
  }
  if (!warehouseId) {
    throw new AppError('warehouseId is required', 400, 'VALIDATION_ERROR');
  }
  parseUuid(tenantId, 'tenantId');
  parseUuid(warehouseId, 'warehouseId');

  const contract = await contractService.createContract(tenantId, warehouseId, req.body);
  created(res, contract);
}

export async function update(req, res) {
  const contract = await contractService.updateContract(req.params.contractId, req.body);
  success(res, contract, 'Updated successfully');
}

export async function remove(req, res) {
  const contract = await contractService.deleteContract(req.params.contractId);
  success(res, contract, 'Deleted successfully');
}

export async function listInvoices(req, res) {
  const items = await contractInvoiceService.listContractInvoices(req.params.contractId);
  success(res, items);
}

export async function markInvoicePaid(req, res) {
  const result = await contractInvoiceService.markInvoicePaid(
    req.params.contractId,
    req.params.invoiceId
  );
  success(res, result, 'Invoice marked as paid');
}

/** Tạo link thanh toán PayOS cho invoice (tenant). */
export async function createPayOSPayment(req, res) {
  const link = await payosPaymentService.createInvoicePayOSPaymentLink(
    req.params.contractId,
    req.params.invoiceId,
    {
      returnUrl: req.body?.returnUrl,
      cancelUrl: req.body?.cancelUrl,
    }
  );
  success(res, link);
}

/** Sau khi PayOS redirect — hỏi PayOS và kích hoạt HĐ nếu đã PAID (webhook trễ / dev không ngrok). */
export async function syncPayOSPayment(req, res) {
  const result = await payosPaymentService.syncInvoicePaymentFromPayOS(
    req.params.contractId,
    req.params.invoiceId
  );
  success(res, result);
}

export async function previewTermination(req, res) {
  const preview = await contractTerminationService.previewTermination(req.params.contractId);
  success(res, preview);
}

export async function requestTermination(req, res) {
  const result = await contractTerminationService.requestTermination(
    req.params.contractId,
    req.body
  );
  created(res, result);
}

export async function listTerminationRequests(req, res) {
  const items = await contractTerminationService.listTerminationRequests(
    req.params.contractId,
    { status: req.query.status },
    req.user
  );
  success(res, items);
}

export async function approveTerminationRequest(req, res) {
  const result = await contractTerminationService.approveTerminationRequest(
    req.params.contractId,
    req.params.terminationRequestId,
    req.user?.userId,
    req.user
  );
  success(res, result, 'Termination approved');
}

export async function rejectTerminationRequest(req, res) {
  const result = await contractTerminationService.rejectTerminationRequest(
    req.params.contractId,
    req.params.terminationRequestId,
    req.user?.userId,
    req.user
  );
  success(res, result, 'Termination rejected');
}
