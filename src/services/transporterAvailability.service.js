import pool from '../config/db.js';
import AppError from '../utils/AppError.js';
import { parseUuid } from '../utils/validate.js';

/**
 * WH_TRANSPORTER không được có đồng thời chuyến inbound hoặc outbound chưa hoàn thành.
 */
export async function assertTransporterAvailable(
  userId,
  warehouseId,
  { excludeInboundRequestId = null, excludeOutboundRequestId = null } = {}
) {
  const driverId = parseUuid(userId, 'assignedDriverUserId');
  const wId = parseUuid(warehouseId, 'warehouseId');

  const inboundValues = [driverId, wId];
  let inboundExclude = '';
  if (excludeInboundRequestId) {
    inboundValues.push(parseUuid(excludeInboundRequestId, 'inboundRequestId'));
    inboundExclude = `AND ir.inbound_request_id <> $${inboundValues.length}`;
  }

  const inboundBusy = await pool.query(
    `SELECT ir.inbound_code
     FROM inbound_deliveries id
     INNER JOIN inbound_requests ir ON ir.inbound_request_id = id.inbound_request_id
     WHERE id.assigned_driver_user_id = $1
       AND ir.warehouse_id = $2
       AND ir.delivery_mode = 'WAREHOUSE_TRANSPORT'
       AND ir.status IN ('PENDING', 'APPROVED', 'IN_TRANSIT')
       ${inboundExclude}
     LIMIT 1`,
    inboundValues
  );

  if (inboundBusy.rows[0]) {
    throw new AppError(
      `Transporter already has an active inbound trip (${inboundBusy.rows[0].inbound_code})`,
      409,
      'TRANSPORTER_HAS_ACTIVE_TRIP'
    );
  }

  const outboundValues = [driverId, wId];
  let outboundExclude = '';
  if (excludeOutboundRequestId) {
    outboundValues.push(parseUuid(excludeOutboundRequestId, 'outboundRequestId'));
    outboundExclude = `AND o.outbound_request_id <> $${outboundValues.length}`;
  }

  const outboundBusy = await pool.query(
    `SELECT o.outbound_code
     FROM outbound_deliveries od
     INNER JOIN outbound_requests o ON o.outbound_request_id = od.outbound_request_id
     WHERE od.assigned_driver_user_id = $1
       AND o.warehouse_id = $2
       AND o.delivery_mode = 'WAREHOUSE_TRANSPORT'
       AND o.status = 'SHIPPED'
       AND od.delivery_status IN ('ASSIGNED', 'IN_TRANSIT')
       ${outboundExclude}
     LIMIT 1`,
    outboundValues
  );

  if (outboundBusy.rows[0]) {
    throw new AppError(
      `Transporter already has an active outbound trip (${outboundBusy.rows[0].outbound_code})`,
      409,
      'TRANSPORTER_HAS_ACTIVE_OUTBOUND_TRIP'
    );
  }
}
