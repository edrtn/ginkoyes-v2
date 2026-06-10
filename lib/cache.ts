/**
 * Cache API avec TTL et invalidation automatique via _sync_meta.
 *
 * - Cache en mémoire (Map) avec TTL par défaut 1h
 * - Vérifie toutes les 5 min si _sync_meta.id a changé (= nouvelle sync)
 * - Si oui, flush tout le cache
 */

import { queryFirst } from "./db";

// ============================================================
// Types
// ============================================================

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

// ============================================================
// State
// ============================================================

const cache = new Map<string, CacheEntry<unknown>>();

const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1h
const SYNC_CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 min

let lastKnownSyncId: number | null = null;
let lastSyncCheck = 0;

// ============================================================
// Sync check
// ============================================================

async function checkSyncChanged(): Promise<boolean> {
  const now = Date.now();
  if (now - lastSyncCheck < SYNC_CHECK_INTERVAL_MS) {
    return false;
  }
  lastSyncCheck = now;

  try {
    const row = await queryFirst<{ id: number }>(
      "SELECT id FROM _sync_meta ORDER BY id DESC LIMIT 1"
    );
    const currentId = row?.id ?? null;

    if (lastKnownSyncId !== null && currentId !== lastKnownSyncId) {
      lastKnownSyncId = currentId;
      return true; // sync changed → invalidate
    }

    lastKnownSyncId = currentId;
    return false;
  } catch {
    // DB not reachable — don't invalidate
    return false;
  }
}

// ============================================================
// Public API
// ============================================================

/**
 * Get or compute a cached value.
 * @param key   Cache key (e.g. "dashboard:2026-01-01:2027-01-01")
 * @param fn    Async function to compute the value on cache miss
 * @param ttlMs TTL in milliseconds (default 1h)
 */
export async function cached<T>(
  key: string,
  fn: () => Promise<T>,
  ttlMs: number = DEFAULT_TTL_MS
): Promise<T> {
  // Check for sync invalidation
  const syncChanged = await checkSyncChanged();
  if (syncChanged) {
    cache.clear();
  }

  const now = Date.now();
  const entry = cache.get(key) as CacheEntry<T> | undefined;

  if (entry && entry.expiresAt > now) {
    return entry.data;
  }

  // Cache miss — compute
  const data = await fn();
  cache.set(key, { data, expiresAt: now + ttlMs });
  return data;
}

/**
 * Invalidate the entire cache (e.g. after sync).
 */
export function invalidateCache(): void {
  cache.clear();
  lastKnownSyncId = null;
  lastSyncCheck = 0;
}

/**
 * TTL presets for convenience.
 */
export const TTL = {
  SHORT: 15 * 60 * 1000,       // 15 min
  DEFAULT: 60 * 60 * 1000,     // 1h
  LONG: 4 * 60 * 60 * 1000,    // 4h (filters, referential data)
} as const;
