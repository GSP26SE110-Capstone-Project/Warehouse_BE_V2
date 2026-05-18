import defineModel from './defineModel.js';

export const tenantCompanySchema = {
  tenantId: {
    type: 'string',
    primaryKey: true,
  },
  companyName: {
    type: 'string',
    required: true,
  },
  companyCode: {
    type: 'string',
    required: false,
    unique: true,
  },
  taxCode: {
    type: 'string',
    required: false,
    unique: true,
  },
  contactName: {
    type: 'string',
    required: false,
  },
  contactEmail: {
    type: 'string',
    required: false,
  },
  contactPhone: {
    type: 'string',
    required: false,
  },
  address: {
    type: 'string',
    required: false,
  },
  status: {
    type: 'string',
    required: false,
  },
  createdAt: {
    type: 'datetime',
    default: 'NOW()',
  },
  updatedAt: {
    type: 'datetime',
    required: false,
  },
};

export const tableName = 'tenant_companies';

const TenantCompany = defineModel(tableName, tenantCompanySchema);

export { TenantCompany };
export default TenantCompany;
