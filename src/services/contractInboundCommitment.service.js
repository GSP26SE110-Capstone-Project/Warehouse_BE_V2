import pool from "../config/db.js";
import AppError from "../utils/AppError.js";
import { parseUuid } from "../utils/validate.js";
import { getContract } from "./contract.service.js";

/**
 * Cam kết số cái từ rental request (SUM product_lines.quantity).
 * HĐ không có rental_request_id hoặc rental không có product lines → không áp dụng gate.
 */
export async function getContractCommittedPieceQuantity(contractId) {
  const id = parseUuid(contractId, "contractId");
  const contract = await getContract(id);
  if (!contract.rentalRequestId) return null;

  const result = await pool.query(
    `SELECT COUNT(*)::int AS line_count,
            COALESCE(SUM(quantity), 0)::int AS committed_pieces
     FROM rental_request_product_lines
     WHERE rental_request_id = $1`,
    [contract.rentalRequestId],
  );

  const row = result.rows[0];
  if (!row || Number(row.line_count) === 0) return null;
  return Number(row.committed_pieces);
}

/**
 * Tồn kho thực tế (cái) của tenant tại kho HĐ — sau outbound giảm, cho phép nhập lại.
 */
export async function sumCurrentInventoryPiecesForContract(contractId) {
  const id = parseUuid(contractId, "contractId");
  const contract = await getContract(id);

  const result = await pool.query(
    `SELECT COALESCE(SUM(i.quantity), 0)::int AS total
     FROM inventories i
     INNER JOIN bins b ON b.bin_id = i.bin_id
     INNER JOIN rack_levels rl ON rl.rack_level_id = b.rack_level_id
     INNER JOIN racks r ON r.rack_id = rl.rack_id
     INNER JOIN warehouse_zones z ON z.zone_id = r.zone_id
     WHERE i.tenant_id = $1
       AND z.warehouse_id = $2
       AND i.quantity > 0`,
    [contract.tenantId, contract.warehouseId],
  );

  return Number(result.rows[0]?.total ?? 0);
}

/**
 * Số cái còn "trên đường" (chưa vào tồn): expected − received trên phiếu chưa COMPLETED/CANCELLED.
 * Tránh double-count với sumCurrentInventoryPiecesForContract khi phiếu đang RECEIVING đã putaway.
 */
export async function sumInFlightInboundPiecesOnContract(
  contractId,
  { excludeInboundRequestItemId = null } = {},
) {
  const id = parseUuid(contractId, "contractId");
  const params = [id];
  let excludeClause = "";
  if (excludeInboundRequestItemId) {
    params.push(
      parseUuid(excludeInboundRequestItemId, "excludeInboundRequestItemId"),
    );
    excludeClause = ` AND iri.inbound_request_item_id <> $${params.length}`;
  }

  const result = await pool.query(
    `SELECT COALESCE(SUM(
       GREATEST(0, iri.expected_quantity - COALESCE(iri.received_quantity, 0))
     ), 0)::int AS total
     FROM inbound_request_items iri
     INNER JOIN inbound_requests ir ON ir.inbound_request_id = iri.inbound_request_id
     WHERE ir.contract_id = $1
       AND ir.status NOT IN ('COMPLETED', 'CANCELLED')
       ${excludeClause}`,
    params,
  );

  return Number(result.rows[0]?.total ?? 0);
}

/** @deprecated Dùng on-hand + in-flight; giữ để tham chiếu / báo cáo. */
export async function sumDeclaredInboundPiecesOnContract(
  contractId,
  { excludeInboundRequestItemId = null } = {},
) {
  const id = parseUuid(contractId, "contractId");
  const params = [id];
  let excludeClause = "";
  if (excludeInboundRequestItemId) {
    params.push(
      parseUuid(excludeInboundRequestItemId, "excludeInboundRequestItemId"),
    );
    excludeClause = ` AND iri.inbound_request_item_id <> $${params.length}`;
  }

  const result = await pool.query(
    `SELECT COALESCE(SUM(iri.expected_quantity), 0)::int AS total
     FROM inbound_request_items iri
     INNER JOIN inbound_requests ir ON ir.inbound_request_id = iri.inbound_request_id
     WHERE ir.contract_id = $1
       AND ir.status <> 'CANCELLED'
       ${excludeClause}`,
    params,
  );

  return Number(result.rows[0]?.total ?? 0);
}

/**
 * Cam kết = max tồn đồng thời tại kho, không phải tổng lịch sử nhập.
 * Cho phép nhập lại sau outbound khi tồn + phiếu đang mở + lượng mới ≤ cam kết.
 *
 * @param {string} contractId
 * @param {{ additionalPieces?: number, excludeInboundRequestItemId?: string }} [opts]
 */
export async function assertContractInboundWithinCommittedPieces(
  contractId,
  { additionalPieces = 0, excludeInboundRequestItemId = null } = {},
) {
  const committed = await getContractCommittedPieceQuantity(contractId);
  if (committed == null) return;

  const [onHand, inFlight] = await Promise.all([
    sumCurrentInventoryPiecesForContract(contractId),
    sumInFlightInboundPiecesOnContract(contractId, {
      excludeInboundRequestItemId,
    }),
  ]);

  const additional = Number(additionalPieces);
  const proposedTotal = onHand + inFlight + additional;

  if (proposedTotal > committed) {
    const remaining = Math.max(0, committed - onHand - inFlight);
    throw new AppError(
      `Vượt cam kết hợp đồng (${committed} cái). Tồn kho hiện tại: ${onHand} cái; ` +
        `còn được thêm tối đa ${remaining} cái. ` +
        `(Sau khi xuất kho thành công, tồn giảm — có thể tạo phiếu nhập mới trong hạn mức này.)`,
      400,
      "COMMITTED_QUANTITY_EXCEEDED",
      {
        committedPieces: committed,
        onHandPieces: onHand,
        inFlightInboundPieces: inFlight,
        proposedTotalPieces: proposedTotal,
        remainingPieces: remaining,
      },
    );
  }
}
