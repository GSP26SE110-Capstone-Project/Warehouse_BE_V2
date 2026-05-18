import SchemaModel from './SchemaModel.js';
import { camelToSnake } from './utils/fieldMapper.js';

/**
 * Tạo model từ schema khai báo (camelCase) + tên bảng PostgreSQL (snake_case).
 *
 * @example
 * const Branch = defineModel('branches', branchSchema);
 * await Branch.create({ branchCode: 'HN-01', branchName: 'Kho Hà Nội' });
 */
export default function defineModel(tableName, schema) {
  const primaryKeyField = Object.entries(schema).find(([, def]) => def.primaryKey)?.[0];
  if (!primaryKeyField) {
    throw new Error(`Schema for table "${tableName}" must have one field with primaryKey: true`);
  }

  const model = new SchemaModel(tableName, camelToSnake(primaryKeyField), schema);
  model.tableName = tableName;
  model.schema = schema;
  return model;
}
