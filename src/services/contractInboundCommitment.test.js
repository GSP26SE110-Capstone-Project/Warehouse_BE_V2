import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCommitmentOverageWarnings,
  computeTailCloseThreshold,
  effectiveCommittedPieces,
  enrichCommitmentLineUsage,
} from '../constants/inboundCommitment.js';

/** Logic thuần — mirror công thức gate inbound. */
function canAddInboundPieces({ committed, onHand, inFlight, additional }) {
  return onHand + inFlight + additional <= committed;
}

function remainingInboundCapacity({ committed, onHand, inFlight }) {
  return Math.max(0, committed - onHand - inFlight);
}

function summarizeLineCapacity({ committedLines, onHand = {}, inFlight = {}, proposed = {} }) {
  const result = new Map();
  for (const [key, committed] of Object.entries(committedLines)) {
    const used = (onHand[key] ?? 0) + (inFlight[key] ?? 0) + (proposed[key] ?? 0);
    result.set(key, {
      committed,
      used,
      remaining: Math.max(0, committed - used),
      overage: Math.max(0, used - committed),
      uncommitted: false,
    });
  }
  for (const source of [onHand, inFlight, proposed]) {
    for (const [key, pieces] of Object.entries(source)) {
      if (result.has(key) || pieces <= 0) continue;
      result.set(key, {
        committed: 0,
        used: pieces,
        remaining: 0,
        overage: pieces,
        uncommitted: true,
      });
    }
  }
  return result;
}

describe('inbound commitment capacity (on-hand + in-flight)', () => {
  it('sau outbound tồn 0 — được tạo inbound mới trong cam kết', () => {
    assert.equal(
      canAddInboundPieces({ committed: 1000, onHand: 0, inFlight: 0, additional: 500 }),
      true
    );
    assert.equal(remainingInboundCapacity({ committed: 1000, onHand: 0, inFlight: 0 }), 1000);
  });

  it('tồn đầy + phiếu mở — chặn thêm', () => {
    assert.equal(
      canAddInboundPieces({ committed: 1000, onHand: 800, inFlight: 200, additional: 1 }),
      false
    );
    assert.equal(
      remainingInboundCapacity({ committed: 1000, onHand: 800, inFlight: 200 }),
      0
    );
  });

  it('phiếu cũ COMPLETED không tính in-flight — chỉ tồn hiện tại', () => {
    assert.equal(
      canAddInboundPieces({ committed: 1000, onHand: 0, inFlight: 0, additional: 1000 }),
      true
    );
  });

  it('không double-count: tồn 800 + in-flight còn lại 200 (đã nhận 800/1000)', () => {
    assert.equal(
      canAddInboundPieces({ committed: 1000, onHand: 800, inFlight: 200, additional: 0 }),
      true
    );
    assert.equal(
      canAddInboundPieces({ committed: 1000, onHand: 800, inFlight: 200, additional: 1 }),
      false
    );
  });
});

describe('inbound commitment capacity by productKind + size', () => {
  it('chặn SKU không thuộc product line rental request', () => {
    const summary = summarizeLineCapacity({
      committedLines: { 'POLO|M': 500 },
      proposed: { 'JEANS|M': 1 },
    });

    assert.equal(summary.get('JEANS|M').uncommitted, true);
    assert.equal(summary.get('JEANS|M').overage, 1);
  });

  it('chặn vượt remaining theo từng loại hàng và size', () => {
    const summary = summarizeLineCapacity({
      committedLines: { 'POLO|M': 500 },
      onHand: { 'POLO|M': 300 },
      inFlight: { 'POLO|M': 100 },
      proposed: { 'POLO|M': 101 },
    });

    assert.equal(summary.get('POLO|M').remaining, 0);
    assert.equal(summary.get('POLO|M').overage, 1);
  });

  it('cộng chung nhiều SKU cùng productKind + size', () => {
    const summary = summarizeLineCapacity({
      committedLines: { 'POLO|M': 500 },
      proposed: { 'POLO|M': 200 + 300 },
    });

    assert.equal(summary.get('POLO|M').used, 500);
    assert.equal(summary.get('POLO|M').overage, 0);
  });
});

describe('rental commitment tail + overage warnings (500 → 110 → 390)', () => {
  it('lần 1 nhận 110 — còn 390 hiệu lực', () => {
    const line = enrichCommitmentLineUsage({
      committedPieces: 500,
      writtenOffPieces: 0,
      usedPieces: 110,
    });
    assert.equal(line.remainingPieces, 390);
    assert.equal(line.overagePieces, 0);
    assert.equal(line.canCloseLine, false);
  });

  it('lần 2 nhận 391 khi còn 390 — overage 1, warning COMMITMENT_OVERAGE', () => {
    const line = enrichCommitmentLineUsage({
      committedPieces: 500,
      writtenOffPieces: 0,
      usedPieces: 501,
    });
    assert.equal(line.overagePieces, 1);
    const warnings = buildCommitmentOverageWarnings([
      {
        productKind: 'POLO',
        size: 'M',
        effectiveCommittedPieces: 500,
        usedPieces: 501,
        overagePieces: 1,
        uncommitted: false,
      },
    ]);
    assert.equal(warnings.length, 1);
    assert.equal(warnings[0].code, 'COMMITMENT_OVERAGE');
    assert.equal(warnings[0].overagePieces, 1);
  });

  it('lần 2 nhận 389 — tail 1 cái, cho phép đóng dòng', () => {
    const line = enrichCommitmentLineUsage({
      committedPieces: 500,
      writtenOffPieces: 0,
      usedPieces: 499,
    });
    assert.equal(line.remainingPieces, 1);
    assert.equal(line.isTailRemaining, true);
    assert.equal(line.canCloseLine, true);
    assert.equal(computeTailCloseThreshold(500), 5);
  });

  it('written_off giảm cam kết hiệu lực', () => {
    assert.equal(effectiveCommittedPieces(500, 1), 499);
    const line = enrichCommitmentLineUsage({
      committedPieces: 500,
      writtenOffPieces: 1,
      usedPieces: 499,
    });
    assert.equal(line.effectiveCommittedPieces, 499);
    assert.equal(line.remainingPieces, 0);
  });
});
