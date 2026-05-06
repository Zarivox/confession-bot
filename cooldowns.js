import { readFileSync, writeFileSync, existsSync } from 'fs';

const FILE = './cooldowns.json';

function load() {
  if (!existsSync(FILE)) return { delayMs: 6 * 60 * 60 * 1000, users: {} };
  try {
    return JSON.parse(readFileSync(FILE, 'utf-8'));
  } catch {
    return { delayMs: 6 * 60 * 60 * 1000, users: {} };
  }
}

function save(data) {
  writeFileSync(FILE, JSON.stringify(data, null, 2));
}

export function getRemainingCooldown(userId) {
  const data = load();
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

// Format milliseconds into a human-readable string (e.g. "5h 30m 10s")
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
