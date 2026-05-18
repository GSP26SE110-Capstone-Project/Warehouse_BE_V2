export function camelToSnake(key) {
  return key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

export function snakeToCamel(key) {
  return key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

export function toDbRecord(schema, data) {
  const record = {};
  for (const [field, def] of Object.entries(schema)) {
    const column = camelToSnake(field);
    if (data[field] !== undefined) {
      record[column] = data[field];
    } else if (data[column] !== undefined) {
      record[column] = data[column];
    } else if (def.default !== undefined && def.default !== 'NOW()') {
      record[column] = def.default;
    }
  }
  return record;
}

export function fromDbRecord(schema, row) {
  if (!row) return null;

  const mapped = {};
  for (const field of Object.keys(schema)) {
    const column = camelToSnake(field);
    if (row[column] !== undefined) {
      mapped[field] = row[column];
    }
  }
  return mapped;
}

export function toDbFilters(schema, filters) {
  const record = {};
  for (const [key, value] of Object.entries(filters)) {
    if (schema[key]) {
      record[camelToSnake(key)] = value;
    } else {
      record[key] = value;
    }
  }
  return record;
}
