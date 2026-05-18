/**
 * Generate src/models/*.js from db4.md schema definitions.
 * Run: node scripts/generate-schema-models.mjs
 */
import { writeFileSync, mkdirSync, unlinkSync, existsSync } from 'fs';
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
const dr = (o = {}) => ({ type: 'decimal', required: true, ...o });
const b = (o = {}) => ({ type: 'boolean', required: false, ...o });
const dt = (o = {}) => ({ type: 'datetime', default: 'NOW()', ...o });
const da = (o = {}) => ({ type: 'date', required: false, ...o });
const dar = (o = {}) => ({ type: 'date', required: true, ...o });
const fk = (col, required = false) => ({
  type: 'string',
  required,
  foreignKey: col,
});
const en = (o = {}) => ({ type: 'string', required: false, ...o });

const models = [
  {
    name: 'TenantCompany',
    table: 'tenant_companies',
    schema: {
      tenantId: pk,
      companyName: sr(),
      companyCode: s({ unique: true }),
      taxCode: s({ unique: true }),
      contactName: s(),
      contactEmail: s(),
      contactPhone: s(),
      address: s(),
      status: en(),
      createdAt: dt(),
      updatedAt: dt({ default: undefined, required: false }),
    },
  },
  {
    name: 'Warehouse',
    table: 'warehouses',
    schema: {
      warehouseId: pk,
      warehouseCode: s({ required: true, unique: true }),
      warehouseName: sr(),
      address: s(),
      totalAreaM2: d(),
      usableAreaM2: d(),
      status: en(),
      createdAt: dt(),
      updatedAt: dt({ default: undefined, required: false }),
    },
  },
  {
    name: 'User',
    table: 'users',
    schema: {
      userId: pk,
      tenantId: fk('tenant_id'),
      warehouseId: fk('warehouse_id'),
      fullName: sr(),
      email: s({ required: true, unique: true }),
      passwordHash: sr(),
      phone: s(),
      role: en({ required: true }),
      status: en(),
      createdAt: dt(),
      updatedAt: dt({ default: undefined, required: false }),
    },
  },
  {
    name: 'WarehouseZone',
    table: 'warehouse_zones',
    schema: {
      zoneId: pk,
      warehouseId: fk('warehouse_id', true),
      zoneCode: sr(),
      zoneName: s(),
      zoneType: en(),
      areaM2: d(),
      isDedicated: b(),
      status: en(),
      createdAt: dt(),
      updatedAt: dt({ default: undefined, required: false }),
    },
  },
  {
    name: 'Rack',
    table: 'racks',
    schema: {
      rackId: pk,
      zoneId: fk('zone_id', true),
      rackCode: sr(),
      rackType: en(),
      maxLevels: n(),
      status: en(),
      createdAt: dt(),
      updatedAt: dt({ default: undefined, required: false }),
    },
  },
  {
    name: 'RackLevel',
    table: 'rack_levels',
    schema: {
      rackLevelId: pk,
      rackId: fk('rack_id', true),
      levelCode: s(),
      levelNumber: nr(),
      maxBins: n(),
      maxWeightKg: d(),
      heightCm: d(),
      levelPriority: n(),
      createdAt: dt(),
      updatedAt: dt({ default: undefined, required: false }),
    },
  },
  {
    name: 'Bin',
    table: 'bins',
    schema: {
      binId: pk,
      rackLevelId: fk('rack_level_id', true),
      binCode: sr(),
      supportedBoxType: en(),
      maxLpnCount: nr(),
      currentLpnCount: n(),
      maxVolumeUnits: nr(),
      usedVolumeUnits: n(),
      maxOwnerCount: n(),
      reservationType: en(),
      status: en(),
      createdAt: dt(),
      updatedAt: dt({ default: undefined, required: false }),
    },
  },
  {
    name: 'RentalRequest',
    table: 'rental_requests',
    schema: {
      rentalRequestId: pk,
      requestCode: s({ required: true, unique: true }),
      companyName: sr(),
      companyCode: s(),
      taxCode: s(),
      address: s(),
      contactName: s(),
      contactEmail: s(),
      contactPhone: s(),
      warehouseId: fk('warehouse_id', true),
      contractType: en(),
      pricingModel: en(),
      billingCycle: en(),
      estimatedVolume: d(),
      expectedStartDate: dt({ default: undefined, required: false }),
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
    name: 'Contract',
    table: 'contracts',
    schema: {
      contractId: pk,
      tenantId: fk('tenant_id', true),
      warehouseId: fk('warehouse_id', true),
      rentalRequestId: { ...fk('rental_request_id'), unique: true },
      contractCode: s({ required: true, unique: true }),
      contractName: s(),
      contractType: en({ required: true }),
      pricingModel: en({ required: true }),
      billingCycle: en(),
      allowDynamicRelocation: b(),
      autoRenew: b(),
      startDate: dar(),
      endDate: dar(),
      minimumBillingDays: n(),
      minimumReservedCapacity: d(),
      estimatedTotalAmount: d(),
      status: en(),
      tenantSignature: s(),
      warehouseSignature: s(),
      createdBy: fk('user_id'),
      approvedBy: fk('user_id'),
      createdAt: dt(),
      updatedAt: dt({ default: undefined, required: false }),
    },
  },
  {
    name: 'ContractItem',
    table: 'contract_items',
    schema: {
      contractItemId: pk,
      contractId: fk('contract_id', true),
      itemType: en({ required: true }),
      storageLevel: en(),
      billingUnit: en({ required: true }),
      quantity: d(),
      reservedQuantity: n(),
      boxType: en(),
      unitPrice: dr(),
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
      reservationType: en({ required: true }),
      storageLevel: en({ required: true }),
      warehouseId: fk('warehouse_id', true),
      zoneId: fk('zone_id'),
      rackId: fk('rack_id'),
      rackLevelId: fk('rack_level_id'),
      binId: fk('bin_id'),
      reservedCapacity: d(),
      boxType: en(),
      startDate: dar(),
      endDate: dar(),
      status: en(),
      createdAt: dt(),
      updatedAt: dt({ default: undefined, required: false }),
    },
  },
  {
    name: 'Category',
    table: 'categories',
    schema: {
      categoryId: pk,
      categoryName: sr(),
    },
  },
  {
    name: 'Collection',
    table: 'collections',
    schema: {
      collectionId: pk,
      tenantId: fk('tenant_id', true),
      collectionName: sr(),
    },
  },
  {
    name: 'Season',
    table: 'seasons',
    schema: {
      seasonId: pk,
      seasonName: sr(),
    },
  },
  {
    name: 'Sku',
    table: 'skus',
    schema: {
      skuId: pk,
      tenantId: fk('tenant_id', true),
      skuCode: sr(),
      productName: sr(),
      categoryId: fk('category_id'),
      collectionId: fk('collection_id'),
      seasonId: fk('season_id'),
      color: s(),
      size: s(),
      material: s(),
      movementCategory: en(),
      status: en(),
      createdAt: dt(),
      updatedAt: dt({ default: undefined, required: false }),
    },
  },
  {
    name: 'InboundRequest',
    table: 'inbound_requests',
    schema: {
      inboundRequestId: pk,
      tenantId: fk('tenant_id', true),
      contractId: fk('contract_id', true),
      warehouseId: fk('warehouse_id', true),
      inboundCode: s({ required: true, unique: true }),
      expectedArrivalDate: dt({ default: undefined, required: false }),
      actualArrivalAt: dt({ default: undefined, required: false }),
      status: en(),
      createdBy: fk('user_id'),
      approvedBy: fk('user_id'),
      receivedBy: fk('user_id'),
      createdAt: dt(),
      updatedAt: dt({ default: undefined, required: false }),
    },
  },
  {
    name: 'InboundRequestItem',
    table: 'inbound_request_items',
    schema: {
      inboundRequestItemId: pk,
      inboundRequestId: fk('inbound_request_id', true),
      skuId: fk('sku_id', true),
      expectedQuantity: nr(),
      receivedQuantity: n(),
      discrepancyQuantity: n(),
      createdAt: dt(),
    },
  },
  {
    name: 'Batch',
    table: 'batches',
    schema: {
      batchId: pk,
      inboundRequestId: fk('inbound_request_id', true),
      batchCode: s({ required: true, unique: true }),
      warehouseReceivedAt: dt({ default: undefined, required: true }),
      createdAt: dt(),
    },
  },
  {
    name: 'Lpn',
    table: 'lpns',
    schema: {
      lpnId: pk,
      tenantId: fk('tenant_id', true),
      batchId: fk('batch_id', true),
      lpnCode: s({ required: true, unique: true }),
      boxType: en({ required: true }),
      volumeUnits: nr(),
      maxCapacity: n(),
      actualQuantity: n(),
      fillPercentage: d(),
      currentBinId: fk('bin_id'),
      status: en(),
      createdAt: dt(),
      updatedAt: dt({ default: undefined, required: false }),
    },
  },
  {
    name: 'LpnDetail',
    table: 'lpn_details',
    schema: {
      lpnDetailId: pk,
      lpnId: fk('lpn_id', true),
      skuId: fk('sku_id', true),
      quantity: nr(),
    },
  },
  {
    name: 'Inventory',
    table: 'inventories',
    schema: {
      inventoryId: pk,
      tenantId: fk('tenant_id', true),
      skuId: fk('sku_id', true),
      batchId: fk('batch_id', true),
      lpnId: fk('lpn_id', true),
      binId: fk('bin_id', true),
      quantity: nr(),
      reservedQuantity: n(),
      availableQuantity: n(),
      status: en(),
      receivedAt: dt({ default: undefined, required: false }),
      createdAt: dt(),
      updatedAt: dt({ default: undefined, required: false }),
    },
  },
  {
    name: 'InventoryMovement',
    table: 'inventory_movements',
    schema: {
      movementId: pk,
      inventoryId: fk('inventory_id', true),
      movementType: en({ required: true }),
      fromBinId: fk('bin_id'),
      toBinId: fk('bin_id'),
      quantity: nr(),
      movedBy: fk('user_id'),
      movedAt: dt({ default: undefined, required: false }),
      note: s(),
    },
  },
  {
    name: 'OutboundRequest',
    table: 'outbound_requests',
    schema: {
      outboundRequestId: pk,
      tenantId: fk('tenant_id', true),
      contractId: fk('contract_id', true),
      warehouseId: fk('warehouse_id', true),
      outboundCode: s({ required: true, unique: true }),
      requestedShipDate: dt({ default: undefined, required: false }),
      actualShippedAt: dt({ default: undefined, required: false }),
      status: en(),
      createdBy: fk('user_id'),
      approvedBy: fk('user_id'),
      createdAt: dt(),
      updatedAt: dt({ default: undefined, required: false }),
    },
  },
  {
    name: 'OutboundRequestItem',
    table: 'outbound_request_items',
    schema: {
      outboundRequestItemId: pk,
      outboundRequestId: fk('outbound_request_id', true),
      skuId: fk('sku_id', true),
      requestedQuantity: nr(),
      allocatedQuantity: n(),
      pickedQuantity: n(),
    },
  },
  {
    name: 'PickingTask',
    table: 'picking_tasks',
    schema: {
      pickingTaskId: pk,
      outboundRequestId: fk('outbound_request_id', true),
      assignedTo: fk('user_id'),
      status: en(),
      createdAt: dt(),
      updatedAt: dt({ default: undefined, required: false }),
    },
  },
  {
    name: 'PickingTaskItem',
    table: 'picking_task_items',
    schema: {
      pickingTaskItemId: pk,
      pickingTaskId: fk('picking_task_id', true),
      inventoryId: fk('inventory_id', true),
      lpnId: fk('lpn_id', true),
      binId: fk('bin_id', true),
      batchId: fk('batch_id', true),
      quantityToPick: nr(),
      pickedQuantity: n(),
    },
  },
  {
    name: 'Shipment',
    table: 'shipments',
    schema: {
      shipmentId: pk,
      tenantId: fk('tenant_id', true),
      outboundRequestId: fk('outbound_request_id', true),
      shipmentCode: s({ unique: true }),
      carrierName: s(),
      trackingNumber: s(),
      status: en(),
      shippedAt: dt({ default: undefined, required: false }),
      deliveredAt: dt({ default: undefined, required: false }),
      createdAt: dt(),
      updatedAt: dt({ default: undefined, required: false }),
    },
  },
  {
    name: 'PricingPolicy',
    table: 'pricing_policies',
    schema: {
      pricingPolicyId: pk,
      warehouseId: fk('warehouse_id'),
      contractType: en(),
      storageLevel: en(),
      billingUnit: en({ required: true }),
      boxType: en(),
      price: dr(),
      effectiveFrom: dt({ default: undefined, required: false }),
      effectiveTo: dt({ default: undefined, required: false }),
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
      snapshotDate: dar(),
      storageLevel: en(),
      billingUnit: en({ required: true }),
      boxType: en(),
      occupiedCount: nr(),
      calculatedFee: dr(),
      createdAt: dt(),
    },
  },
  {
    name: 'Invoice',
    table: 'invoices',
    schema: {
      invoiceId: pk,
      tenantId: fk('tenant_id', true),
      contractId: fk('contract_id', true),
      invoiceCode: s({ required: true, unique: true }),
      billingStartDate: dar(),
      billingEndDate: dar(),
      subtotal: d(),
      tax: d(),
      totalAmount: d(),
      paymentStatus: en(),
      issuedAt: dt({ default: undefined, required: false }),
      dueDate: dt({ default: undefined, required: false }),
      createdAt: dt(),
      updatedAt: dt({ default: undefined, required: false }),
    },
  },
  {
    name: 'InvoiceItem',
    table: 'invoice_items',
    schema: {
      invoiceItemId: pk,
      invoiceId: fk('invoice_id', true),
      itemType: en({ required: true }),
      description: s(),
      referenceId: s(),
      quantity: dr(),
      unitPrice: dr(),
      totalPrice: dr(),
    },
  },
  {
    name: 'Payment',
    table: 'payments',
    schema: {
      paymentId: pk,
      invoiceId: fk('invoice_id', true),
      amount: dr(),
      paymentMethod: en(),
      paymentStatus: en(),
      transactionCode: s(),
      paidAt: dt({ default: undefined, required: false }),
      createdAt: dt(),
    },
  },
  {
    name: 'AiSlotRecommendation',
    table: 'ai_slot_recommendations',
    schema: {
      recommendationId: pk,
      inboundRequestId: fk('inbound_request_id'),
      lpnId: fk('lpn_id'),
      skuId: fk('sku_id'),
      recommendedZoneId: fk('zone_id'),
      recommendedBinId: fk('bin_id'),
      recommendationScore: d(),
      reason: s(),
      isApplied: b(),
      createdAt: dt(),
    },
  },
  {
    name: 'OccupancySnapshot',
    table: 'occupancy_snapshots',
    schema: {
      occupancySnapshotId: pk,
      warehouseId: fk('warehouse_id'),
      zoneId: fk('zone_id'),
      occupancyRate: d(),
      availableCapacity: n(),
      snapshotDate: da(),
      createdAt: dt(),
    },
  },
  {
    name: 'SkuMovementAnalytics',
    table: 'sku_movement_analytics',
    schema: {
      analyticsId: pk,
      skuId: fk('sku_id'),
      snapshotDate: da(),
      inboundQty: n(),
      outboundQty: n(),
      pickingCount: n(),
      averageStorageDays: d(),
      turnoverScore: d(),
      movementCategory: en(),
    },
  },
];

const removedModels = ['Role.js', 'UserRole.js'];

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

mkdirSync(modelsDir, { recursive: true });

for (const file of removedModels) {
  const path = join(modelsDir, file);
  if (existsSync(path)) unlinkSync(path);
}

for (const model of models) {
  writeFileSync(join(modelsDir, `${model.name}.js`), generateFile(model), 'utf8');
}

const indexContent = `export { default as BaseModel } from './BaseModel.js';
export { default as SchemaModel } from './SchemaModel.js';
export { default as defineModel } from './defineModel.js';

${models.map((m) => `export { default as ${m.name}, ${m.name.charAt(0).toLowerCase()}${m.name.slice(1)}Schema, tableName as ${m.name.charAt(0).toLowerCase()}${m.name.slice(1)}TableName } from './${m.name}.js';`).join('\n')}
`;

writeFileSync(join(modelsDir, 'index.js'), indexContent, 'utf8');
console.log(`Generated ${models.length} schema models + index.js (db4)`);
