import pool from "../config/db.js";
import AppError from "../utils/AppError.js";
import { parseUuid } from "../utils/validate.js";
import { getContract } from "./contract.service.js";
import {
  buildCommitmentOverageWarnings,
  enrichCommitmentLineUsage,
} from "../constants/inboundCommitment.js";

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
            COALESCE(SUM(GREATEST(0, quantity - COALESCE(written_off_pieces, 0))), 0)::int AS committed_pieces
     FROM rental_request_product_lines
     WHERE rental_request_id = $1`,
    [contract.rentalRequestId],
  );

  const row = result.rows[0];
  if (!row || Number(row.line_count) === 0) return null;
  return Number(row.committed_pieces);
}

function normalizeCommitmentSize(size) {
  return String(size ?? "").trim().toUpperCase();
}

function makeCommitmentKey(productKind, size) {
  return `${String(productKind ?? "").trim()}|${normalizeCommitmentSize(size)}`;
}

function describeCommitmentLine(line) {
  const size = normalizeCommitmentSize(line.size);
  return `${line.productKind}${size ? ` size ${size}` : ""}`;
}

async function getContractCommittedProductLines(contractId) {
  const id = parseUuid(contractId, "contractId");
  const contract = await getContract(id);
  if (!contract.rentalRequestId) {
    return { contract, applies: false, lines: [] };
  }

  const result = await pool.query(
    `SELECT product_kind,
            COALESCE(size, '') AS size,
            COALESCE(size_group::text, '') AS size_group,
            COALESCE(SUM(quantity), 0)::int AS committed_pieces,
            COALESCE(SUM(written_off_pieces), 0)::int AS written_off_pieces
     FROM rental_request_product_lines
     WHERE rental_request_id = $1
     GROUP BY product_kind, COALESCE(size, ''), COALESCE(size_group::text, '')
     ORDER BY MIN(sort_order), product_kind, COALESCE(size, '')`,
    [contract.rentalRequestId],
  );

  return {
    contract,
    applies: result.rows.length > 0,
    lines: result.rows.map((row) => ({
      key: makeCommitmentKey(row.product_kind, row.size),
      productKind: row.product_kind,
      size: row.size || null,
      sizeGroup: row.size_group || null,
      committedPieces: Number(row.committed_pieces ?? 0),
      writtenOffPieces: Number(row.written_off_pieces ?? 0),
    })),
  };
}

async function sumCurrentInventoryPiecesByCommitmentKey(contract) {
  const result = await pool.query(
    `SELECT s.product_kind,
            COALESCE(s.size, '') AS size,
            COALESCE(SUM(i.quantity), 0)::int AS total
     FROM inventories i
     INNER JOIN skus s ON s.sku_id = i.sku_id
     INNER JOIN bins b ON b.bin_id = i.bin_id
     INNER JOIN rack_levels rl ON rl.rack_level_id = b.rack_level_id
     INNER JOIN racks r ON r.rack_id = rl.rack_id
     INNER JOIN warehouse_zones z ON z.zone_id = r.zone_id
     WHERE i.tenant_id = $1
       AND z.warehouse_id = $2
       AND i.quantity > 0
     GROUP BY s.product_kind, COALESCE(s.size, '')`,
    [contract.tenantId, contract.warehouseId],
  );

  return result.rows.map((row) => ({
    key: makeCommitmentKey(row.product_kind, row.size),
    productKind: row.product_kind,
    size: row.size || null,
    pieces: Number(row.total ?? 0),
  }));
}

async function sumInFlightInboundPiecesByCommitmentKey(
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
    `SELECT s.product_kind,
            COALESCE(s.size, '') AS size,
            COALESCE(SUM(
              GREATEST(0, iri.expected_quantity - COALESCE(iri.received_quantity, 0))
            ), 0)::int AS total
     FROM inbound_request_items iri
     INNER JOIN inbound_requests ir ON ir.inbound_request_id = iri.inbound_request_id
     INNER JOIN skus s ON s.sku_id = iri.sku_id
     WHERE ir.contract_id = $1
       AND ir.status NOT IN ('COMPLETED', 'CANCELLED')
       ${excludeClause}
     GROUP BY s.product_kind, COALESCE(s.size, '')`,
    params,
  );

  return result.rows.map((row) => ({
    key: makeCommitmentKey(row.product_kind, row.size),
    productKind: row.product_kind,
    size: row.size || null,
    pieces: Number(row.total ?? 0),
  }));
}

async function groupProposedItemsByCommitmentKey(contract, items = []) {
  if (!items.length) return [];

  const skuIds = [...new Set(items.map((item) => parseUuid(item.skuId, "skuId")))];
  const skuResult = await pool.query(
    `SELECT sku_id, product_kind, COALESCE(size, '') AS size, tenant_id
     FROM skus
     WHERE sku_id = ANY($1::uuid[])`,
    [skuIds],
  );
  const skuById = new Map(skuResult.rows.map((row) => [row.sku_id, row]));
  const grouped = new Map();

  for (const item of items) {
    const skuId = parseUuid(item.skuId, "skuId");
    const sku = skuById.get(skuId);
    if (!sku) {
      throw new AppError("SKU not found", 404, "NOT_FOUND");
    }
    if (sku.tenant_id !== contract.tenantId) {
      throw new AppError(
        "skuId does not belong to this inbound tenant",
        400,
        "VALIDATION_ERROR",
      );
    }

    const expected = Number(item.expectedQuantity ?? 0);
    const received = Number(item.receivedQuantity ?? 0);
    const pieces = Math.max(0, expected - received);
    const key = makeCommitmentKey(sku.product_kind, sku.size);
    const current = grouped.get(key) ?? {
      key,
      productKind: sku.product_kind,
      size: sku.size || null,
      pieces: 0,
      skuIds: [],
    };
    current.pieces += pieces;
    current.skuIds.push(skuId);
    grouped.set(key, current);
  }

  return [...grouped.values()];
}

function mergeUsageRows(lines, usageGroups) {
  const usageByKey = new Map();
  for (const group of usageGroups.flat()) {
    if (!group || group.pieces <= 0) continue;
    const current = usageByKey.get(group.key) ?? {
      key: group.key,
      productKind: group.productKind,
      size: group.size,
      pieces: 0,
    };
    current.pieces += group.pieces;
    usageByKey.set(group.key, current);
  }

  return lines.map((line) => {
    const usage = usageByKey.get(line.key);
    usageByKey.delete(line.key);
    const usedPieces = Number(usage?.pieces ?? 0);
    return {
      ...line,
      ...enrichCommitmentLineUsage({
        committedPieces: line.committedPieces,
        writtenOffPieces: line.writtenOffPieces ?? 0,
        usedPieces,
      }),
    };
  }).concat(
    [...usageByKey.values()].map((usage) => ({
      key: usage.key,
      productKind: usage.productKind,
      size: usage.size,
      sizeGroup: null,
      committedPieces: 0,
      writtenOffPieces: 0,
      effectiveCommittedPieces: 0,
      usedPieces: usage.pieces,
      remainingPieces: 0,
      overagePieces: usage.pieces,
      isTailRemaining: false,
      canCloseLine: false,
      tailCloseThreshold: 0,
      uncommitted: true,
    })),
  );
}

export async function getContractInboundCommitmentDetails(
  contractId,
  { proposedItems = [], excludeInboundRequestItemId = null } = {},
) {
  const { contract, applies, lines } = await getContractCommittedProductLines(contractId);
  if (!applies) {
    return {
      applies: false,
      contractId: contract.contractId,
      rentalRequestId: contract.rentalRequestId ?? null,
      productLines: [],
      totals: {
        committedPieces: 0,
        effectiveCommittedPieces: 0,
        writtenOffPieces: 0,
        usedPieces: 0,
        remainingPieces: null,
        overagePieces: 0,
      },
    };
  }

  const [onHand, inFlight, proposed] = await Promise.all([
    sumCurrentInventoryPiecesByCommitmentKey(contract),
    sumInFlightInboundPiecesByCommitmentKey(contract.contractId, {
      excludeInboundRequestItemId,
    }),
    groupProposedItemsByCommitmentKey(contract, proposedItems),
  ]);

  const productLines = mergeUsageRows(lines, [onHand, inFlight, proposed]);
  const totals = productLines.reduce(
    (sum, line) => ({
      committedPieces: sum.committedPieces + line.committedPieces,
      effectiveCommittedPieces:
        sum.effectiveCommittedPieces + line.effectiveCommittedPieces,
      writtenOffPieces: sum.writtenOffPieces + line.writtenOffPieces,
      usedPieces: sum.usedPieces + line.usedPieces,
      remainingPieces: sum.remainingPieces + line.remainingPieces,
      overagePieces: sum.overagePieces + line.overagePieces,
    }),
    {
      committedPieces: 0,
      effectiveCommittedPieces: 0,
      writtenOffPieces: 0,
      usedPieces: 0,
      remainingPieces: 0,
      overagePieces: 0,
    },
  );

  return {
    applies: true,
    contractId: contract.contractId,
    rentalRequestId: contract.rentalRequestId,
    productLines,
    totals,
    warnings: buildCommitmentOverageWarnings(productLines),
  };
}

/**
 * Đánh giá cam kết sau putaway (on-hand thực tế) — dùng khi hoàn tất inbound.
 * Không chặn; trả warnings COMMITMENT_OVERAGE nếu tồn vượt cam kết hiệu lực.
 */
export async function evaluateCommitmentAfterPutaway(contractId) {
  const details = await getContractInboundCommitmentDetails(contractId);
  if (!details.applies) {
    return { applies: false, warnings: [], productLines: [] };
  }
  return {
    applies: true,
    warnings: details.warnings ?? buildCommitmentOverageWarnings(details.productLines),
    productLines: details.productLines,
    totals: details.totals,
  };
}

/**
 * Tenant admin đóng phần cam kết còn lại quá nhỏ (tail) — ghi written_off_pieces.
 */
export async function closeInboundCommitmentLine(
  contractId,
  { productKind, size = null, note = null } = {},
  user = null,
) {
  const id = parseUuid(contractId, "contractId");
  const contract = await getContract(id);

  if (user?.role === "TENANT_ADMIN") {
    if (!user.tenantId || contract.tenantId !== user.tenantId) {
      throw new AppError(
        "Chỉ tenant admin của hợp đồng này mới được đóng cam kết",
        403,
        "FORBIDDEN",
      );
    }
  }

  if (!contract.rentalRequestId) {
    throw new AppError(
      "Hợp đồng không có rental request — không áp dụng cam kết dòng",
      400,
      "VALIDATION_ERROR",
    );
  }

  const kind = String(productKind ?? "").trim();
  if (!kind) {
    throw new AppError("productKind is required", 400, "VALIDATION_ERROR");
  }

  const normalizedSize = normalizeCommitmentSize(size);
  const details = await getContractInboundCommitmentDetails(contractId);
  const lineKey = makeCommitmentKey(kind, normalizedSize === "" ? null : normalizedSize);
  const line = details.productLines.find((row) => row.key === lineKey);

  if (!line || line.uncommitted) {
    throw new AppError(
      "Không tìm thấy dòng cam kết rental khớp productKind/size",
      404,
      "NOT_FOUND",
    );
  }

  if (!line.canCloseLine) {
    throw new AppError(
      `Chỉ đóng cam kết khi còn ≤ ${line.tailCloseThreshold} cái (hiện còn ${line.remainingPieces}).`,
      400,
      "COMMITMENT_CLOSE_NOT_ALLOWED",
    );
  }

  const remaining = Number(line.remainingPieces ?? 0);
  if (remaining <= 0) {
    throw new AppError("Dòng cam kết đã đủ — không còn phần cần đóng", 400, "VALIDATION_ERROR");
  }

  const updateResult = await pool.query(
    `UPDATE rental_request_product_lines
     SET written_off_pieces = written_off_pieces + $4,
         updated_at = NOW()
     WHERE line_id = (
       SELECT line_id
       FROM rental_request_product_lines
       WHERE rental_request_id = $1
         AND product_kind = $2
         AND COALESCE(size, '') = $3
       ORDER BY sort_order, line_id
       LIMIT 1
     )
     RETURNING line_id, written_off_pieces`,
    [contract.rentalRequestId, kind, normalizedSize, remaining],
  );

  if (!updateResult.rows.length) {
    throw new AppError("Không cập nhật được dòng rental request", 500, "INTERNAL_ERROR");
  }

  const refreshed = await getContractInboundCommitmentDetails(contractId);
  const closedLine = refreshed.productLines.find((row) => row.key === lineKey);

  return {
    contractId: id,
    productKind: kind,
    size: normalizedSize || null,
    closedPieces: remaining,
    note: note?.trim() || null,
    line: closedLine,
    totals: refreshed.totals,
  };
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
  { additionalPieces = 0, items = null, excludeInboundRequestItemId = null } = {},
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

  if (!Array.isArray(items)) return;

  const details = await getContractInboundCommitmentDetails(contractId, {
    proposedItems: items,
    excludeInboundRequestItemId,
  });
  const invalidLine = details.productLines.find(
    (line) => line.uncommitted && line.usedPieces > 0,
  );
  if (invalidLine) {
    throw new AppError(
      `SKU ${describeCommitmentLine(invalidLine)} không thuộc danh sách hàng hóa đã đăng ký trong hợp đồng thuê.`,
      400,
      "SKU_NOT_IN_RENTAL_COMMITMENT",
      {
        productKind: invalidLine.productKind,
        size: invalidLine.size,
      },
    );
  }

  const overageLine = details.productLines.find((line) => line.overagePieces > 0);
  if (overageLine) {
    throw new AppError(
      `Vượt cam kết cho ${describeCommitmentLine(overageLine)} (${overageLine.effectiveCommittedPieces} cái hiệu lực). ` +
        `Đang dùng/dự kiến: ${overageLine.usedPieces} cái; còn được thêm tối đa ` +
        `${Math.max(0, overageLine.remainingPieces)} cái.`,
      400,
      "COMMITTED_PRODUCT_LINE_EXCEEDED",
      {
        productKind: overageLine.productKind,
        size: overageLine.size,
        committedPieces: overageLine.committedPieces,
        usedPieces: overageLine.usedPieces,
        remainingPieces: overageLine.remainingPieces,
        overagePieces: overageLine.overagePieces,
      },
    );
  }
}
