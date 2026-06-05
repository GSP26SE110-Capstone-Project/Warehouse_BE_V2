import pool from '../config/db.js';
import OutboundRequest from '../models/OutboundRequest.js';
import OutboundRequestItem from '../models/OutboundRequestItem.js';
import PickingTask from '../models/PickingTask.js';
import PickingTaskItem from '../models/PickingTaskItem.js';
import InventoryMovement from '../models/InventoryMovement.js';
import Lpn from '../models/Lpn.js';
import { reconcileBinOccupancyFromInventories } from './inventory.service.js';
import AppError from '../utils/AppError.js';
import { assertOutboundStatusTransition } from '../utils/outboundStatus.js';
import {
  WH_OUTBOUND_ROLES,
  TENANT_OUTBOUND_ROLES,
} from '../constants/outboundWorkflow.js';
import { parseUuid } from '../utils/validate.js';
import { assertOutboundInventorySufficient } from './outboundRequestItem.service.js';

async function loadOutboundRequest(outboundRequestId) {
  const id = parseUuid(outboundRequestId, 'outboundRequestId');
  const outbound = await OutboundRequest.findById(id);
  if (!outbound) {
    throw new AppError('Outbound request not found', 404, 'NOT_FOUND');
  }
  return outbound;
}

function assertWarehouseOutboundRole(actor, actionLabel) {
  if (!actor?.userId || !WH_OUTBOUND_ROLES.includes(actor.role)) {
    throw new AppError(
      `Only warehouse staff can ${actionLabel}`,
      403,
      'FORBIDDEN'
    );
  }
}

function actorUserId(actor) {
  if (!actor?.userId) {
    throw new AppError('Authentication required', 401, 'UNAUTHENTICATED');
  }
  return actor.userId;
}

async function fetchAvailableInventoryRows(client, tenantId, skuId, warehouseId) {
  const { rows } = await client.query(
    `SELECT i.inventory_id, i.available_quantity, i.reserved_quantity, i.quantity,
            i.lpn_id, i.bin_id, i.batch_id
     FROM inventories i
     INNER JOIN batches bat ON bat.batch_id = i.batch_id
     INNER JOIN bins b ON b.bin_id = i.bin_id
     INNER JOIN rack_levels rl ON rl.rack_level_id = b.rack_level_id
     INNER JOIN racks r ON r.rack_id = rl.rack_id
     INNER JOIN warehouse_zones z ON z.zone_id = r.zone_id
     WHERE i.tenant_id = $1
       AND i.sku_id = $2
       AND z.warehouse_id = $3
       AND i.status = 'AVAILABLE'
       AND i.available_quantity > 0
     ORDER BY i.received_at ASC NULLS LAST, bat.warehouse_received_at ASC NULLS LAST
     FOR UPDATE OF i`,
    [tenantId, skuId, warehouseId]
  );
  return rows;
}

async function reserveLine(client, outbound, line) {
  let remaining = line.requestedQuantity;
  const rows = await fetchAvailableInventoryRows(
    client,
    outbound.tenantId,
    line.skuId,
    outbound.warehouseId
  );

  const allocations = [];

  for (const row of rows) {
    if (remaining <= 0) break;
    const available = Number(row.available_quantity ?? 0);
    if (available <= 0) continue;

    const take = Math.min(remaining, available);
    const newReserved = Number(row.reserved_quantity ?? 0) + take;
    const newAvailable = available - take;

    await client.query(
      `UPDATE inventories
       SET reserved_quantity = $1,
           available_quantity = $2,
           updated_at = NOW()
       WHERE inventory_id = $3`,
      [newReserved, newAvailable, row.inventory_id]
    );

    allocations.push({
      inventoryId: row.inventory_id,
      lpnId: row.lpn_id,
      binId: row.bin_id,
      batchId: row.batch_id,
      quantity: take,
    });
    remaining -= take;
  }

  if (remaining > 0) {
    throw new AppError(
      `Insufficient inventory to reserve for SKU line (short by ${remaining})`,
      400,
      'INSUFFICIENT_INVENTORY'
    );
  }

  await client.query(
    `UPDATE outbound_request_items
     SET allocated_quantity = $1
     WHERE outbound_request_item_id = $2`,
    [line.requestedQuantity, line.outboundRequestItemId]
  );

  return allocations;
}

