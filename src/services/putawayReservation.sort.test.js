import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  sortPutawayCandidateBins,
  binFitsLpnVolume,
  isEffectivelyEmptyBin,
  planAutoPutawayAssignments,
} from './putawayReservation.service.js';

function makeBin(overrides) {
  return {
    binId: 'bin-1',
    binCode: 'A1-L1-1',
    rackId: 'rack-a1',
    rackCode: 'A1',
    rackLevelId: 'level-1',
    levelNumber: 1,
    maxLpnCount: 2,
    currentLpnCount: 0,
    maxVolumeUnits: 16,
    usedVolumeUnits: 0,
    status: 'EMPTY',
    inventoryQty: 0,
    ...overrides,
  };
}

describe('sortPutawayCandidateBins', () => {
  it('ưu tiên bin PARTIAL trước EMPTY trong cùng rack', () => {
    const partial = makeBin({
      binId: 'partial',
      binCode: 'A1-L2-1',
      levelNumber: 2,
      status: 'PARTIAL',
      usedVolumeUnits: 12,
      currentLpnCount: 1,
      inventoryQty: 16,
    });
    const empty = makeBin({
      binId: 'empty',
      binCode: 'A1-L1-1',
      levelNumber: 1,
      status: 'EMPTY',
    });

    const sorted = sortPutawayCandidateBins([empty, partial]);
    assert.equal(sorted[0].binId, 'partial');
    assert.equal(sorted[1].binId, 'empty');
  });

  it('ưu tiên rack đang có hàng trước rack chỉ toàn EMPTY', () => {
    const activeRackPartial = makeBin({
      binId: 'a-partial',
      rackId: 'rack-a1',
      rackCode: 'A1',
      status: 'PARTIAL',
      usedVolumeUnits: 4,
      inventoryQty: 2,
    });
    const idleRackEmpty = makeBin({
      binId: 'b-empty',
      rackId: 'rack-b1',
      rackCode: 'B1',
      binCode: 'B1-L1-1',
      status: 'EMPTY',
    });

    const sorted = sortPutawayCandidateBins([idleRackEmpty, activeRackPartial]);
    assert.equal(sorted[0].rackCode, 'A1');
    assert.equal(sorted[1].rackCode, 'B1');
  });
});

describe('isEffectivelyEmptyBin / binFitsLpnVolume', () => {
  it('bin FULL desync (0 tồn, 0 LPN, 0 volume) vẫn nhận putaway', () => {
    const bin = makeBin({
      status: 'FULL',
      currentLpnCount: 0,
      usedVolumeUnits: 0,
      inventoryQty: 0,
    });
    assert.equal(isEffectivelyEmptyBin(bin), true);
    assert.equal(binFitsLpnVolume(bin, 8), true);
  });

  it('bin FULL thật (đã có LPN) bị chặn', () => {
    const bin = makeBin({
      status: 'FULL',
      currentLpnCount: 2,
      usedVolumeUnits: 16,
      maxLpnCount: 2,
    });
    assert.equal(binFitsLpnVolume(bin, 8), false);
  });
});

describe('planAutoPutawayAssignments', () => {
  it('gán LPN vào PARTIAL trước EMPTY (rack A1)', () => {
    const bins = [
      makeBin({ binId: 'l11', binCode: 'A1-L1-1', levelNumber: 1, status: 'EMPTY' }),
      makeBin({
        binId: 'l21',
        binCode: 'A1-L2-1',
        levelNumber: 2,
        status: 'PARTIAL',
        usedVolumeUnits: 8,
        currentLpnCount: 1,
        inventoryQty: 16,
      }),
      makeBin({
        binId: 'l22',
        binCode: 'A1-L2-2',
        levelNumber: 2,
        status: 'PARTIAL',
        usedVolumeUnits: 4,
        currentLpnCount: 1,
        inventoryQty: 1,
      }),
    ];
    const lpns = [{ lpnId: 'lpn-1', lpnCode: 'LPN-001', volumeUnits: 8 }];

    const planned = planAutoPutawayAssignments(lpns, bins);
    assert.equal(planned[0].binId, 'l21');
  });

  it('sau khi PARTIAL đầy chuyển sang PARTIAL khác rồi EMPTY', () => {
    const bins = [
      makeBin({ binId: 'l11', binCode: 'A1-L1-1', levelNumber: 1, status: 'EMPTY' }),
      makeBin({
        binId: 'l21',
        binCode: 'A1-L2-1',
        levelNumber: 2,
        status: 'PARTIAL',
        usedVolumeUnits: 8,
        currentLpnCount: 1,
        maxLpnCount: 2,
        inventoryQty: 16,
      }),
      makeBin({
        binId: 'l22',
        binCode: 'A1-L2-2',
        levelNumber: 2,
        status: 'PARTIAL',
        usedVolumeUnits: 4,
        currentLpnCount: 1,
        maxLpnCount: 2,
        inventoryQty: 1,
      }),
    ];
    const lpns = [
      { lpnId: 'lpn-1', lpnCode: 'LPN-001', volumeUnits: 8 },
      { lpnId: 'lpn-2', lpnCode: 'LPN-002', volumeUnits: 8 },
      { lpnId: 'lpn-3', lpnCode: 'LPN-003', volumeUnits: 8 },
    ];

    const planned = planAutoPutawayAssignments(lpns, bins);
    assert.deepEqual(
      planned.map((p) => p.binId),
      ['l21', 'l22', 'l11']
    );
  });
});
