import { randomUUID } from 'crypto';
import BaseModel from './BaseModel.js';
import {
  camelToSnake,
  fromDbRecord,
  toDbFilters,
  toDbRecord,
} from './utils/fieldMapper.js';

export default class SchemaModel extends BaseModel {
  constructor(tableName, primaryKeyColumn, schema) {
    super(tableName, primaryKeyColumn);
    this.schema = schema;
    this.tableName = tableName;
    this.primaryKeyField = Object.entries(schema).find(([, def]) => def.primaryKey)?.[0];
    this.primaryKeyColumn = primaryKeyColumn;
  }

  _mapRow(row) {
    return fromDbRecord(this.schema, row);
  }

  _mapRows(rows) {
    return rows.map((row) => this._mapRow(row));
  }

  _validateRequired(data, { isUpdate = false } = {}) {
    for (const [field, def] of Object.entries(this.schema)) {
      if (def.primaryKey || isUpdate) continue;
      if (def.required === false) continue;
      if (def.default !== undefined) continue;
      if (data[field] === undefined || data[field] === null) {
        throw new Error(`Field "${field}" is required`);
      }
    }
  }

  _validateMaxLength(data) {
    for (const [field, def] of Object.entries(this.schema)) {
      if (!def.maxLength || data[field] == null) continue;
      if (String(data[field]).length > def.maxLength) {
        throw new Error(`Field "${field}" exceeds max length ${def.maxLength}`);
      }
    }
  }

  _prepareCreate(data) {
    this._validateRequired(data);
    this._validateMaxLength(data);

    const row = toDbRecord(this.schema, data);
    const pkColumn = this.primaryKeyColumn;

    if (row[pkColumn] == null) {
      row[pkColumn] = randomUUID();
    }

    const now = new Date();
    if (this.schema.createdAt && row.created_at == null) {
      row.created_at = now;
    }
    if (this.schema.updatedAt && row.updated_at == null) {
      row.updated_at = now;
    }

    return row;
  }

  _prepareUpdate(data) {
    this._validateMaxLength(data);
    const row = toDbRecord(this.schema, data);
    delete row[this.primaryKeyColumn];

    if (this.schema.updatedAt) {
      row.updated_at = new Date();
    }

    return row;
  }

  async findById(id, client) {
    const row = await super.findById(id, client);
    return this._mapRow(row);
  }

  async findOne(filters = {}, client) {
    const row = await super.findOne(toDbFilters(this.schema, filters), client);
    return this._mapRow(row);
  }

  async findAll(filters = {}, options = {}, client) {
    const rows = await super.findAll(
      toDbFilters(this.schema, filters),
      options,
      client
    );
    return this._mapRows(rows);
  }

  async count(filters = {}, client) {
    return super.count(toDbFilters(this.schema, filters), client);
  }

  async create(data, client) {
    const row = this._prepareCreate(data);
    const created = await super.create(row, client);
    return this._mapRow(created);
  }

  async updateById(id, data, client) {
    const row = this._prepareUpdate(data);
    const updated = await super.updateById(id, row, client);
    return this._mapRow(updated);
  }

  async deleteById(id, client) {
    const deleted = await super.deleteById(id, client);
    return this._mapRow(deleted);
  }

  getColumn(field) {
    return camelToSnake(field);
  }
}
