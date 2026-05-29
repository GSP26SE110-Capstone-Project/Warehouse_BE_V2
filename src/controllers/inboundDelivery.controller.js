import * as inboundDeliveryService from '../services/inboundDelivery.service.js';
import { assertInboundReadable } from '../utils/inboundAccess.js';
import { success } from '../utils/apiResponse.js';

export async function getByInboundRequest(req, res) {
  await assertInboundReadable(req.params.inboundRequestId, req.user);
  const delivery = await inboundDeliveryService.getInboundDeliveryByRequestId(
    req.params.inboundRequestId
  );
  success(res, delivery);
}

export async function upsert(req, res) {
  const delivery = await inboundDeliveryService.upsertInboundDelivery(
    req.params.inboundRequestId,
    req.body,
    req.user
  );
  success(res, delivery, 'Delivery info saved');
}

export async function remove(req, res) {
  const delivery = await inboundDeliveryService.deleteInboundDelivery(
    req.params.inboundRequestId,
    req.user
  );
  success(res, delivery, 'Delivery info removed');
}
