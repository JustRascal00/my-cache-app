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
    const redisUrl = process.env.REDIS_URL;
    const isSSL = redisUrl?.startsWith('rediss://');
    
    redisClient = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      connectTimeout: 10000,
      ...(isSSL && {
        tls: {
          rejectUnauthorized: false
        }
      })
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

