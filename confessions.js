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
export function saveConfession(messageId, channelId, authorId, anonymous = true) {
  const data = load();
  data.count += 1;
  data.list.push({
    number:    data.count,
    messageId,
    channelId,
    authorId,
    anonymous,
    timestamp: Date.now(),
    votes: { yes: [], no: [] },
  });
  save(data);
  return data.count;
}

// Register a vote — returns 'ok', 'already_voted', or 'not_found'
export function vote(number, userId, choice) {
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

// Delete a confession and renumber subsequent ones
// Returns { deleted, renumbered[] } or null if not found
export function deleteConfession(number) {
  const data = load();
  const idx = data.list.findIndex(c => c.number === number);
  if (idx === -1) return null;

  const deleted = data.list.splice(idx, 1)[0];

  // Renumber all subsequent confessions
  const renumbered = [];
  for (let i = idx; i < data.list.length; i++) {
    data.list[i].number -= 1;
    renumbered.push(data.list[i]);
  }

  data.count = data.list.length;
  save(data);
  return { deleted, renumbered };
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
