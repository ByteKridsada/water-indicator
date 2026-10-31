let client = null;

// production passes a pg.Pool, integration tests pass PGlite — both expose .query(sql, params) -> { rows }
export function setClient(next) {
  client = next;
}

export function query(sql, params) {
  if (!client) {
    throw new Error('database client not initialised — call setClient() first');
  }
  return client.query(sql, params);
}

export async function one(sql, params) {
  const result = await query(sql, params);
  return result.rows[0] ?? null;
}

export async function many(sql, params) {
  const result = await query(sql, params);
  return result.rows;
}

// multi-statement script in one string (used by migrate) — pg handles this via simple query, PGlite via exec()
export function exec(sql) {
  if (typeof client.exec === 'function') return client.exec(sql);
  return client.query(sql);
}
