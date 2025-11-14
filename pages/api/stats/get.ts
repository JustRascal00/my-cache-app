import type { NextApiRequest, NextApiResponse } from 'next';
import { getLatestStats, touchStatsRow } from '../../../lib/db';
import { ensureRedisConnection } from '../../../lib/redis';
import { readCache, writeCache, CacheEnvelope } from '../../../lib/cache';

type StatsPayload = {
  metric: string;
  value: Record<string, unknown>;
  version: number;
  updated_at: string;
  last_accessed_at: string | null;
};

type ApiResponse = CacheEnvelope<StatsPayload>;

const CACHE_KEY = 'stats:last';
const LOCK_KEY = 'lock:stats:last';
const LOCK_TTL_SECONDS = 5;

async function acquireLock(): Promise<boolean> {
  const client = await ensureRedisConnection();
  if (!client) return false;

  const response = await client.set(LOCK_KEY, '1', 'EX', LOCK_TTL_SECONDS, 'NX');
  return response === 'OK';
}

async function releaseLock() {
  const client = await ensureRedisConnection();
  if (!client) return;
  await client.del(LOCK_KEY);
}

async function readRedisCache(): Promise<ApiResponse | undefined> {
  try {
    const client = await ensureRedisConnection();
    if (!client) {
      return undefined;
    }
    const raw = await client.get(CACHE_KEY);
    if (!raw) {
      return undefined;
    }
    return JSON.parse(raw) as ApiResponse;
  } catch (error) {
    return undefined;
  }
}

async function writeRedisCache(payload: ApiResponse) {
  try {
    const client = await ensureRedisConnection();
    if (!client) {
      return;
    }
    await client.set(CACHE_KEY, JSON.stringify(payload), 'EX', 60);
  } catch (error) {
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const localCache = readCache<StatsPayload>(CACHE_KEY);
    if (localCache) {
      return res.status(200).json(localCache);
    }

    const redisCache = await readRedisCache();
    if (redisCache) {
      writeCache(CACHE_KEY, { ...redisCache, source: 'redis' });
      return res.status(200).json({ ...redisCache, source: 'redis' });
    }

    const lockAcquired = await acquireLock();
    if (!lockAcquired) {
      const stale = readCache<StatsPayload>('stale:stats');
      if (stale) {
        return res.status(200).json({ ...stale, degraded: true });
      }
      return res.status(429).json({ error: 'Too Many Requests' });
    }

    const dbRow = await getLatestStats();
    if (!dbRow) {
      await releaseLock();
      return res.status(404).json({ error: 'No stats data found' });
    }

    const touched = await touchStatsRow(dbRow.id, dbRow.updated_at);
    const payload: ApiResponse = {
      data: {
        metric: touched?.metric ?? dbRow.metric,
        value: (touched?.value ?? dbRow.value) as Record<string, unknown>,
        version: touched?.version ?? dbRow.version,
        updated_at: touched?.updated_at ?? dbRow.updated_at,
        last_accessed_at: touched?.last_accessed_at ?? dbRow.last_accessed_at
      },
      source: 'database',
      meta: {
        refreshed_at: new Date().toISOString()
      }
    };

    writeCache(CACHE_KEY, payload);
    writeCache('stale:stats', { ...payload, source: 'stale' });
    await writeRedisCache(payload);
    await releaseLock();

    return res.status(200).json(payload);
  } catch (error) {
    await releaseLock().catch(() => undefined);
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    return res.status(500).json({ 
      error: errorMessage
    });
  }
}

