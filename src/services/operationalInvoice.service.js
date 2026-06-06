import pool from '../config/db.js';
import Invoice from '../models/Invoice.js';
import AppError from '../utils/AppError.js';
import { parseUuid } from '../utils/validate.js';
import {
  INBOUND_LPN_PRICE_BY_BOX_TYPE,
  OUTBOUND_LPN_PRICE_BY_BOX_TYPE,
  WAREHOUSE_TRANSPORT_FEE_FLAT,
} from '../constants/pricingDefaults.js';
import { computeInvoiceDueDate } from '../utils/invoiceDueDate.js';
import { getContract } from './contract.service.js';
import { getInboundRequest } from './inboundRequest.service.js';
import { getOutboundRequest } from './outboundRequest.service.js';
import { computeInboundLpnEstimate } from '../utils/skuVolumeUnits.js';
import { getSku } from './sku.service.js';

function generateInvoiceCode() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.floor(Math.random() * 1000)
    .toString(36)
    .toUpperCase()
    .padStart(2, '0');
  return `INV-${ts}-${rand}`;
}

function toDateOnly(value) {
  const d = new Date(value);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export async function findOperationalInvoice(sourceType, sourceId) {
  const { rows } = await pool.query(
    `SELECT * FROM invoices
     WHERE source_type = $1 AND source_id = $2 AND invoice_category = 'OPERATIONAL'
     ORDER BY created_at DESC
     LIMIT 1`,
    [sourceType, parseUuid(sourceId, 'sourceId')]
  );
  if (!rows[0]) return null;
  return Invoice.findById(rows[0].invoice_id);
}

export async function assertOperationalInvoicePaid(sourceType, sourceId) {
  const inv = await findOperationalInvoice(sourceType, sourceId);
  if (!inv || inv.paymentStatus !== 'PAID') {
    throw new AppError(
      'Chưa thanh toán phụ phí — vui lòng thanh toán invoice vận hành trước khi tiếp tục',
      402,
      'OPERATIONAL_PAYMENT_REQUIRED'
    );
  }
  return inv;
}

async function insertOperationalInvoice({
  tenantId,
  contractId,
  sourceType,
  sourceId,
  totalAmount,
  lineItems,
  billingStart,
  billingEnd,
}) {
  const issuedAt = new Date();
  const due = computeInvoiceDueDate(issuedAt);
  const invoice = await Invoice.create({
    tenantId,
    contractId,
    invoiceCode: generateInvoiceCode(),
    billingStartDate: billingStart,
    billingEndDate: billingEnd,
    subtotal: totalAmount,
    tax: 0,
    totalAmount,
    paymentStatus: 'PENDING',
    invoiceCategory: 'OPERATIONAL',
    issuedAt,
    dueDate: due,
  });

  await pool.query(
    `UPDATE invoices SET source_type = $1, source_id = $2 WHERE invoice_id = $3`,
    [sourceType, sourceId, invoice.invoiceId]
  );

  for (const line of lineItems) {
    await pool.query(
      `INSERT INTO invoice_items (invoice_id, item_type, description, quantity, unit_price, total_price)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        invoice.invoiceId,
        line.itemType,
        line.description,
        line.quantity,
        line.unitPrice,
        line.totalPrice,
      ]
    );
  }

  return { ...invoice, sourceType, sourceId };
}

async function loadInboundItems(inboundRequestId) {
  const { rows } = await pool.query(
    `SELECT sku_id, expected_quantity FROM inbound_request_items WHERE inbound_request_id = $1`,
    [inboundRequestId]
  );
  return rows.map((r) => ({
    skuId: r.sku_id,
    expectedQuantity: Number(r.expected_quantity) || 0,
  }));
}

async function loadOutboundItems(outboundRequestId) {
  const { rows } = await pool.query(
    `SELECT sku_id, requested_quantity FROM outbound_request_items WHERE outbound_request_id = $1`,
    [outboundRequestId]
  );
  return rows.map((r) => ({
    skuId: r.sku_id,
    requestedQuantity: Number(r.requested_quantity) || 0,
  }));
}

export async function createOperationalInvoiceForInbound(inboundRequestId) {
  const id = parseUuid(inboundRequestId, 'inboundRequestId');
  const existing = await findOperationalInvoice('INBOUND_REQUEST', id);
  if (existing) return existing;

  const inbound = await getInboundRequest(id);
  const contract = await getContract(inbound.contractId);
  const items = await loadInboundItems(id);

  const skuCache = new Map();
  for (const item of items) {
    if (!skuCache.has(item.skuId)) {
      skuCache.set(item.skuId, await getSku(item.skuId));
    }
  }

  const assumedBoxType = 'MEDIUM';
  const lpnEstimate = await computeInboundLpnEstimate(items, skuCache, assumedBoxType);
  const lpnCount = Math.max(1, Number(lpnEstimate.estimatedLpnNeeded) || 1);

  const lineItems = [];
  let total = 0;

  const inboundUnit = INBOUND_LPN_PRICE_BY_BOX_TYPE[assumedBoxType];
  const inboundTotal = lpnCount * inboundUnit;
  lineItems.push({
    itemType: 'INBOUND',
    description: `Phí inbound ${lpnCount} LPN (${assumedBoxType})`,
    quantity: lpnCount,
    unitPrice: inboundUnit,
    totalPrice: inboundTotal,
  });
  total += inboundTotal;

  if (inbound.deliveryMode === 'WAREHOUSE_TRANSPORT') {
    lineItems.push({
      itemType: 'HANDLING',
      description: 'Phí vận chuyển kho (WAREHOUSE_TRANSPORT)',
      quantity: 1,
      unitPrice: WAREHOUSE_TRANSPORT_FEE_FLAT,
      totalPrice: WAREHOUSE_TRANSPORT_FEE_FLAT,
    });
    total += WAREHOUSE_TRANSPORT_FEE_FLAT;
  }

  const today = toDateOnly(new Date());
  return insertOperationalInvoice({
    tenantId: contract.tenantId,
    contractId: contract.contractId,
    sourceType: 'INBOUND_REQUEST',
    sourceId: id,
    totalAmount: total,
    lineItems,
    billingStart: today,
    billingEnd: today,
  });
}

export async function createOperationalInvoiceForOutbound(outboundRequestId) {
  const id = parseUuid(outboundRequestId, 'outboundRequestId');
  const existing = await findOperationalInvoice('OUTBOUND_REQUEST', id);
  if (existing) return existing;

  const outbound = await getOutboundRequest(id);
  const contract = await getContract(outbound.contractId);
  const items = await loadOutboundItems(id);

  const assumedBoxType = 'MEDIUM';
  const lpnCount = Math.max(
    1,
    items.reduce((sum, row) => sum + (Number(row.requestedQuantity) || 0), 0)
  );

  const lineItems = [];
  let total = 0;

  const outboundUnit = OUTBOUND_LPN_PRICE_BY_BOX_TYPE[assumedBoxType];
  const outboundTotal = lpnCount * outboundUnit;
  lineItems.push({
    itemType: 'OUTBOUND',
    description: `Phí outbound ${lpnCount} LPN (${assumedBoxType})`,
    quantity: lpnCount,
    unitPrice: outboundUnit,
    totalPrice: outboundTotal,
  });
  total += outboundTotal;

  if (outbound.deliveryMode === 'WAREHOUSE_TRANSPORT') {
    lineItems.push({
      itemType: 'HANDLING',
      description: 'Phí vận chuyển kho (WAREHOUSE_TRANSPORT)',
      quantity: 1,
      unitPrice: WAREHOUSE_TRANSPORT_FEE_FLAT,
      totalPrice: WAREHOUSE_TRANSPORT_FEE_FLAT,
    });
    total += WAREHOUSE_TRANSPORT_FEE_FLAT;
  }

  const today = toDateOnly(new Date());
  return insertOperationalInvoice({
    tenantId: contract.tenantId,
    contractId: contract.contractId,
    sourceType: 'OUTBOUND_REQUEST',
    sourceId: id,
    totalAmount: total,
    lineItems,
    billingStart: today,
    billingEnd: today,
  });
}

export async function getOperationalInvoiceForSource(sourceType, sourceId) {
  return findOperationalInvoice(sourceType, sourceId);
}
