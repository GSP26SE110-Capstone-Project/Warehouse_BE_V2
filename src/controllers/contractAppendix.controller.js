import * as contractAppendixService from '../services/contractAppendix.service.js';
import * as contractAppendixInvoiceService from '../services/contractAppendixInvoice.service.js';
import { resolveContractStorageCeiling } from '../services/contractAppendix.service.js';
import { getContract } from '../services/contract.service.js';
import { assertContractScopeAccess } from '../utils/warehouseAccess.js';
import { appendixPaymentBreakdown } from '../utils/contractAppendixBilling.js';
import { created, paginated, success } from '../utils/apiResponse.js';
import { parsePagination, parseUuid } from '../utils/validate.js';

export async function list(req, res) {
  const { page, limit, offset } = parsePagination(req.query);
  const result = await contractAppendixService.listContractAppendices(
    req.params.contractId,
    { status: req.query.status, page, limit, offset },
    req.user
  );
  paginated(res, result.items, result.meta);
}

export async function getCeiling(req, res) {
  const contract = await getContract(req.params.contractId);
  assertContractScopeAccess(req.user, contract);
  const ceilingLevel = await resolveContractStorageCeiling(contract);
  success(res, { contractId: contract.contractId, ceilingLevel });
}

export async function getById(req, res) {
  const appendix = await contractAppendixService.getContractAppendix(
    req.params.contractId,
    req.params.appendixId,
    req.user
  );
  success(res, appendix);
}

/** Tenant: gửi yêu cầu thuê thêm. */
export async function create(req, res) {
  parseUuid(req.params.contractId, 'contractId');
  const appendix = await contractAppendixService.submitAppendixRequest(
    req.params.contractId,
    req.body,
    req.user
  );
  created(res, appendix, 'Appendix request submitted');
}

/** Tenant ký phụ lục (PENDING_APPROVAL → PENDING_PAYMENT). */
export async function sign(req, res) {
  const appendix = await contractAppendixService.signAppendixAsTenant(
    req.params.contractId,
    req.params.appendixId,
    req.body,
    req.user
  );
  success(res, appendix, 'Signed successfully');
}

export async function markUnderReview(req, res) {
  const appendix = await contractAppendixService.markAppendixUnderReview(
    req.params.contractId,
    req.params.appendixId,
    req.user
  );
  success(res, appendix, 'Marked under review');
}

export async function approve(req, res) {
  const appendix = await contractAppendixService.approveAppendixRequest(
    req.params.contractId,
    req.params.appendixId,
    req.body,
    req.user
  );
  success(res, appendix, 'Appendix approved');
}

export async function reject(req, res) {
  const appendix = await contractAppendixService.rejectAppendixRequest(
    req.params.contractId,
    req.params.appendixId,
    req.body,
    req.user
  );
  success(res, appendix, 'Appendix rejected');
}

export async function remove(req, res) {
  const appendix = await contractAppendixService.deleteContractAppendix(
    req.params.contractId,
    req.params.appendixId,
    req.user
  );
  success(res, appendix, 'Deleted successfully');
}

export async function terminate(req, res) {
  const appendix = await contractAppendixService.terminateContractAppendix(
    req.params.contractId,
    req.params.appendixId,
    req.body,
    req.user
  );
  success(res, appendix, 'Appendix terminated');
}

export async function previewPayment(req, res) {
  const contract = await getContract(req.params.contractId);
  const appendix = await contractAppendixService.getContractAppendix(
    req.params.contractId,
    req.params.appendixId,
    req.user
  );
  const breakdown = appendixPaymentBreakdown(appendix);
  success(res, {
    appendixId: appendix.appendixId,
    monthlyRate: breakdown.monthlyRate,
    billableMonths: breakdown.billableMonths,
    initialInvoiceAmount: breakdown.amount,
    effectiveDate: appendix.effectiveDate,
    endDate: appendix.endDate,
  });
}

export async function listInvoices(req, res) {
  const appendix = await contractAppendixService.getContractAppendix(
    req.params.contractId,
    req.params.appendixId,
    req.user
  );
  const invoice = await contractAppendixInvoiceService.findAppendixInitialInvoice(
    appendix.appendixId
  );
  success(res, invoice ? [invoice] : []);
}