async function createPickingTaskWithReservations(client, outbound, actor) {
  const outboundRequestId = outbound.outboundRequestId;
  const existingTasks = await PickingTask.findAll({ outboundRequestId }, {}, client);
  if (existingTasks.length > 0) {
    throw new AppError('Picking task already exists for this outbound', 409, 'DUPLICATE');
  }

  const lines = await OutboundRequestItem.findAll({ outboundRequestId }, {}, client);
  if (lines.length === 0) {
    throw new AppError(
      'Outbound request must have at least one line item',
      400,
      'VALIDATION_ERROR'
    );
  }

  const pickingTask = await PickingTask.create(
    {
      outboundRequestId,
      assignedTo: actorUserId(actor),
      status: 'PENDING',
    },
    client
  );

  for (const line of lines) {
    const allocations = await reserveLine(client, outbound, line);
    for (const alloc of allocations) {
      await PickingTaskItem.create(
        {
          pickingTaskId: pickingTask.pickingTaskId,
          inventoryId: alloc.inventoryId,
          lpnId: alloc.lpnId,
          binId: alloc.binId,
          batchId: alloc.batchId,
          quantityToPick: alloc.quantity,
          pickedQuantity: 0,
        },
        client
      );
    }
  }

  return pickingTask;
}

/**
 * PENDING → APPROVED (approvedBy) + reserve FIFO + picking task → RESERVED (một transaction).
 */
