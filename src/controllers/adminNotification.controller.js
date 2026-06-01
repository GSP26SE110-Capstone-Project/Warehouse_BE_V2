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
