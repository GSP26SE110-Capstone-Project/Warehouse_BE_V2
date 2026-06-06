import User from '../models/User.js';
import { sendOutboundPickerAssignedEmail, sendOutboundTransporterAssignedEmail } from '../config/mail.js';
import { buildWhStaffOutboundUrl, buildTransporterOutboundUrl } from '../utils/appUrl.js';
import { getTenantCompany } from './tenantCompany.service.js';
import { getWarehouseById } from './warehouse.service.js';

function formatDateVi(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('vi-VN');
}

/**
 * Thông báo WH Staff khi được gán pick outbound.
 * Không chặn luồng chính nếu gửi email thất bại.
 */
export async function notifyPickerAssigned({ outbound, assignedPickerUserId }) {
  if (!assignedPickerUserId) {
    return { sent: false, reason: 'NO_PICKER_ASSIGNED' };
  }

  const picker = await User.findById(assignedPickerUserId);
  if (!picker?.email) {
    return { sent: false, reason: 'NO_PICKER_EMAIL' };
  }

  const [tenant, warehouse] = await Promise.all([
    getTenantCompany(outbound.tenantId),
    getWarehouseById(outbound.warehouseId),
  ]);

  try {
    await sendOutboundPickerAssignedEmail({
      to: picker.email,
      pickerName: picker.fullName,
      outboundCode: outbound.outboundCode,
      requestedShipDate: formatDateVi(outbound.requestedShipDate),
      companyName: tenant.companyName,
      warehouseName: warehouse.warehouseName,
      outboundUrl: buildWhStaffOutboundUrl(outbound.outboundRequestId),
    });
    return { sent: true, to: picker.email };
  } catch (err) {
    return {
      sent: false,
      to: picker.email,
      error: err.message || 'Failed to send notification email',
    };
  }
}

export async function notifyOutboundDeliveryAssigned({ outbound, delivery }) {
  if (outbound?.deliveryMode !== 'WAREHOUSE_TRANSPORT' || !delivery?.assignedDriverUserId) {
    return { sent: false, reason: 'NOT_APPLICABLE' };
  }
  const driver = await User.findById(delivery.assignedDriverUserId);
  if (!driver?.email) return { sent: false, reason: 'NO_DRIVER_EMAIL' };
  try {
    await sendOutboundTransporterAssignedEmail({
      to: driver.email,
      driverName: driver.fullName,
      outboundCode: outbound.outboundCode,
      shipToAddress: delivery.shipToAddress ?? '—',
      tripUrl: buildTransporterOutboundUrl(outbound.outboundRequestId),
    });
    return { sent: true, to: driver.email };
  } catch (err) {
    return { sent: false, error: err.message };
  }
}

export async function notifyOutboundPickupReported({ outbound, delivery, actor }) {
  return { sent: false, reason: 'EMAIL_OPTIONAL' };
}

export async function notifyOutboundDelivered({ outbound, delivery, actor }) {
  return { sent: false, reason: 'EMAIL_OPTIONAL' };
}
