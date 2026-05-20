/**
 * OpenAPI 3.0 — Warehouse Structure APIs (Flow 2)
 * Served at GET /api-docs
 */

const uuid = { type: 'string', format: 'uuid' };

const errorResponse = {
  type: 'object',
  required: ['success', 'message', 'code'],
  properties: {
    success: { type: 'boolean', example: false },
    message: { type: 'string' },
    code: {
      type: 'string',
      enum: [
        'VALIDATION_ERROR',
        'NOT_FOUND',
        'DUPLICATE',
        'FK_VIOLATION',
        'INVALID_ID',
        'INTERNAL_ERROR',
        'DB_UNAVAILABLE',
      ],
    },
    errors: { type: 'object', nullable: true },
  },
};

const paginationMeta = {
  type: 'object',
  properties: {
    page: { type: 'integer', example: 1 },
    limit: { type: 'integer', example: 20 },
    total: { type: 'integer', example: 42 },
    totalPages: { type: 'integer', example: 3 },
  },
};

function successEnvelope(dataSchema, description = 'Success') {
  return {
    description,
    content: {
      'application/json': {
        schema: {
          type: 'object',
          required: ['success', 'message', 'data'],
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Success' },
            data: dataSchema,
          },
        },
      },
    },
  };
}

function paginatedEnvelope(itemSchema) {
  return {
    description: 'Paginated list',
    content: {
      'application/json': {
        schema: {
          type: 'object',
          required: ['success', 'message', 'data', 'meta'],
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Success' },
            data: { type: 'array', items: itemSchema },
            meta: { $ref: '#/components/schemas/PaginationMeta' },
          },
        },
      },
    },
  };
}

const stdErrors = {
  400: {
    description: 'Validation error or bad request',
    content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
  },
  401: {
    description: 'Unauthorized',
    content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
  },
  403: {
    description: 'Forbidden',
    content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
  },
  404: {
    description: 'Resource not found',
    content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
  },
  409: {
    description: 'Duplicate key',
    content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
  },
};

const bearerSecurity = [{ bearerAuth: [] }];

const timestamps = {
  createdAt: { type: 'string', format: 'date-time' },
  updatedAt: { type: 'string', format: 'date-time', nullable: true },
};

