import AppError from '../utils/AppError.js';
import { parseUuid } from '../utils/validate.js';
import { REFERENCE_ZONE_AREA_M2 } from '../constants/warehouseCapacity.js';
import {
  DAYS_PER_BILLING_MONTH,
  PREMIUM_STORAGE_SURCHARGE_RATIO,
  SHARED_STORAGE_AVG_BOX_DAY,
  WAREHOUSE_PRICE_PER_M2_MONTH,
  ZONE_PRICE_PER_M2_MONTH,
} from '../constants/rentalPricingDefaults.js';
import { assertWarehouseAccess } from '../utils/warehouseAccess.js';
import { getWarehouseById, getWarehouseZonePlanning } from './warehouse.service.js';
import { getRentalRequest } from './rentalRequest.service.js';

function parseArea(value) {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function monthCountBetween(startIso, endIso) {
  if (!startIso || !endIso) return 12;
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 12;
  const diffDays = Math.ceil((end.getTime() - start.getTime()) / 86400000);
  if (diffDays <= 0) return 1;
  return Math.max(1, Math.floor(diffDays / DAYS_PER_BILLING_MONTH));
}

function resolveZoneRate(rr) {
  const base =
    ZONE_PRICE_PER_M2_MONTH[rr.suggestedZoneType] ??
    (rr.requiresPremiumStorage
      ? ZONE_PRICE_PER_M2_MONTH.PREMIUM
      : rr.requiresFastPicking
        ? ZONE_PRICE_PER_M2_MONTH.FAST_MOVING
        : ZONE_PRICE_PER_M2_MONTH.SHARED);

  if (rr.requiresPremiumStorage && rr.suggestedZoneType !== 'PREMIUM') {
    return Math.round(base * PREMIUM_STORAGE_SURCHARGE_RATIO);
  }
  return base;
}

export async function estimateContractPrice(rentalRequestId, warehouseId, user) {
  const id = parseUuid(rentalRequestId, 'rentalRequestId');
  const rr = await getRentalRequest(id);
  const whId = warehouseId ? parseUuid(warehouseId, 'warehouseId') : rr.warehouseId;

  if (whId) {
    assertWarehouseAccess(user, whId);
  }

  const contractType = rr.contractType ?? 'SHARED_STORAGE';
  const months = monthCountBetween(rr.expectedStartDate, rr.expectedEndDate);
  const requestedArea = parseArea(rr.requestedAreaM2);

  let warehouse = null;
  let planning = null;
  if (whId) {
    warehouse = await getWarehouseById(whId);
    planning = await getWarehouseZonePlanning(whId);
  }

  const breakdown = [];
  let monthlyAmount = 0;
  let areaM2Used = null;
  let unitPricePerM2Month = null;
  let basisLabel = '';

  switch (contractType) {
    case 'DEDICATED_WAREHOUSE': {
      areaM2Used =
        requestedArea ??
        parseArea(planning?.usableAreaM2) ??
        parseArea(warehouse?.usableAreaM2) ??
        parseArea(warehouse?.totalAreaM2);
      unitPricePerM2Month = WAREHOUSE_PRICE_PER_M2_MONTH;
      if (!areaM2Used) {
        throw new AppError(
          'Chưa có diện tích để ước tính — khách chưa khai báo và kho chưa có usableAreaM2',
          400,
          'ESTIMATE_NO_AREA'
        );
      }
      monthlyAmount = areaM2Used * unitPricePerM2Month;
      basisLabel = 'Diện tích kho × đơn giá m²/tháng';
      breakdown.push({
        label: 'Thuê nguyên kho',
        detail: `${areaM2Used} m² × ${unitPricePerM2Month.toLocaleString('vi-VN')} VND/m²/tháng`,
      });
      break;
    }
    case 'DEDICATED_ZONE': {
      const zoneRate = resolveZoneRate(rr);
      areaM2Used =
        requestedArea ??
        parseArea(planning?.suggestedAreaPerZoneForEvenSplit) ??
        REFERENCE_ZONE_AREA_M2;
      unitPricePerM2Month = zoneRate;
      monthlyAmount = areaM2Used * zoneRate;
      basisLabel = 'Diện tích zone × đơn giá m²/tháng (theo loại zone)';
      breakdown.push({
        label: 'Thuê nguyên zone',
        detail: `${areaM2Used} m² × ${zoneRate.toLocaleString('vi-VN')} VND/m²/tháng`,
      });
      if (rr.suggestedZoneType) {
        breakdown.push({ label: 'Loại zone tham chiếu', detail: rr.suggestedZoneType });
      }
      break;
    }
    case 'RESERVED_STORAGE': {
      const boxes = Number(rr.estimatedBoxCount) || 0;
      if (requestedArea) {
        areaM2Used = requestedArea;
        unitPricePerM2Month = ZONE_PRICE_PER_M2_MONTH.SHARED;
        monthlyAmount = areaM2Used * unitPricePerM2Month;
        basisLabel = 'Diện tích giữ chỗ × đơn giá m²/tháng (SHARED)';
        breakdown.push({
          label: 'Giữ chỗ theo diện tích',
          detail: `${areaM2Used} m² × ${unitPricePerM2Month.toLocaleString('vi-VN')} VND/m²/tháng`,
        });
      } else if (boxes > 0) {
        monthlyAmount = boxes * SHARED_STORAGE_AVG_BOX_DAY * DAYS_PER_BILLING_MONTH;
        basisLabel = 'Số thùng giữ × giá box/day × 30 ngày';
        breakdown.push({
          label: 'Giữ chỗ theo thùng',
          detail: `${boxes} thùng × ${SHARED_STORAGE_AVG_BOX_DAY.toLocaleString('vi-VN')} VND/ngày × ${DAYS_PER_BILLING_MONTH} ngày`,
        });
      } else {
        areaM2Used = parseArea(planning?.remainingZoneAreaM2) ?? REFERENCE_ZONE_AREA_M2;
        unitPricePerM2Month = ZONE_PRICE_PER_M2_MONTH.SHARED;
        monthlyAmount = areaM2Used * unitPricePerM2Month;
        basisLabel = 'Ước tính theo diện tích zone còn trống trong kho';
        breakdown.push({
          label: 'Giữ chỗ (ước tính)',
          detail: `${areaM2Used} m² × ${unitPricePerM2Month.toLocaleString('vi-VN')} VND/m²/tháng`,
        });
      }
      break;
    }
    case 'NEEDS_CONSULTATION': {
      basisLabel = 'Chưa chốt loại thuê — kho tư vấn sau khi duyệt';
      breakdown.push({
        label: 'Chờ tư vấn',
        detail:
          'Khách chưa chọn hình thức thuê. Warehouse Admin chọn loại phù hợp khi duyệt để có báo giá chính thức.',
      });
      if (requestedArea) {
        breakdown.push({
          label: 'Diện tích khách khai báo',
          detail: `${requestedArea} m² (tham khảo, chưa tính phí)`,
        });
      }
      break;
    }
    case 'SHARED_STORAGE':
    default: {
      const boxes = Math.max(1, Number(rr.estimatedBoxCount) || 10);
      monthlyAmount = boxes * SHARED_STORAGE_AVG_BOX_DAY * DAYS_PER_BILLING_MONTH;
      basisLabel = 'Mức dùng thùng × giá box/day × 30 ngày';
      breakdown.push({
        label: 'Kho chia sẻ (usage)',
        detail: `~${boxes} thùng × ${SHARED_STORAGE_AVG_BOX_DAY.toLocaleString('vi-VN')} VND/ngày × ${DAYS_PER_BILLING_MONTH} ngày/tháng`,
      });
      break;
    }
  }

  const suggestedTotalAmount = Math.round(monthlyAmount * months);

  return {
    rentalRequestId: id,
    warehouseId: whId ?? null,
    contractType,
    billingCycle: rr.billingCycle ?? 'MONTHLY',
    monthCount: months,
    monthlyAmount: Math.round(monthlyAmount),
    suggestedTotalAmount,
    areaM2Used,
    unitPricePerM2Month,
    basisLabel,
    breakdown,
    warehouse: warehouse
      ? {
          warehouseId: warehouse.warehouseId,
          warehouseName: warehouse.warehouseName,
          totalAreaM2: parseArea(warehouse.totalAreaM2),
          usableAreaM2: parseArea(warehouse.usableAreaM2),
        }
      : null,
    zonePlanning: planning
      ? {
          zoneCount: planning.zoneCount,
          usedZoneAreaM2: planning.usedZoneAreaM2,
          remainingZoneAreaM2: planning.remainingZoneAreaM2,
          usableAreaM2: planning.usableAreaM2,
          suggestedMinZoneCount: planning.suggestedMinZoneCount,
        }
      : null,
    requestedAreaM2: requestedArea,
    currency: 'VND',
    source: 'docs/pricing.md',
  };
}
