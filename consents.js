import { readFileSync, writeFileSync, existsSync, renameSync, copyFileSync } from 'fs';

const FILE = './consents.json';
let cache = null;

function load() {
  if (cache) return cache;
  if (!existsSync(FILE)) {
    cache = { list: [] };
    return cache;
  }
  try {
    cache = JSON.parse(readFileSync(FILE, 'utf-8'));
  } catch (e) {
    console.error('[consents] Corrupted JSON:', e.message);
    try {
      const backup = `${FILE}.corrupted-${Date.now()}`;
      copyFileSync(FILE, backup);
      console.error(`[consents] Backup saved to ${backup}`);
    } catch {}
    cache = { list: [] };
  }
  return cache;
}

function save(data) {
  cache = data;
  const tmp = FILE + '.tmp';
  writeFileSync(tmp, JSON.stringify(data, null, 2));
  renameSync(tmp, FILE);
}

export function hasConsented(userId) {
  return load().list.includes(userId);
}

export function addConsent(userId) {
  const data = load();
  if (!data.list.includes(userId)) {
    data.list.push(userId);
    save(data);
  }
}

export function resetConsents() {
  save({ list: [] });
}

export function getAllConsents() {
  return load().list;
}

export function removeConsent(userId) {
  const data = load();
  const idx = data.list.indexOf(userId);
  if (idx === -1) return;
  data.list.splice(idx, 1);
  save(data);
}
