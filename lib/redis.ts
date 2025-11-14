import Redis from 'ioredis';

let redisClient: Redis | null = null;

export function getRedis() {
  if (process.env.REDIS_URL === 'mock') {
    return null;
  }

  if (!process.env.REDIS_URL) {
    return null;
  }

  if (!redisClient) {
    redisClient = new Redis(process.env.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 2
    });
  }

  return redisClient;
}

export async function ensureRedisConnection() {
  const client = getRedis();
  if (client && client.status === 'end') {
    redisClient = null;
    return ensureRedisConnection();
  }

  if (client && client.status === 'wait') {
    await client.connect();
  }

  return client;
}

