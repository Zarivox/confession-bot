import { readFileSync, writeFileSync, existsSync } from 'fs';

const FILE = './bans.json';

function load() {
  if (!existsSync(FILE)) return { list: [] };
  try {
    return JSON.parse(readFileSync(FILE, 'utf-8'));
  } catch (e) {
    console.error('[bans] Corrupted JSON, resetting:', e.message);
    return { list: [] };
  }
}

function save(data) {
  writeFileSync(FILE, JSON.stringify(data, null, 2));
}

export function isBanned(userId) {
  return load().list.includes(userId);
}

// Returns true if banned, false if already was
export function addBan(userId) {
  const data = load();
  if (data.list.includes(userId)) return false;
  data.list.push(userId);
  save(data);
  return true;
}

// Returns true if unbanned, false if wasn't banned
export function removeBan(userId) {
  const data = load();
  const idx = data.list.indexOf(userId);
  if (idx === -1) return false;
  data.list.splice(idx, 1);
  save(data);
  return true;
}

export function getAllBans() {
  return load().list;
}
