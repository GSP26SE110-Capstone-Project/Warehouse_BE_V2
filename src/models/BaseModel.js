import { randomUUID } from 'crypto';
import pool from '../config/db.js';

/**
 * Generic PostgreSQL model with parameterized CRUD.
 * tableName / primaryKey are fixed per subclass — never pass user input into them.
 */
export default class BaseModel {
  constructor(tableName, primaryKey) {
    this.tableName = tableName;
    this.primaryKey = primaryKey;
  }

  _client(client) {
    return client || pool;
  }

  async findById(id, client) {
    const result = await this._client(client).query(
      `SELECT * FROM ${this.tableName} WHERE ${this.primaryKey} = $1`,
      [id]
    );
    return result.rows[0] ?? null;
  }

  async findOne(filters = {}, client) {
    const rows = await this.findAll(filters, { limit: 1 }, client);
    return rows[0] ?? null;
  }

  async findAll(filters = {}, options = {}, client) {
    const db = this._client(client ?? options.client);
    const keys = Object.keys(filters);
    const values = Object.values(filters);

    let query = `SELECT * FROM ${this.tableName}`;
    if (keys.length > 0) {
      const where = keys.map((key, i) => `${key} = $${i + 1}`).join(' AND ');
      query += ` WHERE ${where}`;
    }
    if (options.orderBy) {
      query += ` ORDER BY ${options.orderBy}`;
    }
    if (options.limit != null) {
      query += ` LIMIT ${Number(options.limit)}`;
    }
    if (options.offset != null) {
      query += ` OFFSET ${Number(options.offset)}`;
    }

    const result = await db.query(query, values);
    return result.rows;
  }

  async count(filters = {}, client) {
    const keys = Object.keys(filters);
    const values = Object.values(filters);

    let query = `SELECT COUNT(*)::int AS count FROM ${this.tableName}`;
    if (keys.length > 0) {
      const where = keys.map((key, i) => `${key} = $${i + 1}`).join(' AND ');
      query += ` WHERE ${where}`;
    }

    const result = await this._client(client).query(query, values);
    return result.rows[0].count;
  }

  async exists(filters, client) {
    return (await this.count(filters, client)) > 0;
  }

  async create(data, client) {
    const row = { ...data };
    if (row[this.primaryKey] == null) {
      row[this.primaryKey] = randomUUID();
    }

    const keys = Object.keys(row);
    const values = Object.values(row);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');

    const result = await this._client(client).query(
      `INSERT INTO ${this.tableName} (${keys.join(', ')})
       VALUES (${placeholders})
       RETURNING *`,
      values
    );
    return result.rows[0];
  }

  async updateById(id, data, client) {
    const entries = Object.entries(data).filter(([, value]) => value !== undefined);
    if (entries.length === 0) {
      return this.findById(id, client);
    }

    const setClause = entries.map(([key], i) => `${key} = $${i + 2}`).join(', ');
    const values = [id, ...entries.map(([, value]) => value)];

    const result = await this._client(client).query(
      `UPDATE ${this.tableName}
       SET ${setClause}
       WHERE ${this.primaryKey} = $1
       RETURNING *`,
      values
    );
    return result.rows[0] ?? null;
  }

  async deleteById(id, client) {
    const result = await this._client(client).query(
      `DELETE FROM ${this.tableName}
       WHERE ${this.primaryKey} = $1
       RETURNING *`,
      [id]
    );
    return result.rows[0] ?? null;
  }

  async query(text, params, client) {
    const result = await this._client(client).query(text, params);
    return result.rows;
  }

  async queryOne(text, params, client) {
    const rows = await this.query(text, params, client);
    return rows[0] ?? null;
  }
}
