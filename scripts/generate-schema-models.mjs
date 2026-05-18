import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const modelsDir = join(__dirname, '../src/models');

const pk = { type: 'string', primaryKey: true };
const s = (o = {}) => ({ type: 'string', required: false, ...o });
const sr = (o = {}) => ({ type: 'string', required: true, ...o });
const n = (o = {}) => ({ type: 'number', required: false, ...o });
const nr = (o = {}) => ({ type: 'number', required: true, ...o });
const d = (o = {}) => ({ type: 'decimal', required: false, ...o });
const b = (o = {}) => ({ type: 'boolean', required: false, ...o });
const dt = (o = {}) => ({ type: 'datetime', default: 'NOW()', ...o });
const da = (o = {}) => ({ type: 'date', required: false, ...o });
const fk = (col, required = false) => ({
  type: 'string',
  required,
  foreignKey: col,
});
const en = (o = {}) => ({ type: 'string', required: false, ...o });

const models = [
  {
    name: 'Role',
    table: 'roles',
    schema: {
      roleId: pk,
      roleName: en({ required: true, unique: true }),
    },
  },
  {
    name: 'User',
    table: 'users',
    schema: {
      userId: pk,
      fullName: s(),
      email: s({ required: true, unique: true }),
      passwordHash: sr(),
      phone: s(),
      tenantId: fk('tenant_id'),
      warehouseId: fk('warehouse_id'),
      status: en(),
      createdAt: dt(),
      updatedAt: dt(),
    },
  },
  {
    name: 'UserRole',
    table: 'user_roles',
    schema: {
      userRoleId: pk,
      userId: fk('user_id', true),
      roleId: fk('role_id', true),
    },
  },
  {
    name: 'TenantCompany',
    table: 'tenant_companies',
    schema: {
      tenantId: pk,
      companyName: s(),
      companyCode: s({ unique: true }),
      taxCode: s(),
      address: s(),
      contactName: s(),
      contactPhone: s(),
      status: en(),
      createdAt: dt(),
    },
  },
  {
    name: 'RentalRequest',
    table: 'rental_requests',
    schema: {
      rentalRequestId: pk,
      requestCode: s({ unique: true }),
      companyName: s(),
      companyCode: s(),
      taxCode: s(),
      address: s(),
      contactName: s(),
      contactPhone: s(),
      contactEmail: s(),
      warehouseId: fk('warehouse_id', true),
      contractType: en(),
      pricingModel: en(),
      billingCycle: en(),
      requestedCapacity: d(),
      notes: s(),
      status: en(),
      reviewedBy: fk('user_id'),
      reviewedAt: dt({ default: undefined, required: false }),
      rejectionReason: s(),
      createdBy: fk('user_id'),
      createdAt: dt(),
      updatedAt: dt({ default: undefined, required: false }),
    },
  },
  {
    name: 'Warehouse',
    table: 'warehouses',
    schema: {
      warehouseId: pk,
      warehouseCode: s({ unique: true }),
      warehouseName: s(),
      address: s(),
      totalAreaM2: d(),
      status: en(),
      createdAt: dt(),
    },
  },
  {
    name: 'WarehouseZone',
    table: 'warehouse_zones',
    schema: {
      zoneId: pk,
      warehouseId: fk('warehouse_id', true),
      zoneCode: s(),
      zoneName: s(),
      zoneType: en(),
      areaM2: d(),
      status: en(),
      createdAt: dt(),
    },
  },
  {
    name: 'Rack',
    table: 'racks',
    schema: {
      rackId: pk,
      zoneId: fk('zone_id', true),
      rackCode: s(),
      rackType: en(),
      status: en(),
      createdAt: dt(),
    },
  },
  {
    name: 'RackLevel',
    table: 'rack_levels',
    schema: {
      rackLevelId: pk,
      rackId: fk('rack_id', true),
      levelNumber: n(),
      maxBins: n(),
      maxWeight: d(),
      heightCm: d(),
      createdAt: dt(),
    },
  },
  {
    name: 'Bin',
    table: 'bins',
    schema: {
      binId: pk,
      rackLevelId: fk('rack_level_id', true),
      binCode: s(),
      capacitySmall: d(),
      capacityMedium: d(),
      capacityLarge: d(),
      capacityExtra: d(),
      currentOccupiedCapacity: d(),
      status: en(),
      createdAt: dt(),
    },
  },
  {
    name: 'Category',
    table: 'categories',
    schema: {
      categoryId: pk,
      categoryName: s(),
    },
  },
  {
    name: 'Collection',
    table: 'collections',
    schema: {
      collectionId: pk,
      collectionName: s(),
    },
  },
  {
    name: 'Season',
    table: 'seasons',
    schema: {
      seasonId: pk,
      seasonName: s(),
    },
  },
  {
    name: 'Sku',
    table: 'skus',
    schema: {
      skuId: pk,
      tenantId: fk('tenant_id', true),
      skuCode: s({ unique: true }),
      productName: s(),
      categoryId: fk('category_id'),
      collectionId: fk('collection_id'),
      seasonId: fk('season_id'),
      color: s(),
      size: s(),
      material: s(),
      boxType: en(),
      status: en(),
      createdAt: dt(),
    },
  },
  {
    name: 'Contract',
    table: 'contracts',
    schema: {
      contractId: pk,
      contractCode: s({ unique: true }),
      tenantId: fk('tenant_id', true),
      warehouseId: fk('warehouse_id', true),
      rentalRequestId: { ...fk('rental_request_id'), unique: true },
      contractName: s(),
      contractType: en(),
      pricingModel: en(),
      startDate: dt({ default: undefined, required: false }),
      endDate: dt({ default: undefined, required: false }),
      billingCycle: en(),
      autoRenew: b(),
      minimumReservedCapacity: d(),
      status: en(),
      createdBy: fk('user_id'),
      approvedBy: fk('user_id'),
      tenantSignature: s(),
      warehouseSignature: s(),
      createdAt: dt(),
    },
  },
  {
    name: 'ContractItem',
    table: 'contract_items',
    schema: {
      contractItemId: pk,
      contractId: fk('contract_id', true),
      itemType: en(),
      storageLevel: en(),
      quantity: d(),
      unitPrice: d(),
      billingType: en(),
      createdAt: dt(),
    },
  },
  {
    name: 'StorageReservation',
    table: 'storage_reservations',
    schema: {
      reservationId: pk,
      contractId: fk('contract_id', true),
      tenantId: fk('tenant_id', true),
      reservationType: en(),
      storageLevel: en(),
      warehouseId: fk('warehouse_id'),
      zoneId: fk('zone_id'),
      rackId: fk('rack_id'),
      rackLevelId: fk('rack_level_id'),
      binId: fk('bin_id'),
      reservedCapacity: d(),
      startDate: dt({ default: undefined, required: false }),
      endDate: dt({ default: undefined, required: false }),
      status: en(),
      createdAt: dt(),
    },
  },
  {
    name: 'InboundRequest',
    table: 'inbound_requests',
    schema: {
      inboundRequestId: pk,
      tenantId: fk('tenant_id', true),
      contractId: fk('contract_id', true),
      requestCode: s({ unique: true }),
      expectedArrivalDate: dt({ default: undefined, required: false }),
      actualArrivalDate: dt({ default: undefined, required: false }),
      status: en(),
      createdBy: fk('user_id'),
      createdAt: dt(),
    },
  },
  {
    name: 'InboundRequestItem',
    table: 'inbound_request_items',
    schema: {
      inboundRequestItemId: pk,
      inboundRequestId: fk('inbound_request_id', true),
      skuId: fk('sku_id', true),
      expectedQuantity: n(),
      receivedQuantity: n(),
    },
  },
  {
    name: 'Batch',
    table: 'batches',
    schema: {
      batchId: pk,
      inboundRequestId: fk('inbound_request_id'),
      batchCode: s(),
      receivedDate: dt({ default: undefined, required: false }),
      createdAt: dt(),
    },
  },
  {
    name: 'Lpn',
    table: 'lpns',
    schema: {
      lpnId: pk,
      batchId: fk('batch_id'),
      lpnCode: s({ unique: true }),
      tenantId: fk('tenant_id', true),
      boxType: en(),
      currentBinId: fk('bin_id'),
      status: en(),
      createdAt: dt(),
    },
  },
  {
    name: 'LpnDetail',
    table: 'lpn_details',
    schema: {
      lpnDetailId: pk,
      lpnId: fk('lpn_id', true),
      skuId: fk('sku_id', true),
      quantity: n(),
    },
  },
  {
    name: 'Inventory',
    table: 'inventories',
    schema: {
      inventoryId: pk,
      tenantId: fk('tenant_id', true),
      skuId: fk('sku_id', true),
      batchId: fk('batch_id'),
      lpnId: fk('lpn_id'),
      binId: fk('bin_id'),
      quantity: n(),
      inventoryStatus: en(),
      receivedAt: dt({ default: undefined, required: false }),
      updatedAt: dt(),
    },
  },
  {
    name: 'InventoryMovement',
    table: 'inventory_movements',
    schema: {
      movementId: pk,
      inventoryId: fk('inventory_id', true),
      fromBinId: fk('bin_id'),
      toBinId: fk('bin_id'),
      movementType: en(),
      quantity: n(),
      createdBy: fk('user_id'),
      createdAt: dt(),
    },
  },
  {
    name: 'OutboundRequest',
    table: 'outbound_requests',
    schema: {
      outboundRequestId: pk,
      tenantId: fk('tenant_id', true),
      contractId: fk('contract_id', true),
      requestCode: s({ unique: true }),
      requestedShipDate: dt({ default: undefined, required: false }),
      status: en(),
      createdBy: fk('user_id'),
      createdAt: dt(),
    },
  },
  {
    name: 'OutboundRequestItem',
    table: 'outbound_request_items',
    schema: {
      outboundRequestItemId: pk,
      outboundRequestId: fk('outbound_request_id', true),
      skuId: fk('sku_id', true),
      requestedQuantity: n(),
      allocatedQuantity: n(),
    },
  },
  {
    name: 'PickingTask',
    table: 'picking_tasks',
    schema: {
      pickingTaskId: pk,
      outboundRequestId: fk('outbound_request_id'),
      assignedTo: fk('user_id'),
      status: en(),
      createdAt: dt(),
    },
  },
  {
    name: 'PickingTaskItem',
    table: 'picking_task_items',
    schema: {
      pickingTaskItemId: pk,
      pickingTaskId: fk('picking_task_id', true),
      inventoryId: fk('inventory_id'),
      pickedQuantity: n(),
    },
  },
  {
    name: 'Shipment',
    table: 'shipments',
    schema: {
      shipmentId: pk,
      outboundRequestId: fk('outbound_request_id'),
      shipmentCode: s(),
      shippedAt: dt({ default: undefined, required: false }),
      status: en(),
    },
  },
  {
    name: 'PricingPolicy',
    table: 'pricing_policies',
    schema: {
      pricingPolicyId: pk,
      warehouseId: fk('warehouse_id'),
      storageLevel: en(),
      pricingMethod: en(),
      unit: en(),
      boxType: en(),
      price: d(),
      createdAt: dt(),
    },
  },
  {
    name: 'StorageUsageSnapshot',
    table: 'storage_usage_snapshots',
    schema: {
      snapshotId: pk,
      tenantId: fk('tenant_id', true),
      contractId: fk('contract_id', true),
      snapshotDate: da(),
      boxType: en(),
      occupiedCount: n(),
      calculatedFee: d(),
      createdAt: dt(),
    },
  },
  {
    name: 'Invoice',
    table: 'invoices',
    schema: {
      invoiceId: pk,
      contractId: fk('contract_id', true),
      tenantId: fk('tenant_id', true),
      invoiceCode: s({ unique: true }),
      billingPeriodStart: dt({ default: undefined, required: false }),
      billingPeriodEnd: dt({ default: undefined, required: false }),
      subtotal: d(),
      tax: d(),
      totalAmount: d(),
      paymentStatus: en(),
      issuedAt: dt({ default: undefined, required: false }),
      dueDate: dt({ default: undefined, required: false }),
    },
  },
  {
    name: 'InvoiceItem',
    table: 'invoice_items',
    schema: {
      invoiceItemId: pk,
      invoiceId: fk('invoice_id', true),
      itemType: en(),
      description: s(),
      quantity: d(),
      unitPrice: d(),
      totalPrice: d(),
    },
  },
  {
    name: 'Payment',
    table: 'payments',
    schema: {
      paymentId: pk,
      invoiceId: fk('invoice_id', true),
      paymentMethod: en(),
      amount: d(),
      paymentStatus: en(),
      paidAt: dt({ default: undefined, required: false }),
    },
  },
  {
    name: 'AiSlotRecommendation',
    table: 'ai_slot_recommendations',
    schema: {
      recommendationId: pk,
      inboundRequestId: fk('inbound_request_id'),
      recommendedBinId: fk('bin_id'),
      recommendationScore: d(),
      reason: s(),
      createdAt: dt(),
    },
  },
  {
    name: 'OccupancySnapshot',
    table: 'occupancy_snapshots',
    schema: {
      occupancySnapshotId: pk,
      warehouseId: fk('warehouse_id'),
      snapshotDate: da(),
      occupancyRate: d(),
      createdAt: dt(),
    },
  },
];

