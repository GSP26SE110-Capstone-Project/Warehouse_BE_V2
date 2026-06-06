import AppError from '../utils/AppError.js';
import { getWarehouseById } from './warehouse.service.js';
import { resolveCityDistrict } from './location.service.js';

export async function assertWarehouseTransportRegion(warehouseId, pickupCity, pickupDistrict) {
  const warehouse = await getWarehouseById(warehouseId);
  const whCity = String(warehouse.city ?? '').trim();
  const whDistrict = String(warehouse.district ?? '').trim();
  const city = String(pickupCity ?? '').trim();
  const district = String(pickupDistrict ?? '').trim();

  if (!whCity || !whDistrict) {
    throw new AppError(
      'Kho chưa cấu hình city/district — không thể dùng vận chuyển kho',
      400,
      'VALIDATION_ERROR'
    );
  }
  if (!city || !district) {
    throw new AppError(
      'Cần chọn city và district điểm lấy/giao hàng',
      400,
      'VALIDATION_ERROR'
    );
  }

  const resolved = await resolveCityDistrict(city, district);
  if (!resolved) {
    throw new AppError(
      'City/district không hợp lệ trong danh mục địa điểm',
      400,
      'VALIDATION_ERROR'
    );
  }

  if (resolved.city.toLowerCase() !== whCity.toLowerCase()) {
    throw new AppError(
      `Vận chuyển kho chỉ hỗ trợ trong cùng thành phố (${whCity}). Không thể vận chuyển liên tỉnh.`,
      400,
      'TRANSPORT_CROSS_CITY_FORBIDDEN'
    );
  }

  if (resolved.district.toLowerCase() !== whDistrict.toLowerCase()) {
    throw new AppError(
      `Vận chuyển kho chỉ hỗ trợ trong quận ${whDistrict}. Điểm chọn: ${resolved.district}.`,
      400,
      'TRANSPORT_DISTRICT_MISMATCH'
    );
  }

  return { city: resolved.city, district: resolved.district };
}
