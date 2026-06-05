import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

/** Logic thuần — mirror công thức gate inbound. */
function canAddInboundPieces({ committed, onHand, inFlight, additional }) {
  return onHand + inFlight + additional <= committed;
}

function remainingInboundCapacity({ committed, onHand, inFlight }) {
  return Math.max(0, committed - onHand - inFlight);
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
