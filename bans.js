import { readFileSync, writeFileSync, existsSync, renameSync, copyFileSync } from 'fs';

const FILE = './bans.json';

function load() {
  if (!existsSync(FILE)) return { list: [] };
  try {
    return JSON.parse(readFileSync(FILE, 'utf-8'));
  } catch (e) {
    console.error('[bans] Corrupted JSON:', e.message);
    try {
      const backup = `${FILE}.corrupted-${Date.now()}`;
      copyFileSync(FILE, backup);
      console.error(`[bans] Backup saved to ${backup}`);
    } catch {}
    return { list: [] };
  }
}

function save(data) {
  const tmp = FILE + '.tmp';
  writeFileSync(tmp, JSON.stringify(data, null, 2));
  renameSync(tmp, FILE);
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

export function resetBans() {
  save({ list: [] });
}
