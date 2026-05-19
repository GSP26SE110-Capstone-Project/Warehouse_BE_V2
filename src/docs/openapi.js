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
  },
};

export default spec;
