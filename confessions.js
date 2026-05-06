import { readFileSync, writeFileSync, existsSync, renameSync, copyFileSync } from 'fs';

const FILE = './confessions.json';
let cache = null;

// Read-through cache: first call hits disk, subsequent calls hit memory
function load() {
  if (cache) return cache;
  if (!existsSync(FILE)) {
    cache = { count: 0, list: [] };
    return cache;
  }
  try {
    cache = JSON.parse(readFileSync(FILE, 'utf-8'));
  } catch (e) {
    console.error('[confessions] Corrupted JSON file:', e.message);
    try {
      const backup = `${FILE}.corrupted-${Date.now()}`;
      copyFileSync(FILE, backup);
      console.error(`[confessions] Backup saved to ${backup}`);
    } catch {}
    cache = { count: 0, list: [] };
  }
  return cache;
}

// Write-through: update cache + atomic disk write (tmp → rename)
function save(data) {
  cache = data;
  const tmp = FILE + '.tmp';
  writeFileSync(tmp, JSON.stringify(data, null, 2));
  renameSync(tmp, FILE);
}

// Reserve a confession number atomically — call this BEFORE posting the Discord message
// so the embed number and the stored number always match
export function reserveNumber() {
  const data = load();
  data.count += 1;
  save(data);
  return data.count;
}

// Save a confession using a pre-reserved number
export function saveConfession(number, messageId, channelId, authorId, anonymous = true) {
  const data = load();
  data.list.push({
    number,
    messageId,
    channelId,
    authorId,
    anonymous,
    timestamp: Date.now(),
    votes: { yes: [], no: [] },
  });

  // Evict oldest confession from memory if limit is reached
  // (Discord message stays in the channel, only removed from JSON)
  const maxMemory = parseInt(process.env.MAX_CONFESSIONS_MEMORY) || 1000;
  if (data.list.length > maxMemory) {
    const evicted = data.list.shift();
    console.log(`[confessions] Memory limit (${maxMemory}) reached — evicted #${evicted.number} from JSON`);
  }

  save(data);
}

// Register a vote — returns 'ok', 'already_voted', 'not_found', or 'invalid_choice'
export function vote(number, userId, choice) {
  if (choice !== 'yes' && choice !== 'no') return 'invalid_choice';

  const data = load();
  const confession = data.list.find(c => c.number === number);
  if (!confession) return 'not_found';

  const alreadyVoted =
    confession.votes.yes.includes(userId) ||
    confession.votes.no.includes(userId);

  if (alreadyVoted) return 'already_voted';

  confession.votes[choice].push(userId);
  save(data);
  return 'ok';
}

// Get vote counts for a confession
export function getVotes(number) {
  const confession = load().list.find(c => c.number === number);
  if (!confession) return { yes: 0, no: 0 };
  return {
    yes: confession.votes.yes.length,
    no:  confession.votes.no.length,
  };
}

// Get a single confession by number
export function getConfession(number) {
  return load().list.find(c => c.number === number) ?? null;
}

// Delete a confession — numbers are NOT reassigned to avoid confusion
// Returns the deleted confession or null if not found
export function deleteConfession(number) {
  const data = load();
  const idx = data.list.findIndex(c => c.number === number);
  if (idx === -1) return null;

  const deleted = data.list.splice(idx, 1)[0];
  // data.count is intentionally kept as-is so next confession gets a fresh number
  save(data);
  return deleted;
}

// Bulk delete: returns the deleted entries in a single read+write
export function deleteWhere(predicate) {
  const data = load();
  const deleted = [];
  data.list = data.list.filter(c => {
    if (predicate(c)) { deleted.push(c); return false; }
    return true;
  });
  save(data);
  return deleted;
}

// Reset all confessions
export function resetConfessions() {
  save({ count: 0, list: [] });
}

export function getCount() {
  return load().count;
}

export function getAll() {
  return load().list;
}

export function getSince(timestampMs) {
  return load().list.filter(c => c.timestamp >= timestampMs);
}
