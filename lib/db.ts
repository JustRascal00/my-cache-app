import { Pool } from 'pg';

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    let dbUrl = process.env.DATABASE_URL;
    
    if (!dbUrl) {
      throw new Error('DATABASE_URL environment variable is not set. Please configure it in Vercel environment variables.');
    }
    
    dbUrl = dbUrl.trim();
    
    if (!dbUrl || dbUrl.length < 10) {
      throw new Error('DATABASE_URL appears to be invalid or too short');
    }
    
    let cleanDbUrl = dbUrl;
    cleanDbUrl = cleanDbUrl.replace(/[?&]sslmode=[^&]*/g, '');
    cleanDbUrl = cleanDbUrl.replace(/[?&]$/, '');
    
    const requiresSSL = cleanDbUrl.includes('supabase') || 
                       cleanDbUrl.includes('neon.tech') ||
                       process.env.NODE_ENV === 'production' ||
                       process.env.VERCEL;
    
    const sslConfig = requiresSSL ? { 
      rejectUnauthorized: false
    } : undefined;
    
    pool = new Pool({
      connectionString: cleanDbUrl,
      max: 5,
      idleTimeoutMillis: 30_000,
      ssl: sslConfig
    });
  }
  
  return pool;
}

export type StatsRow = {
  id: number;
  metric: string;
  value: Record<string, unknown>;
  version: number;
  updated_at: string;
  last_accessed_at: string | null;
};

export async function getLatestStats(): Promise<StatsRow | null> {
  const dbPool = getPool();
  const result = await dbPool.query<StatsRow>(
    `SELECT id, metric, value, version, updated_at, last_accessed_at
     FROM stats
     ORDER BY updated_at DESC
     LIMIT 1`
  );

  return result.rows[0] ?? null;
}

export async function touchStatsRow(id: number, previousUpdatedAt: string): Promise<StatsRow | null> {
  const dbPool = getPool();
  const result = await dbPool.query<StatsRow>(
    `UPDATE stats
     SET last_accessed_at = NOW(),
         version = version + 1,
         updated_at = NOW()
     WHERE id = $1
       AND updated_at = $2
     RETURNING id, metric, value, version, updated_at, last_accessed_at`,
    [id, previousUpdatedAt]
  );

  return result.rows[0] ?? null;
}

export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

