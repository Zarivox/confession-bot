import { readFileSync, writeFileSync, existsSync, renameSync, copyFileSync } from 'fs';
import { userTag } from './crypto.js';

// ─── Storage ─────────────────────────────────────────────────────────────────
//
// Per-user "last post" timestamps are stored under HMAC-SHA256 tags of the
// userId, not the userId itself. Lookups recompute the tag from the live
// userId (always available in the Discord interaction), then index the dict.
//
// Cat-ing cooldowns.json gives a list of opaque 64-char hex keys → timestamps,
// with no way to know which user is which. Cross-referencing with confession
// timestamps no longer leaks "user X posted confession N".
//
// Auto-migrates legacy plaintext userId keys (17-20 digit snowflakes) to
// hashed keys on first load.
// ─────────────────────────────────────────────────────────────────────────────

const FILE = './cooldowns.json';
const DEFAULT = { delayMs: 6 * 3600000, delayPublicMs: 0, users: {}, usersPublic: {} };

const SNOWFLAKE_REGEX = /^\d{17,20}$/;

let cache = null;

function key(userId) {
  const secret = process.env.VOTE_SECRET;
  if (!secret) throw new Error('VOTE_SECRET missing in .env');
  return userTag(secret, userId);
}

// Rewrite any legacy snowflake keys to their hashed equivalent. Returns true
// if anything changed (and the caller will save).
function migrateInPlace(data) {
  let changed = false;

  for (const bucketName of ['users', 'usersPublic']) {
    const bucket = data[bucketName] ?? {};
    for (const k of Object.keys(bucket)) {
      if (SNOWFLAKE_REGEX.test(k)) {
        const newKey = key(k);
        // If both legacy and hashed entries somehow coexist, keep the most
        // recent timestamp.
        const ts = Math.max(bucket[newKey] ?? 0, bucket[k]);
        delete bucket[k];
        bucket[newKey] = ts;
        changed = true;
      }
    }
    data[bucketName] = bucket;
  }

  return changed;
}

function load() {
  if (cache) return cache;
  if (!existsSync(FILE)) {
    cache = { ...DEFAULT };
    return cache;
  }
  try {
    const data = JSON.parse(readFileSync(FILE, 'utf-8'));
    if (data.delayPublicMs === undefined) data.delayPublicMs = 0;
    if (!data.users)       data.users       = {};
    if (!data.usersPublic) data.usersPublic = {};

    const migrated = migrateInPlace(data);
    cache = data;
    if (migrated) {
      console.log('[cooldowns] Auto-migrated legacy plaintext keys to hashed form');
      save(data);
    }
  } catch (e) {
    console.error('[cooldowns] Corrupted JSON:', e.message);
    try {
      const backup = `${FILE}.corrupted-${Date.now()}`;
      copyFileSync(FILE, backup);
      console.error(`[cooldowns] Backup saved to ${backup}`);
    } catch {}
    cache = { ...DEFAULT };
  }
  return cache;
}

function save(data) {
  cache = data;
  const tmp = FILE + '.tmp';
  writeFileSync(tmp, JSON.stringify(data, null, 2));
  renameSync(tmp, FILE);
}

// ─── Anonymous cooldown ───────────────────────────────────────────────────────

export function getRemainingCooldown(userId) {
  const data = load();
  if (!data.delayMs) return 0;
  const last = data.users[key(userId)];
  if (!last) return 0;
  const remaining = last + data.delayMs - Date.now();
  return remaining > 0 ? remaining : 0;
}

export function setLastConfession(userId) {
  const data = load();
  data.users[key(userId)] = Date.now();
  save(data);
}

export function resetCooldown(userId) {
  const data = load();
  delete data.users[key(userId)];
  save(data);
}

export function getDelay() {
  return load().delayMs;
}

export function setDelay(ms) {
  const data = load();
  data.delayMs = ms;
  save(data);
}

// ─── Public (reveal) cooldown ─────────────────────────────────────────────────

export function getRemainingPublicCooldown(userId) {
  const data = load();
  if (!data.delayPublicMs) return 0;
  const last = data.usersPublic[key(userId)];
  if (!last) return 0;
  const remaining = last + data.delayPublicMs - Date.now();
  return remaining > 0 ? remaining : 0;
}

export function setLastPublicConfession(userId) {
  const data = load();
  data.usersPublic[key(userId)] = Date.now();
  save(data);
}

export function resetPublicCooldown(userId) {
  const data = load();
  delete data.usersPublic[key(userId)];
  save(data);
}

export function getPublicDelay() {
  return load().delayPublicMs;
}

export function setPublicDelay(ms) {
  const data = load();
  data.delayPublicMs = ms;
  save(data);
}

// ─── Shared ───────────────────────────────────────────────────────────────────

export function resetAllCooldowns() {
  const data = load();
  data.users       = {};
  data.usersPublic = {};
  save(data);
}

// Format milliseconds to readable string (e.g. "5h 30m 10s")
export function formatDuration(ms) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const parts = [];
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  if (s) parts.push(`${s}s`);
  return parts.join(' ') || '0s';
}
