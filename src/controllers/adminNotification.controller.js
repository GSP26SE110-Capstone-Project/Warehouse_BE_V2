import * as adminNotificationService from '../services/adminNotification.service.js';
import { success } from '../utils/apiResponse.js';

export async function getGuestAccountAlerts(req, res) {
  const data = await adminNotificationService.getSystemAdminGuestAccountAlerts();
  success(res, data);
}

export async function getWhPendingRentalAlerts(req, res) {
  const data = await adminNotificationService.getWarehouseAdminPendingRentalAlerts(req.user);
  success(res, data);
}

export async function getWhPendingInboundAlerts(req, res) {
  const data = await adminNotificationService.getWarehouseAdminPendingInboundAlerts(req.user);
  success(res, data);
}

export async function getWhArrivedInboundAlerts(req, res) {
  const data = await adminNotificationService.getWarehouseAdminArrivedInboundAlerts(req.user);
  success(res, data);
}

export async function getWhContractPaymentAlerts(req, res) {
  const data = await adminNotificationService.getWarehouseAdminContractPaymentAlerts(req.user);
  success(res, data);
}

export async function getTransporterTripAlerts(req, res) {
  const data = await adminNotificationService.getTransporterAssignedTripAlerts(req.user);
  success(res, data);
}

export async function getTenantInboundTransportAlerts(req, res) {
  const data = await adminNotificationService.getTenantInboundTransportAlerts(req.user);
  success(res, data);
}
