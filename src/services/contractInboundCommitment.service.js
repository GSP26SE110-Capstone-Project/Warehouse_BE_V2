import pool from '../config/db.js';
import AppError from '../utils/AppError.js';
import { parseUuid } from '../utils/validate.js';
import { getContract } from './contract.service.js';

/**
 * Cam kết số cái từ rental request (SUM product_lines.quantity).
 * HĐ không có rental_request_id hoặc rental không có product lines → không áp dụng gate.
 */
export async function getContractCommittedPieceQuantity(contractId) {
  const id = parseUuid(contractId, 'contractId');
  const contract = await getContract(id);
  if (!contract.rentalRequestId) return null;

  const result = await pool.query(
    `SELECT COUNT(*)::int AS line_count,
            COALESCE(SUM(quantity), 0)::int AS committed_pieces
     FROM rental_request_product_lines
     WHERE rental_request_id = $1`,
    [contract.rentalRequestId]
  );

  const row = result.rows[0];
  if (!row || Number(row.line_count) === 0) return null;
  return Number(row.committed_pieces);
}

/**
 * Tổng expected_quantity trên mọi phiếu nhập của HĐ (trừ CANCELLED).
 */
export async function sumDeclaredInboundPiecesOnContract(
  contractId,
  { excludeInboundRequestItemId = null } = {}
) {
  const id = parseUuid(contractId, 'contractId');
  const params = [id];
  let excludeClause = '';
  if (excludeInboundRequestItemId) {
    params.push(parseUuid(excludeInboundRequestItemId, 'excludeInboundRequestItemId'));
    excludeClause = ` AND iri.inbound_request_item_id <> $${params.length}`;
  }

  const result = await pool.query(
    `SELECT COALESCE(SUM(iri.expected_quantity), 0)::int AS total
     FROM inbound_request_items iri
     INNER JOIN inbound_requests ir ON ir.inbound_request_id = iri.inbound_request_id
     WHERE ir.contract_id = $1
       AND ir.status <> 'CANCELLED'
       ${excludeClause}`,
    params
  );

  return Number(result.rows[0]?.total ?? 0);
}

/**
 * @param {string} contractId
 * @param {{ additionalPieces?: number, excludeInboundRequestItemId?: string }} [opts]
 */
export async function assertContractInboundWithinCommittedPieces(
  contractId,
  { additionalPieces = 0, excludeInboundRequestItemId = null } = {}
) {
  const committed = await getContractCommittedPieceQuantity(contractId);
  if (committed == null) return;

  const declared = await sumDeclaredInboundPiecesOnContract(contractId, {
    excludeInboundRequestItemId,
  });
  const proposedTotal = declared + Number(additionalPieces);

  if (proposedTotal > committed) {
    const remaining = Math.max(0, committed - declared);
    throw new AppError(
      `Tổng số lượng khai báo nhập kho (${proposedTotal} cái) vượt cam kết hợp đồng (${committed} cái từ product lines rental request). Đã khai báo trên các phiếu nhập: ${declared} cái; còn được thêm tối đa ${remaining} cái. Vui lòng tạo rental request và hợp đồng mới để nhập thêm hàng.`,
      400,
      'COMMITTED_QUANTITY_EXCEEDED',
      {
        committedPieces: committed,
        declaredPieces: declared,
        proposedTotalPieces: proposedTotal,
        remainingPieces: remaining,
      }
    );
  }
}
