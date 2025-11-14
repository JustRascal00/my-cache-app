import { LRUCache } from 'lru-cache';

export type CacheEnvelope<T> = {
  data: T;
  source: string;
  meta?: Record<string, unknown>;
  degraded?: boolean;
};

const cache = new LRUCache<string, CacheEnvelope<any>>({
  max: 64,
  ttl: 1000 * 60 * 5
});

export function readCache<T>(key: string) {
  return cache.get(key) as CacheEnvelope<T> | undefined;
}

export function writeCache<T>(key: string, value: CacheEnvelope<T>) {
  cache.set(key, value);
  return value;
}

export function dropCache(key: string) {
  cache.delete(key);
}

