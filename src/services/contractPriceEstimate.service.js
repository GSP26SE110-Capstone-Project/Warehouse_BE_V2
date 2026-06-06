import AppError from '../utils/AppError.js';
import { parseUuid } from '../utils/validate.js';
import { REFERENCE_ZONE_AREA_M2 } from '../constants/warehouseCapacity.js';
import {
  PREMIUM_STORAGE_SURCHARGE_RATIO,
  WAREHOUSE_PRICE_PER_M2_MONTH,
  ZONE_PRICE_PER_M2_MONTH,
} from '../constants/rentalPricingDefaults.js';
import {
  STORAGE_BOX_DAY_PRICE_BY_BOX_TYPE,
  STORAGE_BOX_MONTH_PRICE_BY_BOX_TYPE,
} from '../constants/pricingDefaults.js';
import {
  amountAreaM2ForBillingPeriod,
  amountBoxAllocationForBillingPeriod,
  amountBoxAllocationForMonthlyBillingPeriod,
  contractBillingDays,
  contractBillingMonths,
  dailyBoxRentFromAllocation,
  monthlyBoxRentFromAllocation,
  parseBoxAllocationFromRental,
  prorateToBillingMonth,
  resolveBoxAllocationForPricing,
} from '../utils/rentalPeriodPricing.js';
import { assertWarehouseAccess } from '../utils/warehouseAccess.js';
import { getWarehouseById, getWarehouseZonePlanning } from './warehouse.service.js';
import { getRentalRequest } from './rentalRequest.service.js';
import { getZoneForUser } from './warehouseZone.service.js';

