import pg from 'pg';

const { Pool } = pg;

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (!pool) {
    pool = new Pool({
      host: process.env.PLANE_DB_HOST || '127.0.0.1',
      port: parseInt(process.env.PLANE_DB_PORT || '5432', 10),
      user: process.env.PLANE_DB_USER || 'plane_mcp',
      password: process.env.PLANE_DB_PASSWORD,
      database: process.env.PLANE_DB_NAME || 'plane',
      max: 5,
      idleTimeoutMillis: 30000,
    });
  }
  return pool;
}

export async function query(sql: string, params?: any[]): Promise<any[]> {
  const p = getPool();
  const result = await p.query(sql, params);
  return result.rows;
}

export async function execute(sql: string, params?: any[]): Promise<string> {
  const p = getPool();
  const result = await p.query(sql, params);
  return `${result.command} ${result.rowCount}`;
}

export async function shutdown(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
