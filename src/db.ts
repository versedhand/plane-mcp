import pg from 'pg';

const { Pool } = pg;

export type InstanceName = 'personal' | 'nts';

interface InstanceConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  workspaceSlug: string;
}

const pools = new Map<string, pg.Pool>();
const configs = new Map<InstanceName, InstanceConfig>();

function loadInstanceConfig(name: InstanceName): InstanceConfig | null {
  const prefix = `PLANE_${name.toUpperCase()}_`;
  const host = process.env[`${prefix}DB_HOST`];
  const port = process.env[`${prefix}DB_PORT`];
  const user = process.env[`${prefix}DB_USER`];
  const password = process.env[`${prefix}DB_PASSWORD`];
  const database = process.env[`${prefix}DB_NAME`];
  const workspaceSlug = process.env[`${prefix}WORKSPACE_SLUG`];

  if (host && password) {
    return {
      host,
      port: parseInt(port || '5432', 10),
      user: user || 'plane_mcp',
      password,
      database: database || 'plane',
      workspaceSlug: workspaceSlug || name,
    };
  }
  return null;
}

function loadLegacyConfig(): InstanceConfig | null {
  const host = process.env.PLANE_DB_HOST;
  const password = process.env.PLANE_DB_PASSWORD;
  if (host && password) {
    return {
      host,
      port: parseInt(process.env.PLANE_DB_PORT || '5432', 10),
      user: process.env.PLANE_DB_USER || 'plane_mcp',
      password,
      database: process.env.PLANE_DB_NAME || 'plane',
      workspaceSlug: process.env.PLANE_WORKSPACE_SLUG || 'personal',
    };
  }
  return null;
}

function initConfigs(): void {
  if (configs.size > 0) return;

  const personal = loadInstanceConfig('personal');
  const nts = loadInstanceConfig('nts');

  if (personal) {
    configs.set('personal', personal);
  } else {
    // Backward compatible: legacy env vars map to personal
    const legacy = loadLegacyConfig();
    if (legacy) configs.set('personal', legacy);
  }

  if (nts) configs.set('nts', nts);
}

export function getInstanceConfig(instance: InstanceName): InstanceConfig {
  initConfigs();
  const config = configs.get(instance);
  if (!config) throw new Error(`Plane instance '${instance}' not configured`);
  return config;
}

export function getPool(instance: InstanceName = 'personal'): pg.Pool {
  const config = getInstanceConfig(instance);
  const key = instance;

  if (!pools.has(key)) {
    pools.set(
      key,
      new Pool({
        host: config.host,
        port: config.port,
        user: config.user,
        password: config.password,
        database: config.database,
        max: 5,
        idleTimeoutMillis: 30000,
      }),
    );
  }
  return pools.get(key)!;
}

export function getWorkspaceSlug(instance: InstanceName = 'personal'): string {
  const config = getInstanceConfig(instance);
  return config.workspaceSlug;
}

export function getAvailableInstances(): InstanceName[] {
  initConfigs();
  return Array.from(configs.keys()) as InstanceName[];
}

// LifeDB connection for recurrence metadata
let lifedbPool: pg.Pool | null = null;

export function getLifedbPool(): pg.Pool {
  if (!lifedbPool) {
    const url = process.env.LIFEDB_URL;
    if (url) {
      lifedbPool = new Pool({ connectionString: url, max: 3, idleTimeoutMillis: 30000 });
    } else {
      lifedbPool = new Pool({
        host: process.env.LIFEDB_HOST || '100.127.104.75',
        port: parseInt(process.env.LIFEDB_PORT || '5432', 10),
        user: process.env.LIFEDB_USER || 'postgres',
        password: process.env.LIFEDB_PASSWORD,
        database: process.env.LIFEDB_NAME || 'lifedb',
        max: 3,
        idleTimeoutMillis: 30000,
      });
    }
  }
  return lifedbPool;
}

export async function query(sql: string, params?: any[], instance: InstanceName = 'personal'): Promise<any[]> {
  const p = getPool(instance);
  const result = await p.query(sql, params);
  return result.rows;
}

export async function execute(sql: string, params?: any[], instance: InstanceName = 'personal'): Promise<string> {
  const p = getPool(instance);
  const result = await p.query(sql, params);
  return `${result.command} ${result.rowCount}`;
}

export async function shutdown(): Promise<void> {
  for (const [, pool] of pools) {
    await pool.end();
  }
  pools.clear();
  if (lifedbPool) {
    await lifedbPool.end();
    lifedbPool = null;
  }
}