export async function approveAndReserveOutbound(outboundRequestId, actor) {
  assertWarehouseOutboundRole(actor, 'approve outbound');
  const outbound = await loadOutboundRequest(outboundRequestId);

  if (outbound.status !== 'PENDING') {
    throw new AppError(
      `Only PENDING outbound can be approved (current: ${outbound.status})`,
      400,
      'INVALID_OUTBOUND_STATUS'
    );
  }

  await assertOutboundInventorySufficient(outboundRequestId);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await OutboundRequest.updateById(
      outboundRequestId,
      {
        status: 'APPROVED',
        approvedBy: actorUserId(actor),
      },
      client
    );

    const pickingTask = await createPickingTaskWithReservations(client, outbound, actor);

    const updated = await OutboundRequest.updateById(
      outboundRequestId,
      { status: 'RESERVED' },
      client
    );

    await client.query('COMMIT');
    return { outbound: updated, pickingTaskId: pickingTask.pickingTaskId };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/** Reserve + picking task khi đã APPROVED nhưng chưa có task (recovery). */
export async function reserveOutboundAndCreatePickingTask(outboundRequestId, actor) {
  assertWarehouseOutboundRole(actor, 'reserve inventory');
  const outbound = await loadOutboundRequest(outboundRequestId);

  if (outbound.status !== 'APPROVED') {
    throw new AppError(
      'Outbound must be APPROVED before reserving inventory (or use status APPROVED from PENDING)',
      400,
      'INVALID_OUTBOUND_STATUS'
    );
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const pickingTask = await createPickingTaskWithReservations(client, outbound, actor);
    const updated = await OutboundRequest.updateById(
      outboundRequestId,
      { status: 'RESERVED' },
      client
    );
    await client.query('COMMIT');
    return { outbound: updated, pickingTaskId: pickingTask.pickingTaskId };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function releaseReservationsForOutbound(client, outboundRequestId) {
  const { rows } = await client.query(
    `SELECT pti.picking_task_item_id, pti.quantity_to_pick, pti.picked_quantity, pti.inventory_id
     FROM picking_task_items pti
     INNER JOIN picking_tasks pt ON pt.picking_task_id = pti.picking_task_id
     WHERE pt.outbound_request_id = $1`,
    [outboundRequestId]
  );

  for (const row of rows) {
    const qty = Number(row.quantity_to_pick ?? 0);
    if (qty <= 0) continue;

    const invResult = await client.query(
      `SELECT reserved_quantity, available_quantity
       FROM inventories WHERE inventory_id = $1 FOR UPDATE`,
      [row.inventory_id]
    );
    if (invResult.rows.length === 0) continue;

    const reserved = Number(invResult.rows[0].reserved_quantity ?? 0);
    const available = Number(invResult.rows[0].available_quantity ?? 0);
    const release = Math.min(qty, reserved);

    await client.query(
      `UPDATE inventories
       SET reserved_quantity = $1,
           available_quantity = $2,
           updated_at = NOW()
       WHERE inventory_id = $3`,
      [reserved - release, available + release, row.inventory_id]
    );
  }

  await client.query(
    `UPDATE outbound_request_items oi
     SET allocated_quantity = 0, picked_quantity = 0
     FROM outbound_requests o
     WHERE o.outbound_request_id = oi.outbound_request_id
       AND o.outbound_request_id = $1`,
    [outboundRequestId]
  );
}

export async function releaseOutboundReservations(outboundRequestId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await releaseReservationsForOutbound(client, outboundRequestId);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function confirmPickingForOutbound(outboundRequestId, actor) {
  assertWarehouseOutboundRole(actor, 'confirm picking');
  const outbound = await loadOutboundRequest(outboundRequestId);

  if (!['RESERVED', 'PICKING'].includes(outbound.status)) {
    throw new AppError(
      'Outbound must be RESERVED or PICKING to confirm pick',
      400,
      'INVALID_OUTBOUND_STATUS'
    );
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: items } = await client.query(
      `SELECT pti.picking_task_item_id, pti.quantity_to_pick, pti.inventory_id
       FROM picking_task_items pti
       INNER JOIN picking_tasks pt ON pt.picking_task_id = pti.picking_task_id
       WHERE pt.outbound_request_id = $1`,
      [outboundRequestId]
    );

    if (items.length === 0) {
      throw new AppError('No picking task items found', 400, 'VALIDATION_ERROR');
    }

    for (const item of items) {
      const qty = Number(item.quantity_to_pick ?? 0);
      await client.query(
        `UPDATE picking_task_items SET picked_quantity = $1 WHERE picking_task_item_id = $2`,
        [qty, item.picking_task_item_id]
      );
    }

    const lines = await OutboundRequestItem.findAll({ outboundRequestId }, {}, client);
    for (const line of lines) {
      await client.query(
        `UPDATE outbound_request_items SET picked_quantity = allocated_quantity
         WHERE outbound_request_item_id = $1`,
        [line.outboundRequestItemId]
      );
    }

    await client.query(
      `UPDATE picking_tasks SET status = 'COMPLETED', updated_at = NOW()
       WHERE outbound_request_id = $1`,
      [outboundRequestId]
    );

    const updated = await OutboundRequest.updateById(
      outboundRequestId,
      { status: 'PACKING' },
      client
    );

    await client.query('COMMIT');
    return updated;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function shipOutbound(outboundRequestId, actor) {
  assertWarehouseOutboundRole(actor, 'ship outbound');
  const outbound = await loadOutboundRequest(outboundRequestId);

  if (outbound.status !== 'PACKING') {
    throw new AppError(
      'Outbound must be PACKING before shipping',
      400,
      'INVALID_OUTBOUND_STATUS'
    );
  }

  const movedBy = actorUserId(actor);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { rows: pickItems } = await client.query(
      `SELECT pti.*, l.lpn_code
       FROM picking_task_items pti
       INNER JOIN picking_tasks pt ON pt.picking_task_id = pti.picking_task_id
       INNER JOIN lpns l ON l.lpn_id = pti.lpn_id
       WHERE pt.outbound_request_id = $1`,
      [outboundRequestId]
    );

    if (pickItems.length === 0) {
      throw new AppError(
        'Reserve inventory and pick before shipping',
        400,
        'VALIDATION_ERROR'
      );
    }

    const affectedBinIds = new Set();

    for (const row of pickItems) {
      const qty = Number(row.picked_quantity ?? row.quantity_to_pick ?? 0);
      if (qty <= 0) continue;

      const invResult = await client.query(
        `SELECT quantity, reserved_quantity, available_quantity, bin_id, lpn_id
         FROM inventories WHERE inventory_id = $1 FOR UPDATE`,
        [row.inventory_id]
      );
      if (invResult.rows.length === 0) {
        throw new AppError('Inventory row not found for pick item', 404, 'NOT_FOUND');
      }

      const inv = invResult.rows[0];
      const quantity = Number(inv.quantity ?? 0);
      const reserved = Number(inv.reserved_quantity ?? 0);
      const deduct = Math.min(qty, quantity);
      const newQty = quantity - deduct;
      const newReserved = Math.max(0, reserved - deduct);
      const newAvailable = Math.max(0, newQty - newReserved);
      const newStatus = newQty <= 0 ? 'SHIPPED' : 'AVAILABLE';

      await client.query(
        `UPDATE inventories
         SET quantity = $1,
             reserved_quantity = $2,
             available_quantity = $3,
             status = $4,
             updated_at = NOW()
         WHERE inventory_id = $5`,
        [newQty, newReserved, newAvailable, newStatus, row.inventory_id]
      );

      if (inv.bin_id) {
        affectedBinIds.add(inv.bin_id);
      }

      if (newQty <= 0 && inv.lpn_id) {
        const stillInBin = await client.query(
          `SELECT 1 FROM inventories
            WHERE lpn_id = $1 AND bin_id = $2 AND quantity > 0
            LIMIT 1`,
          [inv.lpn_id, inv.bin_id]
        );
        if (stillInBin.rows.length === 0) {
          await Lpn.updateById(
            inv.lpn_id,
            { currentBinId: null, status: 'SHIPPED' },
            client
          );
        }
      }

      await InventoryMovement.create(
        {
          inventoryId: row.inventory_id,
          movementType: 'OUTBOUND',
          fromBinId: inv.bin_id,
          toBinId: null,
          quantity: deduct,
          movedBy,
          movedAt: new Date(),
          note: `Outbound ${outbound.outboundCode} ship LPN ${row.lpn_code}`,
        },
        client
      );
    }

    for (const binId of affectedBinIds) {
      await reconcileBinOccupancyFromInventories(binId, client);
    }

    const shippedAt = new Date();
    const updated = await OutboundRequest.updateById(
      outboundRequestId,
      { status: 'SHIPPED', actualShippedAt: shippedAt },
      client
    );

    await client.query('COMMIT');
    return updated;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function listPickingTasksForOutbound(outboundRequestId) {
  const id = parseUuid(outboundRequestId, 'outboundRequestId');
  const outbound = await loadOutboundRequest(id);

  const tasksResult = await pool.query(
    `SELECT pt.picking_task_id, pt.outbound_request_id, pt.assigned_to, pt.status,
            pt.created_at, pt.updated_at
     FROM picking_tasks pt
     WHERE pt.outbound_request_id = $1
     ORDER BY pt.created_at ASC`,
    [id]
  );

  if (tasksResult.rows.length === 0) {
    return {
      outboundRequestId: id,
      outboundStatus: outbound.status,
      hint:
        outbound.status === 'PENDING'
          ? 'Chưa duyệt — PATCH { "status": "APPROVED" } (WH token) để tạo picking task'
          : outbound.status === 'APPROVED'
            ? 'Đã APPROVED nhưng chưa reserve — PATCH { "status": "RESERVED" } để tạo picking task'
            : 'Chưa có picking task cho phiếu này',
      tasks: [],
    };
  }

  const tasks = [];
  for (const taskRow of tasksResult.rows) {
    const itemsResult = await pool.query(
      `SELECT pti.picking_task_item_id, pti.picking_task_id, pti.inventory_id,
              pti.lpn_id, pti.bin_id, pti.batch_id, pti.quantity_to_pick, pti.picked_quantity,
              l.lpn_code, b.bin_code, bat.batch_code
       FROM picking_task_items pti
       INNER JOIN lpns l ON l.lpn_id = pti.lpn_id
       INNER JOIN bins b ON b.bin_id = pti.bin_id
       INNER JOIN batches bat ON bat.batch_id = pti.batch_id
       WHERE pti.picking_task_id = $1
       ORDER BY l.lpn_code ASC`,
      [taskRow.picking_task_id]
    );

    tasks.push({
      pickingTaskId: taskRow.picking_task_id,
      outboundRequestId: taskRow.outbound_request_id,
      assignedTo: taskRow.assigned_to,
      status: taskRow.status,
      createdAt: taskRow.created_at,
      updatedAt: taskRow.updated_at,
      items: itemsResult.rows.map((row) => ({
        pickingTaskItemId: row.picking_task_item_id,
        pickingTaskId: row.picking_task_id,
        inventoryId: row.inventory_id,
        lpnId: row.lpn_id,
        binId: row.bin_id,
        batchId: row.batch_id,
        quantityToPick: row.quantity_to_pick,
        pickedQuantity: row.picked_quantity,
        lpnCode: row.lpn_code,
        binCode: row.bin_code,
        batchCode: row.batch_code,
      })),
    });
  }

  return {
    outboundRequestId: id,
    outboundStatus: outbound.status,
    tasks,
  };
}

export async function applyOutboundStatusChange(existing, nextStatus, actor, patchData = {}) {
  assertOutboundStatusTransition(existing.status, nextStatus);

  if (nextStatus === 'APPROVED') {
    await approveAndReserveOutbound(existing.outboundRequestId, actor);
    return { __fullyHandled: true };
  }

  if (nextStatus === 'RESERVED') {
    await reserveOutboundAndCreatePickingTask(existing.outboundRequestId, actor);
    return { __fullyHandled: true };
  }

  if (nextStatus === 'PICKING') {
    assertWarehouseOutboundRole(actor, 'start picking');
    await pool.query(
      `UPDATE picking_tasks SET status = 'PICKING', updated_at = NOW()
       WHERE outbound_request_id = $1`,
      [existing.outboundRequestId]
    );
    return { ...patchData, status: 'PICKING' };
  }

  if (nextStatus === 'PACKING') {
    await confirmPickingForOutbound(existing.outboundRequestId, actor);
    return { __fullyHandled: true };
  }

  if (nextStatus === 'SHIPPED') {
    await shipOutbound(existing.outboundRequestId, actor);
    return { __fullyHandled: true };
  }

  if (nextStatus === 'CANCELLED') {
    const isWh = actor && WH_OUTBOUND_ROLES.includes(actor.role);
    const isTenant = actor && TENANT_OUTBOUND_ROLES.includes(actor.role);
    if (!isWh && !isTenant) {
      throw new AppError('Forbidden', 403, 'FORBIDDEN');
    }
    if (
      isTenant &&
      !['DRAFT', 'PENDING'].includes(existing.status)
    ) {
      throw new AppError(
        'Tenant can only cancel DRAFT or PENDING outbound requests',
        403,
        'FORBIDDEN'
      );
    }
    if (['RESERVED', 'PICKING', 'PACKING'].includes(existing.status)) {
      await releaseOutboundReservations(existing.outboundRequestId);
    }
    return { ...patchData, status: 'CANCELLED', approvedBy: null };
  }

  return { ...patchData, status: nextStatus };
}