const spec = {
  openapi: '3.0.0',
  info: {
    title: 'Smart Warehouse API',
    version: '1.0.0',
    description:
      'NextGen Warehouse backend — Flow 2: Warehouse structure (flat REST).\n\n' +
      '- **POST**: parent ID in body (`warehouseId`, `zoneId`, `rackId`, `rackLevelId`)\n' +
      '- **GET list**: parent ID in query\n' +
      '- **GET/PATCH/DELETE**: resource ID in path only\n\n' +
      '### Authentication & users\n' +
      '- `POST /api/auth/login` — public\n' +
      '- `POST /api/users` — Bearer token; hierarchy: SYSTEM_ADMIN → WH_ADMIN/TENANT_ADMIN; WH_ADMIN → WH_STAFF; TENANT_ADMIN → TENANT_STAFF',
  },
  servers: [{ url: 'http://localhost:3000', description: 'Local development' }],
  tags: [
    { name: 'System', description: 'Health check' },
    { name: 'Auth', description: 'Login' },
    { name: 'User', description: 'User management (admin roles)' },
    { name: 'Warehouse', description: 'Warehouses' },
    { name: 'Zone', description: 'Warehouse zones' },
    { name: 'Rack', description: 'Racks' },
    { name: 'RackLevel', description: 'Rack levels' },
    { name: 'Bin', description: 'Storage bins' },
    { name: 'LPN', description: 'License plate numbers / cartons (inbound)' },
    { name: 'RentalRequest', description: 'Tenant rental requests (Flow 1)' },
    { name: 'TenantCompany', description: 'Tenant companies (Flow 1)' },
    { name: 'Contract', description: 'Tenant contracts (Flow 1)' },
    { name: 'ContractItem', description: 'Contract line items (Flow 1)' },
    { name: 'StorageReservation', description: 'Storage reservations (Flow 1)' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      ErrorResponse: errorResponse,
      PaginationMeta: paginationMeta,

      Warehouse: {
        type: 'object',
        properties: {
          warehouseId: uuid,
          warehouseCode: { type: 'string', example: 'WH-HCM-01' },
          warehouseName: { type: 'string', example: 'Kho HCM Trung tâm' },
          address: { type: 'string', nullable: true },
          totalAreaM2: { type: 'number', nullable: true },
          usableAreaM2: { type: 'number', nullable: true },
          status: {
            type: 'string',
            enum: ['ACTIVE', 'INACTIVE', 'MAINTENANCE', 'CLOSED'],
          },
          ...timestamps,
        },
      },
      WarehouseCreate: {
        type: 'object',
        required: ['warehouseCode', 'warehouseName'],
        properties: {
          warehouseCode: { type: 'string' },
          warehouseName: { type: 'string' },
          address: { type: 'string' },
          totalAreaM2: { type: 'number' },
          usableAreaM2: { type: 'number' },
          status: {
            type: 'string',
            enum: ['ACTIVE', 'INACTIVE', 'MAINTENANCE', 'CLOSED'],
            default: 'ACTIVE',
          },
        },
      },
      WarehouseUpdate: {
        type: 'object',
        properties: {
          warehouseName: { type: 'string' },
          address: { type: 'string' },
          totalAreaM2: { type: 'number' },
          usableAreaM2: { type: 'number' },
          status: {
            type: 'string',
            enum: ['ACTIVE', 'INACTIVE', 'MAINTENANCE', 'CLOSED'],
          },
        },
      },

      WarehouseZone: {
        type: 'object',
        properties: {
          zoneId: uuid,
          warehouseId: uuid,
          zoneCode: { type: 'string', example: 'Z-A01' },
          zoneName: { type: 'string', nullable: true },
          zoneType: {
            type: 'string',
            enum: ['SHARED', 'FAST_MOVING', 'BULK', 'PREMIUM', 'QC', 'RETURN'],
          },
          areaM2: { type: 'number', nullable: true },
          isDedicated: { type: 'boolean' },
          status: { type: 'string', enum: ['ACTIVE', 'BLOCKED'] },
          ...timestamps,
        },
      },
      ZoneCreate: {
        type: 'object',
        required: ['warehouseId', 'zoneCode'],
        properties: {
          warehouseId: uuid,
          zoneCode: { type: 'string' },
          zoneName: { type: 'string' },
          zoneType: {
            type: 'string',
            enum: ['SHARED', 'FAST_MOVING', 'BULK', 'PREMIUM', 'QC', 'RETURN'],
            default: 'SHARED',
          },
          areaM2: { type: 'number' },
          isDedicated: { type: 'boolean', default: false },
          status: { type: 'string', enum: ['ACTIVE', 'BLOCKED'], default: 'ACTIVE' },
        },
      },
      ZoneUpdate: {
        type: 'object',
        properties: {
          zoneName: { type: 'string' },
          zoneType: {
            type: 'string',
            enum: ['SHARED', 'FAST_MOVING', 'BULK', 'PREMIUM', 'QC', 'RETURN'],
          },
          areaM2: { type: 'number' },
          isDedicated: { type: 'boolean' },
          status: { type: 'string', enum: ['ACTIVE', 'BLOCKED'] },
        },
      },

      Rack: {
        type: 'object',
        properties: {
          rackId: uuid,
          zoneId: uuid,
          rackCode: { type: 'string', example: 'R-A01-01' },
          rackType: { type: 'string', enum: ['STANDARD', 'HIGH_CAPACITY'] },
          maxLevels: { type: 'integer', nullable: true },
          status: { type: 'string', enum: ['ACTIVE', 'BLOCKED'] },
          ...timestamps,
        },
      },
      RackCreate: {
        type: 'object',
        required: ['zoneId', 'rackCode'],
        properties: {
          zoneId: uuid,
          rackCode: { type: 'string' },
          rackType: {
            type: 'string',
            enum: ['STANDARD', 'HIGH_CAPACITY'],
            default: 'STANDARD',
          },
          maxLevels: { type: 'integer', minimum: 1 },
          status: { type: 'string', enum: ['ACTIVE', 'BLOCKED'], default: 'ACTIVE' },
        },
      },
      RackUpdate: {
        type: 'object',
        properties: {
          rackType: { type: 'string', enum: ['STANDARD', 'HIGH_CAPACITY'] },
          maxLevels: { type: 'integer', minimum: 1 },
          status: { type: 'string', enum: ['ACTIVE', 'BLOCKED'] },
        },
      },

      RackLevel: {
        type: 'object',
        properties: {
          rackLevelId: uuid,
          rackId: uuid,
          levelCode: { type: 'string', nullable: true },
          levelNumber: { type: 'integer', example: 1 },
          maxBins: { type: 'integer', nullable: true },
          maxWeightKg: { type: 'number', nullable: true },
          heightCm: { type: 'number', nullable: true },
          levelPriority: { type: 'integer', nullable: true },
          ...timestamps,
        },
      },
      RackLevelCreate: {
        type: 'object',
        required: ['rackId', 'levelNumber'],
        properties: {
          rackId: uuid,
          levelCode: { type: 'string' },
          levelNumber: { type: 'integer', minimum: 1 },
          maxBins: { type: 'integer', minimum: 0 },
          maxWeightKg: { type: 'number', minimum: 0 },
          heightCm: { type: 'number', minimum: 0 },
          levelPriority: { type: 'integer', minimum: 0 },
        },
      },
      RackLevelUpdate: {
        type: 'object',
        properties: {
          levelCode: { type: 'string' },
          maxBins: { type: 'integer', minimum: 0 },
          maxWeightKg: { type: 'number', minimum: 0 },
          heightCm: { type: 'number', minimum: 0 },
          levelPriority: { type: 'integer', minimum: 0 },
        },
      },

      Bin: {
        type: 'object',
        properties: {
          binId: uuid,
          rackLevelId: uuid,
          binCode: { type: 'string', example: 'B-A01-L1-01' },
          supportedBoxType: {
            type: 'string',
            enum: ['SMALL', 'MEDIUM', 'LARGE', 'EXTRA'],
            nullable: true,
          },
          maxLpnCount: { type: 'integer' },
          currentLpnCount: { type: 'integer', default: 0 },
          maxVolumeUnits: { type: 'integer' },
          usedVolumeUnits: { type: 'integer', default: 0 },
          maxOwnerCount: { type: 'integer', default: 3 },
          reservationType: {
            type: 'string',
            enum: ['SHARED', 'RESERVED', 'DEDICATED'],
          },
          status: {
            type: 'string',
            enum: ['EMPTY', 'PARTIAL', 'FULL', 'RESERVED', 'BLOCKED'],
          },
          ...timestamps,
        },
      },
      BinCreate: {
        type: 'object',
        required: ['rackLevelId', 'binCode', 'maxLpnCount', 'maxVolumeUnits'],
        properties: {
          rackLevelId: uuid,
          binCode: { type: 'string' },
          supportedBoxType: {
            type: 'string',
            enum: ['SMALL', 'MEDIUM', 'LARGE', 'EXTRA'],
          },
          maxLpnCount: { type: 'integer', minimum: 1 },
          maxVolumeUnits: { type: 'integer', minimum: 1 },
          maxOwnerCount: { type: 'integer', minimum: 1, default: 3 },
          reservationType: {
            type: 'string',
            enum: ['SHARED', 'RESERVED', 'DEDICATED'],
            default: 'SHARED',
          },
          status: {
            type: 'string',
            enum: ['EMPTY', 'PARTIAL', 'FULL', 'RESERVED', 'BLOCKED'],
            default: 'EMPTY',
          },
        },
      },
      BinUpdate: {
        type: 'object',
        properties: {
          supportedBoxType: {
            type: 'string',
            enum: ['SMALL', 'MEDIUM', 'LARGE', 'EXTRA'],
          },
          maxLpnCount: { type: 'integer', minimum: 1 },
          maxVolumeUnits: { type: 'integer', minimum: 1 },
          maxOwnerCount: { type: 'integer', minimum: 1 },
          reservationType: {
            type: 'string',
            enum: ['SHARED', 'RESERVED', 'DEDICATED'],
          },
          status: {
            type: 'string',
            enum: ['EMPTY', 'PARTIAL', 'FULL', 'RESERVED', 'BLOCKED'],
          },
        },
      },

      Lpn: {
        type: 'object',
        properties: {
          lpnId: uuid,
          tenantId: uuid,
          batchId: uuid,
          lpnCode: { type: 'string', example: 'LPN-2026-00001' },
          boxType: {
            type: 'string',
            enum: ['SMALL', 'MEDIUM', 'LARGE', 'EXTRA'],
          },
          volumeUnits: {
            type: 'integer',
            description: 'SMALL=1, MEDIUM=2, LARGE=4, EXTRA=8',
          },
          maxCapacity: { type: 'integer', nullable: true },
          actualQuantity: { type: 'integer', default: 0 },
          fillPercentage: { type: 'number', nullable: true },
          currentBinId: { ...uuid, nullable: true },
          status: {
            type: 'string',
            enum: ['RECEIVING', 'STORED', 'PICKED', 'SHIPPED', 'DAMAGED'],
          },
          ...timestamps,
        },
      },
      LpnCreate: {
        type: 'object',
        required: ['tenantId', 'batchId', 'lpnCode', 'boxType'],
        properties: {
          tenantId: uuid,
          batchId: uuid,
          lpnCode: { type: 'string' },
          boxType: {
            type: 'string',
            enum: ['SMALL', 'MEDIUM', 'LARGE', 'EXTRA'],
          },
          volumeUnits: {
            type: 'integer',
            minimum: 1,
            description: 'Optional; auto from boxType if omitted',
          },
          maxCapacity: { type: 'integer', minimum: 1 },
          actualQuantity: { type: 'integer', minimum: 0, default: 0 },
          fillPercentage: { type: 'number', minimum: 0, maximum: 100 },
          currentBinId: uuid,
          status: {
            type: 'string',
            enum: ['RECEIVING', 'STORED', 'PICKED', 'SHIPPED', 'DAMAGED'],
            default: 'RECEIVING',
          },
        },
      },
      LpnUpdate: {
        type: 'object',
        properties: {
          boxType: {
            type: 'string',
            enum: ['SMALL', 'MEDIUM', 'LARGE', 'EXTRA'],
          },
          volumeUnits: { type: 'integer', minimum: 1 },
          maxCapacity: { type: 'integer', minimum: 1 },
          actualQuantity: { type: 'integer', minimum: 0 },
          fillPercentage: { type: 'number', minimum: 0, maximum: 100 },
          currentBinId: { ...uuid, nullable: true },
          status: {
            type: 'string',
            enum: ['RECEIVING', 'STORED', 'PICKED', 'SHIPPED', 'DAMAGED'],
          },
        },
      },

      HealthData: {
        type: 'object',
        properties: {
          status: { type: 'string', example: 'ok' },
          database: { type: 'string', example: 'connected' },
          timestamp: { type: 'string', format: 'date-time' },
        },
      },

      User: {
        type: 'object',
        properties: {
          userId: uuid,
          tenantId: { ...uuid, nullable: true },
          warehouseId: { ...uuid, nullable: true },
          fullName: { type: 'string' },
          email: { type: 'string', format: 'email' },
          phone: { type: 'string', nullable: true },
          role: {
            type: 'string',
            enum: ['SYSTEM_ADMIN', 'WH_ADMIN', 'WH_STAFF', 'TENANT_ADMIN', 'TENANT_STAFF'],
          },
          status: {
            type: 'string',
            enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'BLOCKED'],
          },
          ...timestamps,
        },
      },
      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', format: 'password' },
        },
      },
      UserCreate: {
        type: 'object',
        required: ['fullName', 'email', 'password', 'role'],
        properties: {
          fullName: { type: 'string' },
          email: { type: 'string', format: 'email' },
          password: { type: 'string', format: 'password', minLength: 8 },
          phone: { type: 'string' },
          role: {
            type: 'string',
            enum: ['WH_ADMIN', 'TENANT_ADMIN', 'WH_STAFF', 'TENANT_STAFF'],
            description:
              'SYSTEM_ADMIN may create WH_ADMIN, TENANT_ADMIN. WH_ADMIN → WH_STAFF. TENANT_ADMIN → TENANT_STAFF.',
          },
          warehouseId: {
            ...uuid,
            description: 'Required when SYSTEM_ADMIN creates WH_ADMIN / WH_STAFF',
          },
          tenantId: {
            ...uuid,
            description: 'Required when SYSTEM_ADMIN creates TENANT_ADMIN / TENANT_STAFF',
          },
          status: {
            type: 'string',
            enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'BLOCKED'],
            default: 'ACTIVE',
          },
        },
      },
      UserUpdate: {
        type: 'object',
        properties: {
          fullName: { type: 'string' },
          phone: { type: 'string' },
          status: {
            type: 'string',
            enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'BLOCKED'],
          },
        },
      },
      LoginData: {
        type: 'object',
        properties: {
          accessToken: { type: 'string' },
          user: { $ref: '#/components/schemas/User' },
        },
      },

      RentalRequest: {
        type: 'object',
        properties: {
          rentalRequestId: uuid,
          requestCode: { type: 'string', example: 'RR-LX1A2B-0C' },
          companyName: { type: 'string', example: 'ABC Fashion JSC' },
          companyCode: { type: 'string', nullable: true },
          taxCode: { type: 'string', nullable: true },
          address: { type: 'string', nullable: true },
          contactName: { type: 'string', nullable: true },
          contactEmail: { type: 'string', nullable: true },
          contactPhone: { type: 'string', nullable: true },
          warehouseId: uuid,
          contractType: {
            type: 'string',
            enum: [
              'SHARED_STORAGE',
              'RESERVED_STORAGE',
              'DEDICATED_ZONE',
              'DEDICATED_WAREHOUSE',
            ],
            nullable: true,
          },
          pricingModel: {
            type: 'string',
            enum: ['USAGE_BASED', 'FIXED', 'HYBRID'],
            nullable: true,
          },
          billingCycle: {
            type: 'string',
            enum: ['DAILY', 'MONTHLY', 'QUARTERLY'],
            nullable: true,
          },
          estimatedSkuCount: { type: 'integer', nullable: true },
          estimatedBoxCount: { type: 'integer', nullable: true },
          estimatedVolume: { type: 'number', nullable: true },
          averageStorageDays: { type: 'integer', nullable: true },
          estimatedInboundPerWeek: { type: 'integer', nullable: true },
          estimatedOutboundPerWeek: { type: 'integer', nullable: true },
          requiresFastPicking: { type: 'boolean' },
          requiresPremiumStorage: { type: 'boolean' },
          notes: { type: 'string', nullable: true },
          suggestedZoneType: {
            type: 'string',
            enum: ['SHARED', 'FAST_MOVING', 'BULK', 'PREMIUM', 'QC', 'RETURN'],
            nullable: true,
          },
          suggestedRackType: {
            type: 'string',
            enum: ['STANDARD', 'HIGH_CAPACITY'],
            nullable: true,
          },
          expectedStartDate: { type: 'string', format: 'date-time', nullable: true },
          expectedEndDate: { type: 'string', format: 'date-time', nullable: true },
          status: {
            type: 'string',
            enum: ['PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CONVERTED'],
          },
          reviewedBy: { ...uuid, nullable: true },
          reviewedAt: { type: 'string', format: 'date-time', nullable: true },
          rejectionReason: { type: 'string', nullable: true },
          reviewNote: { type: 'string', nullable: true },
          createdBy: { ...uuid, nullable: true },
          ...timestamps,
        },
      },
      RentalRequestCreate: {
        type: 'object',
        required: ['warehouseId', 'companyName'],
        properties: {
          warehouseId: uuid,
          requestCode: {
            type: 'string',
            description: 'Auto-generated if omitted',
          },
          companyName: { type: 'string' },
          companyCode: { type: 'string' },
          taxCode: { type: 'string' },
          address: { type: 'string' },
          contactName: { type: 'string' },
          contactEmail: { type: 'string', format: 'email' },
          contactPhone: { type: 'string' },
          contractType: {
            type: 'string',
            enum: [
              'SHARED_STORAGE',
              'RESERVED_STORAGE',
              'DEDICATED_ZONE',
              'DEDICATED_WAREHOUSE',
            ],
          },
          pricingModel: {
            type: 'string',
            enum: ['USAGE_BASED', 'FIXED', 'HYBRID'],
          },
          billingCycle: {
            type: 'string',
            enum: ['DAILY', 'MONTHLY', 'QUARTERLY'],
          },
          estimatedSkuCount: { type: 'integer', minimum: 0 },
          estimatedBoxCount: { type: 'integer', minimum: 0 },
          estimatedVolume: { type: 'number', minimum: 0 },
          averageStorageDays: { type: 'integer', minimum: 0 },
          estimatedInboundPerWeek: { type: 'integer', minimum: 0 },
          estimatedOutboundPerWeek: { type: 'integer', minimum: 0 },
          requiresFastPicking: { type: 'boolean', default: false },
          requiresPremiumStorage: { type: 'boolean', default: false },
          notes: { type: 'string' },
          suggestedZoneType: {
            type: 'string',
            enum: ['SHARED', 'FAST_MOVING', 'BULK', 'PREMIUM', 'QC', 'RETURN'],
          },
          suggestedRackType: {
            type: 'string',
            enum: ['STANDARD', 'HIGH_CAPACITY'],
          },
          expectedStartDate: { type: 'string', format: 'date-time' },
          expectedEndDate: { type: 'string', format: 'date-time' },
          status: {
            type: 'string',
            enum: ['PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CONVERTED'],
            default: 'PENDING',
          },
        },
      },
      Contract: {
        type: 'object',
        properties: {
          contractId: uuid,
          tenantId: uuid,
          warehouseId: uuid,
          rentalRequestId: { ...uuid, nullable: true },
          contractCode: { type: 'string', example: 'CTR-LX1A2B-0C' },
          contractName: { type: 'string', nullable: true },
          contractType: {
            type: 'string',
            enum: [
              'SHARED_STORAGE',
              'RESERVED_STORAGE',
              'DEDICATED_ZONE',
              'DEDICATED_WAREHOUSE',
            ],
          },
          pricingModel: {
            type: 'string',
            enum: ['USAGE_BASED', 'FIXED', 'HYBRID'],
          },
          billingCycle: {
            type: 'string',
            enum: ['DAILY', 'MONTHLY', 'QUARTERLY'],
            nullable: true,
          },
          allowDynamicRelocation: { type: 'boolean' },
          autoRenew: { type: 'boolean' },
          startDate: { type: 'string', format: 'date' },
          endDate: { type: 'string', format: 'date' },
          minimumBillingDays: { type: 'integer', nullable: true },
          minimumReservedCapacity: { type: 'number', nullable: true },
          estimatedTotalAmount: { type: 'number', nullable: true },
          status: {
            type: 'string',
            enum: [
              'DRAFT',
              'PENDING_APPROVAL',
              'ACTIVE',
              'EXPIRED',
              'TERMINATED',
              'CANCELLED',
            ],
          },
          tenantSignature: { type: 'string', nullable: true },
          warehouseSignature: { type: 'string', nullable: true },
          createdBy: { ...uuid, nullable: true },
          approvedBy: { ...uuid, nullable: true },
          ...timestamps,
        },
      },
      ContractCreate: {
        type: 'object',
        required: [
          'tenantId',
          'warehouseId',
          'contractType',
          'pricingModel',
          'startDate',
          'endDate',
        ],
        properties: {
          tenantId: uuid,
          warehouseId: uuid,
          rentalRequestId: uuid,
          contractCode: {
            type: 'string',
            description: 'Auto-generated if omitted',
          },
          contractName: { type: 'string' },
          contractType: {
            type: 'string',
            enum: [
              'SHARED_STORAGE',
              'RESERVED_STORAGE',
              'DEDICATED_ZONE',
              'DEDICATED_WAREHOUSE',
            ],
          },
          pricingModel: {
            type: 'string',
            enum: ['USAGE_BASED', 'FIXED', 'HYBRID'],
          },
          billingCycle: {
            type: 'string',
            enum: ['DAILY', 'MONTHLY', 'QUARTERLY'],
            default: 'MONTHLY',
          },
          allowDynamicRelocation: { type: 'boolean', default: true },
          autoRenew: { type: 'boolean', default: false },
          startDate: { type: 'string', format: 'date' },
          endDate: { type: 'string', format: 'date' },
          minimumBillingDays: { type: 'integer', minimum: 0, default: 1 },
          minimumReservedCapacity: { type: 'number', minimum: 0 },
          estimatedTotalAmount: { type: 'number', minimum: 0 },
          status: {
            type: 'string',
            enum: [
              'DRAFT',
              'PENDING_APPROVAL',
              'ACTIVE',
              'EXPIRED',
              'TERMINATED',
              'CANCELLED',
            ],
            default: 'DRAFT',
          },
          tenantSignature: { type: 'string' },
          warehouseSignature: { type: 'string' },
          createdBy: uuid,
          approvedBy: uuid,
        },
      },
      ContractUpdate: {
        type: 'object',
        description:
          'Status workflow: DRAFT → PENDING_APPROVAL → ACTIVE (sau khi đủ 2 chữ ký).',
        properties: {
          contractName: { type: 'string' },
          contractType: {
            type: 'string',
            enum: [
              'SHARED_STORAGE',
              'RESERVED_STORAGE',
              'DEDICATED_ZONE',
              'DEDICATED_WAREHOUSE',
            ],
          },
          pricingModel: {
            type: 'string',
            enum: ['USAGE_BASED', 'FIXED', 'HYBRID'],
          },
          billingCycle: {
            type: 'string',
            enum: ['DAILY', 'MONTHLY', 'QUARTERLY'],
          },
          allowDynamicRelocation: { type: 'boolean' },
          autoRenew: { type: 'boolean' },
          startDate: { type: 'string', format: 'date' },
          endDate: { type: 'string', format: 'date' },
          minimumBillingDays: { type: 'integer', minimum: 0 },
          minimumReservedCapacity: { type: 'number', minimum: 0 },
          estimatedTotalAmount: { type: 'number', minimum: 0 },
          status: {
            type: 'string',
            enum: [
              'DRAFT',
              'PENDING_APPROVAL',
              'ACTIVE',
              'EXPIRED',
              'TERMINATED',
              'CANCELLED',
            ],
          },
          tenantSignature: { type: 'string' },
          warehouseSignature: { type: 'string' },
          approvedBy: uuid,
        },
      },

      ContractItem: {
        type: 'object',
        properties: {
          contractItemId: uuid,
          contractId: uuid,
          itemType: {
            type: 'string',
            enum: ['STORAGE', 'INBOUND', 'OUTBOUND', 'HANDLING', 'REPACKING', 'SLA'],
          },
          storageLevel: {
            type: 'string',
            enum: ['WAREHOUSE', 'ZONE', 'RACK', 'RACK_LEVEL', 'BIN'],
            nullable: true,
          },
          billingUnit: {
            type: 'string',
            enum: [
              'BOX_DAY',
              'BIN_DAY',
              'RACK_DAY',
              'ZONE_DAY',
              'WAREHOUSE_DAY',
              'INBOUND_LPN',
              'OUTBOUND_LPN',
              'HANDLING_UNIT',
            ],
          },
          quantity: { type: 'number', nullable: true },
          reservedQuantity: { type: 'integer', nullable: true },
          boxType: {
            type: 'string',
            enum: ['SMALL', 'MEDIUM', 'LARGE', 'EXTRA'],
            nullable: true,
          },
          unitPrice: { type: 'number' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      ContractItemCreate: {
        type: 'object',
        required: ['contractId', 'itemType', 'billingUnit', 'unitPrice'],
        properties: {
          contractId: uuid,
          itemType: {
            type: 'string',
            enum: ['STORAGE', 'INBOUND', 'OUTBOUND', 'HANDLING', 'REPACKING', 'SLA'],
          },
          storageLevel: {
            type: 'string',
            enum: ['WAREHOUSE', 'ZONE', 'RACK', 'RACK_LEVEL', 'BIN'],
          },
          billingUnit: {
            type: 'string',
            enum: [
              'BOX_DAY',
              'BIN_DAY',
              'RACK_DAY',
              'ZONE_DAY',
              'WAREHOUSE_DAY',
              'INBOUND_LPN',
              'OUTBOUND_LPN',
              'HANDLING_UNIT',
            ],
          },
          quantity: { type: 'number', minimum: 0 },
          reservedQuantity: { type: 'integer', minimum: 0 },
          boxType: {
            type: 'string',
            enum: ['SMALL', 'MEDIUM', 'LARGE', 'EXTRA'],
          },
          unitPrice: { type: 'number', minimum: 0 },
        },
      },
      ContractItemUpdate: {
        type: 'object',
        properties: {
          itemType: {
            type: 'string',
            enum: ['STORAGE', 'INBOUND', 'OUTBOUND', 'HANDLING', 'REPACKING', 'SLA'],
          },
          storageLevel: {
            type: 'string',
            enum: ['WAREHOUSE', 'ZONE', 'RACK', 'RACK_LEVEL', 'BIN'],
          },
          billingUnit: {
            type: 'string',
            enum: [
              'BOX_DAY',
              'BIN_DAY',
              'RACK_DAY',
              'ZONE_DAY',
              'WAREHOUSE_DAY',
              'INBOUND_LPN',
              'OUTBOUND_LPN',
              'HANDLING_UNIT',
            ],
          },
          quantity: { type: 'number', minimum: 0 },
          reservedQuantity: { type: 'integer', minimum: 0 },
          boxType: {
            type: 'string',
            enum: ['SMALL', 'MEDIUM', 'LARGE', 'EXTRA'],
          },
          unitPrice: { type: 'number', minimum: 0 },
        },
      },

      StorageReservation: {
        type: 'object',
        properties: {
          reservationId: uuid,
          contractId: uuid,
          tenantId: uuid,
          reservationType: {
            type: 'string',
            enum: ['SHARED', 'RESERVED', 'DEDICATED'],
          },
          storageLevel: {
            type: 'string',
            enum: ['WAREHOUSE', 'ZONE', 'RACK', 'RACK_LEVEL', 'BIN'],
          },
          warehouseId: uuid,
          zoneId: { ...uuid, nullable: true },
          rackId: { ...uuid, nullable: true },
          rackLevelId: { ...uuid, nullable: true },
          binId: { ...uuid, nullable: true },
          reservedCapacity: { type: 'number', nullable: true },
          boxType: {
            type: 'string',
            enum: ['SMALL', 'MEDIUM', 'LARGE', 'EXTRA'],
            nullable: true,
          },
          startDate: { type: 'string', format: 'date' },
          endDate: { type: 'string', format: 'date' },
          status: {
            type: 'string',
            enum: ['ACTIVE', 'EXPIRED', 'CANCELLED'],
          },
          ...timestamps,
        },
      },
      StorageReservationCreate: {
        type: 'object',
        required: [
          'contractId',
          'reservationType',
          'storageLevel',
          'warehouseId',
          'startDate',
          'endDate',
        ],
        description:
          'Tenant inherited from contract.tenantId. FK target depends on storageLevel: ZONE→zoneId, RACK→rackId, RACK_LEVEL→rackLevelId, BIN→binId.',
        properties: {
          contractId: uuid,
          reservationType: {
            type: 'string',
            enum: ['SHARED', 'RESERVED', 'DEDICATED'],
          },
          storageLevel: {
            type: 'string',
            enum: ['WAREHOUSE', 'ZONE', 'RACK', 'RACK_LEVEL', 'BIN'],
          },
          warehouseId: uuid,
          zoneId: uuid,
          rackId: uuid,
          rackLevelId: uuid,
          binId: uuid,
          reservedCapacity: { type: 'number', minimum: 0 },
          boxType: {
            type: 'string',
            enum: ['SMALL', 'MEDIUM', 'LARGE', 'EXTRA'],
          },
          startDate: { type: 'string', format: 'date' },
          endDate: { type: 'string', format: 'date' },
          status: {
            type: 'string',
            enum: ['ACTIVE', 'EXPIRED', 'CANCELLED'],
            default: 'ACTIVE',
          },
        },
      },
      StorageReservationUpdate: {
        type: 'object',
        properties: {
          reservationType: {
            type: 'string',
            enum: ['SHARED', 'RESERVED', 'DEDICATED'],
          },
          reservedCapacity: { type: 'number', minimum: 0 },
          boxType: {
            type: 'string',
            enum: ['SMALL', 'MEDIUM', 'LARGE', 'EXTRA'],
          },
          startDate: { type: 'string', format: 'date' },
          endDate: { type: 'string', format: 'date' },
          status: {
            type: 'string',
            enum: ['ACTIVE', 'EXPIRED', 'CANCELLED'],
          },
        },
      },

      TenantCompany: {
        type: 'object',
        properties: {
          tenantId: uuid,
          companyName: { type: 'string', example: 'ABC Fashion JSC' },
          companyCode: { type: 'string', nullable: true },
          taxCode: { type: 'string', nullable: true },
          contactName: { type: 'string', nullable: true },
          contactEmail: { type: 'string', nullable: true },
          contactPhone: { type: 'string', nullable: true },
          address: { type: 'string', nullable: true },
          status: { type: 'string', enum: ['ACTIVE', 'SUSPENDED'] },
          ...timestamps,
        },
      },
      TenantCompanyCreate: {
        type: 'object',
        required: ['companyName'],
        properties: {
          companyName: { type: 'string' },
          companyCode: { type: 'string' },
          taxCode: { type: 'string' },
          contactName: { type: 'string' },
          contactEmail: { type: 'string', format: 'email' },
          contactPhone: { type: 'string' },
          address: { type: 'string' },
          status: {
            type: 'string',
            enum: ['ACTIVE', 'SUSPENDED'],
            default: 'ACTIVE',
          },
        },
      },
      TenantCompanyUpdate: {
        type: 'object',
        properties: {
          companyName: { type: 'string' },
          companyCode: { type: 'string' },
          taxCode: { type: 'string' },
          contactName: { type: 'string' },
          contactEmail: { type: 'string', format: 'email' },
          contactPhone: { type: 'string' },
          address: { type: 'string' },
          status: { type: 'string', enum: ['ACTIVE', 'SUSPENDED'] },
        },
      },

      RentalRequestUpdate: {
        type: 'object',
        description:
          'Status workflow: PENDING → UNDER_REVIEW → APPROVED → CONVERTED (or REJECTED).',
        properties: {
          companyName: { type: 'string' },
          companyCode: { type: 'string' },
          taxCode: { type: 'string' },
          address: { type: 'string' },
          contactName: { type: 'string' },
          contactEmail: { type: 'string', format: 'email' },
          contactPhone: { type: 'string' },
          contractType: {
            type: 'string',
            enum: [
              'SHARED_STORAGE',
              'RESERVED_STORAGE',
              'DEDICATED_ZONE',
              'DEDICATED_WAREHOUSE',
            ],
          },
          pricingModel: {
            type: 'string',
            enum: ['USAGE_BASED', 'FIXED', 'HYBRID'],
          },
          billingCycle: {
            type: 'string',
            enum: ['DAILY', 'MONTHLY', 'QUARTERLY'],
          },
          estimatedSkuCount: { type: 'integer', minimum: 0 },
          estimatedBoxCount: { type: 'integer', minimum: 0 },
          estimatedVolume: { type: 'number', minimum: 0 },
          averageStorageDays: { type: 'integer', minimum: 0 },
          estimatedInboundPerWeek: { type: 'integer', minimum: 0 },
          estimatedOutboundPerWeek: { type: 'integer', minimum: 0 },
          requiresFastPicking: { type: 'boolean' },
          requiresPremiumStorage: { type: 'boolean' },
          notes: { type: 'string' },
          suggestedZoneType: {
            type: 'string',
            enum: ['SHARED', 'FAST_MOVING', 'BULK', 'PREMIUM', 'QC', 'RETURN'],
          },
          suggestedRackType: {
            type: 'string',
            enum: ['STANDARD', 'HIGH_CAPACITY'],
          },
          expectedStartDate: { type: 'string', format: 'date-time' },
          expectedEndDate: { type: 'string', format: 'date-time' },
          status: {
            type: 'string',
            enum: ['PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CONVERTED'],
          },
          reviewedBy: uuid,
          reviewedAt: { type: 'string', format: 'date-time' },
          rejectionReason: { type: 'string' },
          reviewNote: { type: 'string' },
        },
      },
    },
    parameters: {
      page: {
        in: 'query',
        name: 'page',
        schema: { type: 'integer', minimum: 1, default: 1 },
      },
      limit: {
        in: 'query',
        name: 'limit',
        schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
      },
    },
  },
  paths: {
    '/api/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Login',
        description: 'Returns JWT access token. Use header `Authorization: Bearer <token>` for protected routes.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/LoginRequest' },
            },
          },
        },
        responses: {
          200: successEnvelope({ $ref: '#/components/schemas/LoginData' }, 'Login successful'),
          400: stdErrors[400],
          401: stdErrors[401],
          403: stdErrors[403],
        },
      },
    },

    '/api/users/me': {
      get: {
        tags: ['User'],
        summary: 'Current user profile',
        security: bearerSecurity,
        responses: {
          200: successEnvelope({ $ref: '#/components/schemas/User' }),
          401: stdErrors[401],
        },
      },
    },
    '/api/users': {
      get: {
        tags: ['User'],
        summary: 'List users (scoped by role)',
        security: bearerSecurity,
        description:
          'SYSTEM_ADMIN: all users. WH_ADMIN: users in same warehouse. TENANT_ADMIN: users in same tenant.',
        parameters: [
          {
            in: 'query',
            name: 'role',
            schema: {
              type: 'string',
              enum: ['SYSTEM_ADMIN', 'WH_ADMIN', 'WH_STAFF', 'TENANT_ADMIN', 'TENANT_STAFF'],
            },
          },
          {
            in: 'query',
            name: 'status',
            schema: { type: 'string', enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'BLOCKED'] },
          },
          { $ref: '#/components/parameters/page' },
          { $ref: '#/components/parameters/limit' },
        ],
        responses: {
          200: paginatedEnvelope({ $ref: '#/components/schemas/User' }),
          401: stdErrors[401],
          403: stdErrors[403],
        },
      },
      post: {
        tags: ['User'],
        summary: 'Create user',
        security: bearerSecurity,
        description:
          'SYSTEM_ADMIN → WH_ADMIN (warehouseId), TENANT_ADMIN (tenantId). WH_ADMIN → WH_STAFF. TENANT_ADMIN → TENANT_STAFF.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/UserCreate' },
            },
          },
        },
        responses: {
          201: successEnvelope({ $ref: '#/components/schemas/User' }, 'Created successfully'),
          400: stdErrors[400],
          401: stdErrors[401],
          403: stdErrors[403],
          404: stdErrors[404],
          409: stdErrors[409],
        },
      },
    },
    '/api/users/{userId}': {
      get: {
        tags: ['User'],
        summary: 'Get user by ID',
        security: bearerSecurity,
        parameters: [{ in: 'path', name: 'userId', required: true, schema: uuid }],
        responses: {
          200: successEnvelope({ $ref: '#/components/schemas/User' }),
          401: stdErrors[401],
          403: stdErrors[403],
          404: stdErrors[404],
        },
      },
      patch: {
        tags: ['User'],
        summary: 'Update user',
        security: bearerSecurity,
        parameters: [{ in: 'path', name: 'userId', required: true, schema: uuid }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/UserUpdate' },
            },
          },
        },
        responses: {
          200: successEnvelope({ $ref: '#/components/schemas/User' }, 'Updated successfully'),
          400: stdErrors[400],
          401: stdErrors[401],
          403: stdErrors[403],
          404: stdErrors[404],
        },
      },
    },

    '/api/health': {
      get: {
        tags: ['System'],
        summary: 'Health check',
        description: 'Verifies API and PostgreSQL connectivity.',
        responses: {
          200: successEnvelope({ $ref: '#/components/schemas/HealthData' }, 'Service healthy'),
          503: {
            description: 'Database unavailable',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },

    '/api/warehouses': {
      get: {
        tags: ['Warehouse'],
        summary: 'List warehouses',
        parameters: [
          {
            in: 'query',
            name: 'status',
            schema: {
              type: 'string',
              enum: ['ACTIVE', 'INACTIVE', 'MAINTENANCE', 'CLOSED'],
            },
          },
          { $ref: '#/components/parameters/page' },
          { $ref: '#/components/parameters/limit' },
        ],
        responses: {
          200: paginatedEnvelope({ $ref: '#/components/schemas/Warehouse' }),
          400: stdErrors[400],
        },
      },
      post: {
        tags: ['Warehouse'],
        summary: 'Create warehouse',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/WarehouseCreate' },
            },
          },
        },
        responses: {
          201: successEnvelope(
            { $ref: '#/components/schemas/Warehouse' },
            'Warehouse created'
          ),
          400: stdErrors[400],
          409: stdErrors[409],
        },
      },
    },
    '/api/warehouses/{warehouseId}': {
      get: {
        tags: ['Warehouse'],
        summary: 'Get warehouse by ID',
        parameters: [
          { in: 'path', name: 'warehouseId', required: true, schema: uuid },
        ],
        responses: {
          200: successEnvelope({ $ref: '#/components/schemas/Warehouse' }),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
      patch: {
        tags: ['Warehouse'],
        summary: 'Update warehouse',
        parameters: [
          { in: 'path', name: 'warehouseId', required: true, schema: uuid },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/WarehouseUpdate' },
            },
          },
        },
        responses: {
          200: successEnvelope(
            { $ref: '#/components/schemas/Warehouse' },
            'Updated successfully'
          ),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
      delete: {
        tags: ['Warehouse'],
        summary: 'Delete warehouse',
        parameters: [
          { in: 'path', name: 'warehouseId', required: true, schema: uuid },
        ],
        responses: {
          200: successEnvelope(
            { $ref: '#/components/schemas/Warehouse' },
            'Deleted successfully'
          ),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
    },

    '/api/zones': {
      get: {
        tags: ['Zone'],
        summary: 'List zones',
        parameters: [
          { in: 'query', name: 'warehouseId', required: true, schema: uuid },
          {
            in: 'query',
            name: 'status',
            schema: { type: 'string', enum: ['ACTIVE', 'BLOCKED'] },
          },
          {
            in: 'query',
            name: 'zoneType',
            schema: {
              type: 'string',
              enum: ['SHARED', 'FAST_MOVING', 'BULK', 'PREMIUM', 'QC', 'RETURN'],
            },
          },
          { $ref: '#/components/parameters/page' },
          { $ref: '#/components/parameters/limit' },
        ],
        responses: {
          200: paginatedEnvelope({ $ref: '#/components/schemas/WarehouseZone' }),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
      post: {
        tags: ['Zone'],
        summary: 'Create zone',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ZoneCreate' },
            },
          },
        },
        responses: {
          201: successEnvelope(
            { $ref: '#/components/schemas/WarehouseZone' },
            'Zone created'
          ),
          400: stdErrors[400],
          404: stdErrors[404],
          409: stdErrors[409],
        },
      },
    },
    '/api/zones/{zoneId}': {
      get: {
        tags: ['Zone'],
        summary: 'Get zone by ID',
        parameters: [{ in: 'path', name: 'zoneId', required: true, schema: uuid }],
        responses: {
          200: successEnvelope({ $ref: '#/components/schemas/WarehouseZone' }),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
      patch: {
        tags: ['Zone'],
        summary: 'Update zone',
        parameters: [{ in: 'path', name: 'zoneId', required: true, schema: uuid }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ZoneUpdate' },
            },
          },
        },
        responses: {
          200: successEnvelope(
            { $ref: '#/components/schemas/WarehouseZone' },
            'Updated successfully'
          ),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
      delete: {
        tags: ['Zone'],
        summary: 'Delete zone',
        parameters: [{ in: 'path', name: 'zoneId', required: true, schema: uuid }],
        responses: {
          200: successEnvelope(
            { $ref: '#/components/schemas/WarehouseZone' },
            'Deleted successfully'
          ),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
    },

    '/api/racks': {
      get: {
        tags: ['Rack'],
        summary: 'List racks',
        parameters: [
          { in: 'query', name: 'zoneId', required: true, schema: uuid },
          {
            in: 'query',
            name: 'status',
            schema: { type: 'string', enum: ['ACTIVE', 'BLOCKED'] },
          },
          {
            in: 'query',
            name: 'rackType',
            schema: { type: 'string', enum: ['STANDARD', 'HIGH_CAPACITY'] },
          },
          { $ref: '#/components/parameters/page' },
          { $ref: '#/components/parameters/limit' },
        ],
        responses: {
          200: paginatedEnvelope({ $ref: '#/components/schemas/Rack' }),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
      post: {
        tags: ['Rack'],
        summary: 'Create rack',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/RackCreate' },
            },
          },
        },
        responses: {
          201: successEnvelope({ $ref: '#/components/schemas/Rack' }, 'Rack created'),
          400: stdErrors[400],
          404: stdErrors[404],
          409: stdErrors[409],
        },
      },
    },
    '/api/racks/{rackId}': {
      get: {
        tags: ['Rack'],
        summary: 'Get rack by ID',
        parameters: [{ in: 'path', name: 'rackId', required: true, schema: uuid }],
        responses: {
          200: successEnvelope({ $ref: '#/components/schemas/Rack' }),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
      patch: {
        tags: ['Rack'],
        summary: 'Update rack',
        parameters: [{ in: 'path', name: 'rackId', required: true, schema: uuid }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/RackUpdate' },
            },
          },
        },
        responses: {
          200: successEnvelope({ $ref: '#/components/schemas/Rack' }, 'Updated successfully'),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
      delete: {
        tags: ['Rack'],
        summary: 'Delete rack',
        parameters: [{ in: 'path', name: 'rackId', required: true, schema: uuid }],
        responses: {
          200: successEnvelope({ $ref: '#/components/schemas/Rack' }, 'Deleted successfully'),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
    },

    '/api/rack-levels': {
      get: {
        tags: ['RackLevel'],
        summary: 'List rack levels',
        parameters: [
          { in: 'query', name: 'rackId', required: true, schema: uuid },
          { $ref: '#/components/parameters/page' },
          { $ref: '#/components/parameters/limit' },
        ],
        responses: {
          200: paginatedEnvelope({ $ref: '#/components/schemas/RackLevel' }),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
      post: {
        tags: ['RackLevel'],
        summary: 'Create rack level',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/RackLevelCreate' },
            },
          },
        },
        responses: {
          201: successEnvelope(
            { $ref: '#/components/schemas/RackLevel' },
            'Rack level created'
          ),
          400: stdErrors[400],
          404: stdErrors[404],
          409: stdErrors[409],
        },
      },
    },
    '/api/rack-levels/{rackLevelId}': {
      get: {
        tags: ['RackLevel'],
        summary: 'Get rack level by ID',
        parameters: [
          { in: 'path', name: 'rackLevelId', required: true, schema: uuid },
        ],
        responses: {
          200: successEnvelope({ $ref: '#/components/schemas/RackLevel' }),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
      patch: {
        tags: ['RackLevel'],
        summary: 'Update rack level',
        parameters: [
          { in: 'path', name: 'rackLevelId', required: true, schema: uuid },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/RackLevelUpdate' },
            },
          },
        },
        responses: {
          200: successEnvelope(
            { $ref: '#/components/schemas/RackLevel' },
            'Updated successfully'
          ),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
      delete: {
        tags: ['RackLevel'],
        summary: 'Delete rack level',
        parameters: [
          { in: 'path', name: 'rackLevelId', required: true, schema: uuid },
        ],
        responses: {
          200: successEnvelope(
            { $ref: '#/components/schemas/RackLevel' },
            'Deleted successfully'
          ),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
    },

    '/api/bins': {
      get: {
        tags: ['Bin'],
        summary: 'List bins',
        parameters: [
          { in: 'query', name: 'rackLevelId', required: true, schema: uuid },
          {
            in: 'query',
            name: 'status',
            schema: {
              type: 'string',
              enum: ['EMPTY', 'PARTIAL', 'FULL', 'RESERVED', 'BLOCKED'],
            },
          },
          {
            in: 'query',
            name: 'reservationType',
            schema: { type: 'string', enum: ['SHARED', 'RESERVED', 'DEDICATED'] },
          },
          {
            in: 'query',
            name: 'supportedBoxType',
            schema: { type: 'string', enum: ['SMALL', 'MEDIUM', 'LARGE', 'EXTRA'] },
          },
          { $ref: '#/components/parameters/page' },
          { $ref: '#/components/parameters/limit' },
        ],
        responses: {
          200: paginatedEnvelope({ $ref: '#/components/schemas/Bin' }),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
      post: {
        tags: ['Bin'],
        summary: 'Create bin',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/BinCreate' },
            },
          },
        },
        responses: {
          201: successEnvelope({ $ref: '#/components/schemas/Bin' }, 'Bin created'),
          400: stdErrors[400],
          404: stdErrors[404],
          409: stdErrors[409],
        },
      },
    },
    '/api/bins/{binId}': {
      get: {
        tags: ['Bin'],
        summary: 'Get bin by ID',
        parameters: [{ in: 'path', name: 'binId', required: true, schema: uuid }],
        responses: {
          200: successEnvelope({ $ref: '#/components/schemas/Bin' }),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
      patch: {
        tags: ['Bin'],
        summary: 'Update bin',
        parameters: [{ in: 'path', name: 'binId', required: true, schema: uuid }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/BinUpdate' },
            },
          },
        },
        responses: {
          200: successEnvelope({ $ref: '#/components/schemas/Bin' }, 'Updated successfully'),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
      delete: {
        tags: ['Bin'],
        summary: 'Delete bin',
        parameters: [{ in: 'path', name: 'binId', required: true, schema: uuid }],
        responses: {
          200: successEnvelope({ $ref: '#/components/schemas/Bin' }, 'Deleted successfully'),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
    },

    '/api/lpns': {
      get: {
        tags: ['LPN'],
        summary: 'List LPNs',
        parameters: [
          { in: 'query', name: 'tenantId', schema: uuid },
          { in: 'query', name: 'batchId', schema: uuid },
          {
            in: 'query',
            name: 'status',
            schema: {
              type: 'string',
              enum: ['RECEIVING', 'STORED', 'PICKED', 'SHIPPED', 'DAMAGED'],
            },
          },
          {
            in: 'query',
            name: 'boxType',
            schema: { type: 'string', enum: ['SMALL', 'MEDIUM', 'LARGE', 'EXTRA'] },
          },
          { in: 'query', name: 'currentBinId', schema: uuid },
          { $ref: '#/components/parameters/page' },
          { $ref: '#/components/parameters/limit' },
        ],
        responses: {
          200: paginatedEnvelope({ $ref: '#/components/schemas/Lpn' }),
          400: stdErrors[400],
        },
      },
      post: {
        tags: ['LPN'],
        summary: 'Create LPN',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/LpnCreate' },
            },
          },
        },
        responses: {
          201: successEnvelope({ $ref: '#/components/schemas/Lpn' }, 'LPN created'),
          400: stdErrors[400],
          404: stdErrors[404],
          409: stdErrors[409],
        },
      },
    },
    '/api/lpns/{lpnId}': {
      get: {
        tags: ['LPN'],
        summary: 'Get LPN by ID',
        parameters: [{ in: 'path', name: 'lpnId', required: true, schema: uuid }],
        responses: {
          200: successEnvelope({ $ref: '#/components/schemas/Lpn' }),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
      patch: {
        tags: ['LPN'],
        summary: 'Update LPN',
        parameters: [{ in: 'path', name: 'lpnId', required: true, schema: uuid }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/LpnUpdate' },
            },
          },
        },
        responses: {
          200: successEnvelope({ $ref: '#/components/schemas/Lpn' }, 'Updated successfully'),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
      delete: {
        tags: ['LPN'],
        summary: 'Delete LPN',
        parameters: [{ in: 'path', name: 'lpnId', required: true, schema: uuid }],
        responses: {
          200: successEnvelope({ $ref: '#/components/schemas/Lpn' }, 'Deleted successfully'),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
    },

    '/api/rental-requests': {
      get: {
        tags: ['RentalRequest'],
        summary: 'List rental requests',
        parameters: [
          { in: 'query', name: 'warehouseId', schema: uuid },
          {
            in: 'query',
            name: 'status',
            schema: {
              type: 'string',
              enum: ['PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CONVERTED'],
            },
          },
          {
            in: 'query',
            name: 'contractType',
            schema: {
              type: 'string',
              enum: [
                'SHARED_STORAGE',
                'RESERVED_STORAGE',
                'DEDICATED_ZONE',
                'DEDICATED_WAREHOUSE',
              ],
            },
          },
          {
            in: 'query',
            name: 'pricingModel',
            schema: { type: 'string', enum: ['USAGE_BASED', 'FIXED', 'HYBRID'] },
          },
          { $ref: '#/components/parameters/page' },
          { $ref: '#/components/parameters/limit' },
        ],
        responses: {
          200: paginatedEnvelope({ $ref: '#/components/schemas/RentalRequest' }),
          400: stdErrors[400],
        },
      },
      post: {
        tags: ['RentalRequest'],
        summary: 'Create rental request',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/RentalRequestCreate' },
            },
          },
        },
        responses: {
          201: successEnvelope(
            { $ref: '#/components/schemas/RentalRequest' },
            'Rental request created'
          ),
          400: stdErrors[400],
          404: stdErrors[404],
          409: stdErrors[409],
        },
      },
    },
    '/api/tenants': {
      get: {
        tags: ['TenantCompany'],
        summary: 'List tenant companies',
        parameters: [
          {
            in: 'query',
            name: 'status',
            schema: { type: 'string', enum: ['ACTIVE', 'SUSPENDED'] },
          },
          { $ref: '#/components/parameters/page' },
          { $ref: '#/components/parameters/limit' },
        ],
        responses: {
          200: paginatedEnvelope({ $ref: '#/components/schemas/TenantCompany' }),
          400: stdErrors[400],
        },
      },
      post: {
        tags: ['TenantCompany'],
        summary: 'Create tenant company',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/TenantCompanyCreate' },
            },
          },
        },
        responses: {
          201: successEnvelope(
            { $ref: '#/components/schemas/TenantCompany' },
            'Tenant company created'
          ),
          400: stdErrors[400],
          409: stdErrors[409],
        },
      },
    },
    '/api/tenants/{tenantId}': {
      get: {
        tags: ['TenantCompany'],
        summary: 'Get tenant company by ID',
        parameters: [{ in: 'path', name: 'tenantId', required: true, schema: uuid }],
        responses: {
          200: successEnvelope({ $ref: '#/components/schemas/TenantCompany' }),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
      patch: {
        tags: ['TenantCompany'],
        summary: 'Update tenant company',
        parameters: [{ in: 'path', name: 'tenantId', required: true, schema: uuid }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/TenantCompanyUpdate' },
            },
          },
        },
        responses: {
          200: successEnvelope(
            { $ref: '#/components/schemas/TenantCompany' },
            'Updated successfully'
          ),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
      delete: {
        tags: ['TenantCompany'],
        summary: 'Delete tenant company',
        parameters: [{ in: 'path', name: 'tenantId', required: true, schema: uuid }],
        responses: {
          200: successEnvelope(
            { $ref: '#/components/schemas/TenantCompany' },
            'Deleted successfully'
          ),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
    },

    '/api/rental-requests/{rentalRequestId}': {
      get: {
        tags: ['RentalRequest'],
        summary: 'Get rental request by ID',
        parameters: [
          { in: 'path', name: 'rentalRequestId', required: true, schema: uuid },
        ],
        responses: {
          200: successEnvelope({ $ref: '#/components/schemas/RentalRequest' }),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
      patch: {
        tags: ['RentalRequest'],
        summary: 'Update rental request (incl. status review/approval)',
        parameters: [
          { in: 'path', name: 'rentalRequestId', required: true, schema: uuid },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/RentalRequestUpdate' },
            },
          },
        },
        responses: {
          200: successEnvelope(
            { $ref: '#/components/schemas/RentalRequest' },
            'Updated successfully'
          ),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
      delete: {
        tags: ['RentalRequest'],
        summary: 'Delete rental request',
        parameters: [
          { in: 'path', name: 'rentalRequestId', required: true, schema: uuid },
        ],
        responses: {
          200: successEnvelope(
            { $ref: '#/components/schemas/RentalRequest' },
            'Deleted successfully'
          ),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
    },

    '/api/contracts': {
      get: {
        tags: ['Contract'],
        summary: 'List contracts',
        parameters: [
          { in: 'query', name: 'tenantId', schema: uuid },
          { in: 'query', name: 'warehouseId', schema: uuid },
          { in: 'query', name: 'rentalRequestId', schema: uuid },
          {
            in: 'query',
            name: 'status',
            schema: {
              type: 'string',
              enum: [
                'DRAFT',
                'PENDING_APPROVAL',
                'ACTIVE',
                'EXPIRED',
                'TERMINATED',
                'CANCELLED',
              ],
            },
          },
          {
            in: 'query',
            name: 'contractType',
            schema: {
              type: 'string',
              enum: [
                'SHARED_STORAGE',
                'RESERVED_STORAGE',
                'DEDICATED_ZONE',
                'DEDICATED_WAREHOUSE',
              ],
            },
          },
          { $ref: '#/components/parameters/page' },
          { $ref: '#/components/parameters/limit' },
        ],
        responses: {
          200: paginatedEnvelope({ $ref: '#/components/schemas/Contract' }),
          400: stdErrors[400],
        },
      },
      post: {
        tags: ['Contract'],
        summary: 'Create contract',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ContractCreate' },
            },
          },
        },
        responses: {
          201: successEnvelope({ $ref: '#/components/schemas/Contract' }, 'Contract created'),
          400: stdErrors[400],
          404: stdErrors[404],
          409: stdErrors[409],
        },
      },
    },
    '/api/contracts/{contractId}': {
      get: {
        tags: ['Contract'],
        summary: 'Get contract by ID',
        parameters: [{ in: 'path', name: 'contractId', required: true, schema: uuid }],
        responses: {
          200: successEnvelope({ $ref: '#/components/schemas/Contract' }),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
      patch: {
        tags: ['Contract'],
        summary: 'Update contract (incl. status, signatures)',
        parameters: [{ in: 'path', name: 'contractId', required: true, schema: uuid }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ContractUpdate' },
            },
          },
        },
        responses: {
          200: successEnvelope(
            { $ref: '#/components/schemas/Contract' },
            'Updated successfully'
          ),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
      delete: {
        tags: ['Contract'],
        summary: 'Delete contract',
        parameters: [{ in: 'path', name: 'contractId', required: true, schema: uuid }],
        responses: {
          200: successEnvelope(
            { $ref: '#/components/schemas/Contract' },
            'Deleted successfully'
          ),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
    },

    '/api/contract-items': {
      get: {
        tags: ['ContractItem'],
        summary: 'List contract items',
        parameters: [
          { in: 'query', name: 'contractId', required: true, schema: uuid },
          { $ref: '#/components/parameters/page' },
          { $ref: '#/components/parameters/limit' },
        ],
        responses: {
          200: paginatedEnvelope({ $ref: '#/components/schemas/ContractItem' }),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
      post: {
        tags: ['ContractItem'],
        summary: 'Create contract item',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ContractItemCreate' },
            },
          },
        },
        responses: {
          201: successEnvelope(
            { $ref: '#/components/schemas/ContractItem' },
            'Contract item created'
          ),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
    },
    '/api/contract-items/{contractItemId}': {
      get: {
        tags: ['ContractItem'],
        summary: 'Get contract item by ID',
        parameters: [
          { in: 'path', name: 'contractItemId', required: true, schema: uuid },
        ],
        responses: {
          200: successEnvelope({ $ref: '#/components/schemas/ContractItem' }),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
      patch: {
        tags: ['ContractItem'],
        summary: 'Update contract item',
        parameters: [
          { in: 'path', name: 'contractItemId', required: true, schema: uuid },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ContractItemUpdate' },
            },
          },
        },
        responses: {
          200: successEnvelope(
            { $ref: '#/components/schemas/ContractItem' },
            'Updated successfully'
          ),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
      delete: {
        tags: ['ContractItem'],
        summary: 'Delete contract item',
        parameters: [
          { in: 'path', name: 'contractItemId', required: true, schema: uuid },
        ],
        responses: {
          200: successEnvelope(
            { $ref: '#/components/schemas/ContractItem' },
            'Deleted successfully'
          ),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
    },

    '/api/storage-reservations': {
      get: {
        tags: ['StorageReservation'],
        summary: 'List storage reservations',
        parameters: [
          { in: 'query', name: 'contractId', schema: uuid },
          { in: 'query', name: 'tenantId', schema: uuid },
          { in: 'query', name: 'warehouseId', schema: uuid },
          { in: 'query', name: 'zoneId', schema: uuid },
          { in: 'query', name: 'rackId', schema: uuid },
          { in: 'query', name: 'rackLevelId', schema: uuid },
          { in: 'query', name: 'binId', schema: uuid },
          {
            in: 'query',
            name: 'storageLevel',
            schema: {
              type: 'string',
              enum: ['WAREHOUSE', 'ZONE', 'RACK', 'RACK_LEVEL', 'BIN'],
            },
          },
          {
            in: 'query',
            name: 'status',
            schema: { type: 'string', enum: ['ACTIVE', 'EXPIRED', 'CANCELLED'] },
          },
          { $ref: '#/components/parameters/page' },
          { $ref: '#/components/parameters/limit' },
        ],
        responses: {
          200: paginatedEnvelope({ $ref: '#/components/schemas/StorageReservation' }),
          400: stdErrors[400],
        },
      },
      post: {
        tags: ['StorageReservation'],
        summary: 'Create storage reservation',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/StorageReservationCreate' },
            },
          },
        },
        responses: {
          201: successEnvelope(
            { $ref: '#/components/schemas/StorageReservation' },
            'Reservation created'
          ),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
    },
    '/api/storage-reservations/{reservationId}': {
      get: {
        tags: ['StorageReservation'],
        summary: 'Get storage reservation by ID',
        parameters: [
          { in: 'path', name: 'reservationId', required: true, schema: uuid },
        ],
        responses: {
          200: successEnvelope({ $ref: '#/components/schemas/StorageReservation' }),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
      patch: {
        tags: ['StorageReservation'],
        summary: 'Update storage reservation',
        parameters: [
          { in: 'path', name: 'reservationId', required: true, schema: uuid },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/StorageReservationUpdate' },
            },
          },
        },
        responses: {
          200: successEnvelope(
            { $ref: '#/components/schemas/StorageReservation' },
            'Updated successfully'
          ),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
      delete: {
        tags: ['StorageReservation'],
        summary: 'Delete storage reservation',
        parameters: [
          { in: 'path', name: 'reservationId', required: true, schema: uuid },
        ],
        responses: {
          200: successEnvelope(
            { $ref: '#/components/schemas/StorageReservation' },
            'Deleted successfully'
          ),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
    },
  },
};

export default spec;
