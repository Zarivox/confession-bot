import { readFileSync, writeFileSync, existsSync, renameSync, copyFileSync } from 'fs';

const FILE = './cooldowns.json';
const DEFAULT = { delayMs: 6 * 3600000, delayPublicMs: 0, users: {}, usersPublic: {} };
let cache = null;

function load() {
  if (cache) return cache;
  if (!existsSync(FILE)) {
    cache = { ...DEFAULT };
    return cache;
  }
  try {
    const data = JSON.parse(readFileSync(FILE, 'utf-8'));
    // Migration: add missing fields if upgrading from older version
    if (data.delayPublicMs === undefined) data.delayPublicMs = 0;
    if (!data.usersPublic) data.usersPublic = {};
    cache = data;
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
  const last = data.users[userId];
  if (!last) return 0;
  const remaining = last + data.delayMs - Date.now();
  return remaining > 0 ? remaining : 0;
}

export function setLastConfession(userId) {
  const data = load();
  data.users[userId] = Date.now();
  save(data);
}

export function resetCooldown(userId) {
  const data = load();
  delete data.users[userId];
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
  const last = data.usersPublic[userId];
  if (!last) return 0;
  const remaining = last + data.delayPublicMs - Date.now();
  return remaining > 0 ? remaining : 0;
}

export function setLastPublicConfession(userId) {
  const data = load();
  data.usersPublic[userId] = Date.now();
  save(data);
}

export function resetPublicCooldown(userId) {
  const data = load();
  delete data.usersPublic[userId];
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
  data.users = {};
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
