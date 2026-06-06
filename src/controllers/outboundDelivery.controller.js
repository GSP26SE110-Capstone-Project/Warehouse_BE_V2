import * as outboundDeliveryService from '../services/outboundDelivery.service.js';
import { success } from '../utils/apiResponse.js';

export async function getByOutboundRequest(req, res) {
  const delivery = await outboundDeliveryService.getOutboundDeliveryByRequestId(
    req.params.outboundRequestId
  );
  success(res, delivery);
}

export async function upsert(req, res) {
  const delivery = await outboundDeliveryService.upsertOutboundDelivery(
    req.params.outboundRequestId,
    req.body,
    req.user
  );
  success(res, delivery, 'Delivery info saved');
}

export async function reportPickup(req, res) {
  const result = await outboundDeliveryService.reportOutboundPickup(
    req.params.outboundRequestId,
    req.user
  );
  success(res, result, 'Pickup reported');
}

export async function reportDelivery(req, res) {
  const result = await outboundDeliveryService.reportOutboundDelivery(
    req.params.outboundRequestId,
    req.user
  );
  success(res, result, 'Delivery reported');
}
