import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

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
