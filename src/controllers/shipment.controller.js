import * as shipmentService from '../services/shipment.service.js';
import { created, paginated, success } from '../utils/apiResponse.js';
import { parsePagination } from '../utils/validate.js';

export async function list(req, res) {
  const { page, limit, offset } = parsePagination(req.query);
  const { tenantId, outboundRequestId, status } = req.query;

  const result = await shipmentService.listShipments({
    tenantId,
    outboundRequestId,
    status,
    page,
    limit,
    offset,
  });

  paginated(res, result.items, result.meta);
}

export async function getById(req, res) {
  const shipment = await shipmentService.getShipment(req.params.shipmentId);
  success(res, shipment);
}

export async function create(req, res) {
  const shipment = await shipmentService.createShipment(req.body);
  created(res, shipment);
}

export async function update(req, res) {
  const shipment = await shipmentService.updateShipment(req.params.shipmentId, req.body);
  success(res, shipment, 'Updated successfully');
}

export async function remove(req, res) {
  const shipment = await shipmentService.deleteShipment(req.params.shipmentId);
  success(res, shipment, 'Deleted successfully');
}
