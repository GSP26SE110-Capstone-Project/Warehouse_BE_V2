/**
 * Whether an active storage reservation covers this bin location.
 */
export function reservationCoversLocation(reservation, location) {
  const level = reservation.storageLevel ?? reservation.storage_level;
  const zoneId = reservation.zoneId ?? reservation.zone_id;
  const rackId = reservation.rackId ?? reservation.rack_id;
  const rackLevelId = reservation.rackLevelId ?? reservation.rack_level_id;
  const binId = reservation.binId ?? reservation.bin_id;

  switch (level) {
    case 'WAREHOUSE':
      return true;
    case 'ZONE':
      return zoneId != null && zoneId === location.zoneId;
    case 'RACK':
      return rackId != null && rackId === location.rackId;
    case 'RACK_LEVEL':
      return rackLevelId != null && rackLevelId === location.rackLevelId;
    case 'BIN':
      return binId != null && binId === location.binId;
    default:
      return false;
  }
}

/**
 * Score 0–1 for tenant + bin reservation alignment.
 */
export function scoreTenantReservation(bin, location, reservations) {
  const reservationType = bin.reservationType ?? bin.reservation_type ?? 'SHARED';
  const status = bin.status;
  if (status === 'BLOCKED' || status === 'FULL') {
    return 0;
  }

  if (!reservations?.length) {
    return reservationType === 'SHARED' ? 1 : 0.4;
  }

  const matches = reservations.some((r) => reservationCoversLocation(r, location));

  if (matches) {
    return 1;
  }

  if (reservationType === 'SHARED') {
    return 0.35;
  }

  return 0;
}

export function tenantCanUseBin(bin, location, reservations) {
  const reservationType = bin.reservationType ?? bin.reservation_type ?? 'SHARED';
  const score = scoreTenantReservation(bin, location, reservations);
  if (score >= 0.35) {
    return true;
  }
  return reservationType === 'SHARED' && score > 0;
}