function formatField(key, def) {
  const lines = [`  ${key}: {`];
  for (const [k, v] of Object.entries(def)) {
    if (v === undefined) continue;
    if (typeof v === 'string') {
      lines.push(`    ${k}: '${v}',`);
    } else if (typeof v === 'boolean' || typeof v === 'number') {
      lines.push(`    ${k}: ${v},`);
    }
  }
  lines.push('  },');
  return lines.join('\n');
}

function generateFile({ name, table, schema }) {
  const schemaVar = `${name.charAt(0).toLowerCase()}${name.slice(1)}Schema`;
  const fields = Object.entries(schema)
    .map(([key, def]) => formatField(key, def))
    .join('\n');

  return `import defineModel from './defineModel.js';

export const ${schemaVar} = {
${fields}
};

export const tableName = '${table}';

const ${name} = defineModel(tableName, ${schemaVar});

export { ${name} };
export default ${name};
`;
}

for (const model of models) {
  writeFileSync(join(modelsDir, `${model.name}.js`), generateFile(model), 'utf8');
}

const indexContent = `export { default as BaseModel } from './BaseModel.js';
export { default as SchemaModel } from './SchemaModel.js';
export { default as defineModel } from './defineModel.js';

export { default as Branch, branchSchema, tableName as branchTableName } from './Branch.js';
${models.map((m) => `export { default as ${m.name}, ${m.name.charAt(0).toLowerCase()}${m.name.slice(1)}Schema, tableName as ${m.name.charAt(0).toLowerCase()}${m.name.slice(1)}TableName } from './${m.name}.js';`).join('\n')}
`;

writeFileSync(join(modelsDir, 'index.js'), indexContent, 'utf8');
console.log(`Generated ${models.length} schema models + index.js`);