function parseArea(value) {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function zoneRateForType(zoneType, rr) {
  const base =
    ZONE_PRICE_PER_M2_MONTH[zoneType] ??
    ZONE_PRICE_PER_M2_MONTH[rr.suggestedZoneType] ??
    (rr.requiresPremiumStorage ? ZONE_PRICE_PER_M2_MONTH.PREMIUM : ZONE_PRICE_PER_M2_MONTH.SHARED);

  if (rr.requiresPremiumStorage && zoneType !== 'PREMIUM' && zoneType !== 'PRIVATE') {
    return Math.round(base * PREMIUM_STORAGE_SURCHARGE_RATIO);
  }
  return base;
}

function resolveZoneRate(rr) {
  const base =
    ZONE_PRICE_PER_M2_MONTH[rr.suggestedZoneType] ??
    (rr.requiresPremiumStorage ? ZONE_PRICE_PER_M2_MONTH.PREMIUM : ZONE_PRICE_PER_M2_MONTH.SHARED);

  if (rr.requiresPremiumStorage && rr.suggestedZoneType !== 'PREMIUM') {
    return Math.round(base * PREMIUM_STORAGE_SURCHARGE_RATIO);
  }
  return base;
}

async function resolvePricingFromZoneIds(zoneIds, whId, user, rr) {
  if (!zoneIds?.length) return null;

  let totalArea = 0;
  const zoneLines = [];

  for (const rawId of zoneIds) {
    const zone = await getZoneForUser(rawId, user);
    if (whId && zone.warehouseId !== whId) {
      throw new AppError(
        'Zone không thuộc kho đang ước tính giá',
        400,
        'ESTIMATE_ZONE_WAREHOUSE_MISMATCH'
      );
    }
    const area = parseArea(zone.areaM2);
    if (!area) continue;
    const rate = zoneRateForType(zone.zoneType, rr);
    totalArea += area;
    zoneLines.push({
      zoneCode: zone.zoneCode,
      zoneType: zone.zoneType,
      areaM2: area,
      ratePerM2Month: rate,
    });
  }

  if (totalArea <= 0 || !zoneLines.length) {
    throw new AppError(
      'Zone đã chọn chưa có diện tích (m²) hợp lệ để ước tính giá',
      400,
      'ESTIMATE_ZONE_NO_AREA'
    );
  }

  const monthlyAmount = zoneLines.reduce((s, line) => s + line.areaM2 * line.ratePerM2Month, 0);

  return {
    totalAreaM2: totalArea,
    monthlyAmount,
    unitPricePerM2Month: Math.round(monthlyAmount / totalArea),
    zoneLines,
  };
}

function estimateBoxStoragePeriod(rr, billingDays, breakdown) {
  const allocation = resolveBoxAllocationForPricing(rr);
  const dailyRent = dailyBoxRentFromAllocation(allocation);
  const periodTotal = amountBoxAllocationForBillingPeriod(allocation, billingDays);

  for (const row of allocation) {
    const unit = STORAGE_BOX_DAY_PRICE_BY_BOX_TYPE[row.boxType];
    breakdown.push({
      label: `Thùng ${row.boxType}`,
      detail: `${row.count} × ${unit.toLocaleString('vi-VN')} VND/ngày × ${billingDays} ngày`,
    });
  }
  breakdown.push({
    label: 'Tổng thuê theo thùng',
    detail: `${dailyRent.toLocaleString('vi-VN')} VND/ngày × ${billingDays} ngày = ${periodTotal.toLocaleString('vi-VN')} VND`,
  });

  return {
    periodTotal,
    basisLabel: 'Thuê theo thùng — Σ (số thùng × giá/ngày theo loại) × số ngày HĐ',
    boxAllocation: allocation,
    dailyBoxRent: dailyRent,
  };
}

function estimateSharedStorageMonthlyPeriod(rr, billingMonths, breakdown) {
  const allocation = resolveBoxAllocationForPricing(rr);
  const monthlyRent = monthlyBoxRentFromAllocation(allocation);
  const periodTotal = amountBoxAllocationForMonthlyBillingPeriod(allocation, billingMonths);

  for (const row of allocation) {
    const unit = STORAGE_BOX_MONTH_PRICE_BY_BOX_TYPE[row.boxType];
    breakdown.push({
      label: `Thùng ${row.boxType}`,
      detail: `${row.count} × ${unit.toLocaleString('vi-VN')} VND/tháng × ${billingMonths} tháng`,
    });
  }
  breakdown.push({
    label: 'Tổng thuê theo thùng',
    detail: `${monthlyRent.toLocaleString('vi-VN')} VND/tháng × ${billingMonths} tháng = ${periodTotal.toLocaleString('vi-VN')} VND`,
  });

  return {
    periodTotal,
    monthlyRent,
    basisLabel: 'Thuê theo thùng — Σ (số thùng × giá/tháng theo loại) × số tháng HĐ',
    boxAllocation: allocation,
  };
}

export async function estimateContractPrice(
  rentalRequestId,
  warehouseId,
  user,
  { zoneIds, contractType: contractTypeOverride, startDate, endDate } = {}
) {
  const id = parseUuid(rentalRequestId, 'rentalRequestId');
  const rr = await getRentalRequest(id);
  const whId = warehouseId ? parseUuid(warehouseId, 'warehouseId') : rr.warehouseId;

  if (whId) {
    assertWarehouseAccess(user, whId);
  }

  const contractType = contractTypeOverride ?? rr.contractType ?? 'SHARED_STORAGE';
  const usesZoneAreaPricing = contractType === 'DEDICATED_ZONE';
  const selectedZonePricing = usesZoneAreaPricing
    ? await resolvePricingFromZoneIds(zoneIds, whId, user, rr)
    : null;
  const periodStart = startDate ?? rr.expectedStartDate;
  const periodEnd = endDate ?? rr.expectedEndDate;
  const billingDays = contractBillingDays(periodStart, periodEnd);
  const billingMonths = contractBillingMonths(periodStart, periodEnd);
  const requestedArea = parseArea(rr.requestedAreaM2);

  let warehouse = null;
  let planning = null;
  if (whId) {
    warehouse = await getWarehouseById(whId);
    planning = await getWarehouseZonePlanning(whId);
  }

  const breakdown = [];
  let periodTotal = 0;
  let areaM2Used = null;
  let unitPricePerM2Month = null;
  let basisLabel = '';
  let boxAllocation = null;
  let dailyBoxRent = null;

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
      periodTotal = amountAreaM2ForBillingPeriod(
        areaM2Used,
        unitPricePerM2Month,
        billingMonths
      );
      basisLabel = 'Thuê nguyên kho — m² × đơn giá m²/tháng × số tháng HĐ';
      breakdown.push({
        label: 'Thuê nguyên kho',
        detail: `${areaM2Used} m² × ${unitPricePerM2Month.toLocaleString('vi-VN')} VND/m²/tháng × ${billingMonths} tháng`,
      });
      break;
    }
    case 'DEDICATED_ZONE': {
      if (selectedZonePricing) {
        areaM2Used = selectedZonePricing.totalAreaM2;
        unitPricePerM2Month = selectedZonePricing.unitPricePerM2Month;
        periodTotal = 0;
        for (const line of selectedZonePricing.zoneLines) {
          const lineAmount = amountAreaM2ForBillingPeriod(
            line.areaM2,
            line.ratePerM2Month,
            billingMonths
          );
          periodTotal += lineAmount;
          breakdown.push({
            label: line.zoneCode,
            detail: `${line.areaM2} m² (${line.zoneType}) × ${line.ratePerM2Month.toLocaleString('vi-VN')} VND/m²/tháng × ${billingMonths} tháng`,
          });
        }
        basisLabel = 'Thuê nguyên zone — từng zone: m² × đơn giá theo loại zone × số tháng HĐ';
        breakdown.unshift({
          label: 'Thuê zone đã chọn',
          detail: `${areaM2Used} m² · ${selectedZonePricing.zoneLines.length} zone · ${billingMonths} tháng`,
        });
      } else {
        const zoneRate = resolveZoneRate(rr);
        areaM2Used =
          requestedArea ??
          parseArea(planning?.suggestedAreaPerZoneForEvenSplit) ??
          REFERENCE_ZONE_AREA_M2;
        unitPricePerM2Month = zoneRate;
        periodTotal = amountAreaM2ForBillingPeriod(areaM2Used, zoneRate, billingMonths);
        basisLabel = 'Thuê nguyên zone (ước tính) — m² × đơn giá zone × số tháng HĐ';
        breakdown.push({
          label: 'Thuê nguyên zone (ước tính)',
          detail: `${areaM2Used} m² × ${zoneRate.toLocaleString('vi-VN')} VND/m²/tháng × ${billingMonths} tháng`,
        });
        if (rr.suggestedZoneType) {
          breakdown.push({ label: 'Loại zone tham chiếu', detail: rr.suggestedZoneType });
        }
      }
      break;
    }
    case 'RESERVED_STORAGE': {
      const hasBoxSource =
        parseBoxAllocationFromRental(rr).length > 0 || Number(rr.estimatedBoxCount) > 0;
      if (hasBoxSource) {
        const boxEstimate = estimateBoxStoragePeriod(rr, billingDays, breakdown);
        periodTotal = boxEstimate.periodTotal;
        basisLabel = boxEstimate.basisLabel;
        boxAllocation = boxEstimate.boxAllocation;
        dailyBoxRent = boxEstimate.dailyBoxRent;
      } else if (requestedArea) {
        areaM2Used = requestedArea;
        unitPricePerM2Month = ZONE_PRICE_PER_M2_MONTH.SHARED;
        periodTotal = amountAreaM2ForBillingPeriod(
          areaM2Used,
          unitPricePerM2Month,
          billingMonths
        );
        basisLabel = 'Giữ chỗ theo diện tích — m² × giá SHARED × số tháng HĐ';
        breakdown.push({
          label: 'Giữ chỗ theo diện tích',
          detail: `${areaM2Used} m² × ${unitPricePerM2Month.toLocaleString('vi-VN')} VND/m²/tháng × ${billingMonths} tháng`,
        });
      } else {
        const boxEstimate = estimateBoxStoragePeriod(rr, billingDays, breakdown);
        periodTotal = boxEstimate.periodTotal;
        basisLabel = boxEstimate.basisLabel;
        boxAllocation = boxEstimate.boxAllocation;
        dailyBoxRent = boxEstimate.dailyBoxRent;
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
      const boxEstimate = estimateSharedStorageMonthlyPeriod(rr, billingMonths, breakdown);
      periodTotal = boxEstimate.periodTotal;
      basisLabel = boxEstimate.basisLabel;
      boxAllocation = boxEstimate.boxAllocation;
      dailyBoxRent = null;
      break;
    }
  }

  const suggestedTotalAmount = Math.round(periodTotal);
  const isSharedMonthly = contractType === 'SHARED_STORAGE';
  const isReservedDaily =
    contractType === 'RESERVED_STORAGE' && dailyBoxRent != null && periodTotal > 0;
  const monthlyAmount = isSharedMonthly
    ? monthlyBoxRentFromAllocation(boxAllocation ?? resolveBoxAllocationForPricing(rr))
    : isReservedDaily
      ? prorateToBillingMonth(suggestedTotalAmount, billingDays)
      : Math.round(suggestedTotalAmount / Math.max(1, billingMonths));

  return {
    rentalRequestId: id,
    warehouseId: whId ?? null,
    contractType,
    billingCycle: rr.billingCycle ?? 'MONTHLY',
    billingDays,
    billingMonths,
    monthCount: billingMonths,
    monthlyAmount,
    suggestedTotalAmount,
    dailyBoxRent,
    boxAllocation,
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
