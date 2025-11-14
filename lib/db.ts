import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 30_000
});

export type StatsRow = {
  id: number;
  metric: string;
  value: Record<string, unknown>;
  version: number;
  updated_at: string;
  last_accessed_at: string | null;
};

export async function getLatestStats(): Promise<StatsRow | null> {
  const result = await pool.query<StatsRow>(
    `SELECT id, metric, value, version, updated_at, last_accessed_at
     FROM stats
     ORDER BY updated_at DESC
     LIMIT 1`
  );

  return result.rows[0] ?? null;
}

export async function touchStatsRow(id: number, previousUpdatedAt: string): Promise<StatsRow | null> {
  const result = await pool.query<StatsRow>(
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
  await pool.end();
}

