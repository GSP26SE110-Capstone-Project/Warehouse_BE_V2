function trimOptional(value) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed || null;
}

export function normalizeDefaultVehiclePlate(plate) {
  const normalized = String(plate ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
  if (!normalized) return null;
  if (normalized.length > 32) {
    return normalized.slice(0, 32);
  }
  return normalized;
}

/** Điền các trường delivery còn trống từ hồ sơ tài xế. */
export function applyTransporterProfileToDelivery(user, data, existing = null) {
  if (!user || user.role !== 'WH_TRANSPORTER') return data;

  const next = { ...data };

  if (next.vehiclePlate == null && !existing?.vehiclePlate && user.defaultVehiclePlate) {
    next.vehiclePlate = user.defaultVehiclePlate;
  }
  if (next.driverName == null && !existing?.driverName && user.fullName) {
    next.driverName = user.fullName;
  }
  if (next.driverPhone == null && !existing?.driverPhone && user.phone) {
    next.driverPhone = user.phone;
  }
  if (next.driverIdNumber == null && !existing?.driverIdNumber && user.defaultDriverIdNumber) {
    next.driverIdNumber = user.defaultDriverIdNumber;
  }
  if (next.carrierName == null && !existing?.carrierName && user.defaultCarrierName) {
    next.carrierName = user.defaultCarrierName;
  }

  return next;
}

export function pickTransporterSelfUpdate(body) {
  const data = {};
  if (body.fullName !== undefined) data.fullName = body.fullName;
  if (body.phone !== undefined) data.phone = body.phone;
  if (body.defaultVehiclePlate !== undefined) {
    data.defaultVehiclePlate = normalizeDefaultVehiclePlate(body.defaultVehiclePlate);
  }
  if (body.defaultDriverIdNumber !== undefined) {
    data.defaultDriverIdNumber = trimOptional(body.defaultDriverIdNumber);
  }
  if (body.defaultCarrierName !== undefined) {
    data.defaultCarrierName = trimOptional(body.defaultCarrierName);
  }
  return data;
}
