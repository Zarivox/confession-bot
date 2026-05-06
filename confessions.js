import { readFileSync, writeFileSync, existsSync } from 'fs';

const FILE = './confessions.json';

function load() {
  if (!existsSync(FILE)) return { count: 0, list: [] };
  try {
    return JSON.parse(readFileSync(FILE, 'utf-8'));
  } catch {
    return { count: 0, list: [] };
  }
}

function save(data) {
  writeFileSync(FILE, JSON.stringify(data, null, 2));
}

// Save a new confession and return its number
export function saveConfession(messageId, channelId) {
  const data = load();
  data.count += 1;
  data.list.push({
    number:    data.count,
    messageId,
    channelId,
    timestamp: Date.now(),
  });
  save(data);
  return data.count;
}

export function getCount() {
  return load().count;
}

export function getAll() {
  return load().list;
}

// Return confessions posted after a given timestamp
export function getSince(timestampMs) {
  return load().list.filter(c => c.timestamp >= timestampMs);
}
