import { readFileSync, writeFileSync, existsSync } from 'fs';

const FILE = './consents.json';

function load() {
  if (!existsSync(FILE)) return { list: [] };
  try {
    return JSON.parse(readFileSync(FILE, 'utf-8'));
  } catch (e) {
    console.error('[consents] Corrupted JSON, resetting:', e.message);
    return { list: [] };
  }
}

function save(data) {
  writeFileSync(FILE, JSON.stringify(data, null, 2));
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
