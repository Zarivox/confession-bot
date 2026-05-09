import { readFileSync, writeFileSync, existsSync, renameSync, copyFileSync } from 'fs';
import { encryptAuthor, voteTag } from './crypto.js';

// ─── Storage layout ──────────────────────────────────────────────────────────
//
// Two files instead of one — different files have different privacy properties :
//
//  • confessions-public.json  — non-anonymous confessions
//      authorId is in clear (already public on the Discord message itself)
//      Used by /admin ban delete_public (filter by authorId)
//      Counter (`count`) lives here — it's the global confession number.
//
//  • confessions-anon.json    — anonymous confessions
//      authorIdEnc is asymmetric encrypted with AUTHOR_PUB
//      Only holds the corresponding private component
//
// Votes (in BOTH files) are stored as HMAC-SHA256 tags, never as plaintext IDs.
// ─── Auto-migration ──────────────────────────────────────────────────────────
//
// Legacy `confessions.json` (single-file plaintext) is auto-migrated on first
// load() call. Migration encrypts anon authorIds + hashes votes, then renames
// the legacy file with `.pre-encrypt-backup-<timestamp>` suffix.
// ─────────────────────────────────────────────────────────────────────────────

const PUB_FILE    = './confessions-public.json';
const ANON_FILE   = './confessions-anon.json';
const LEGACY_FILE = './confessions.json';

let cachePub  = null;
let cacheAnon = null;

// ─── File I/O helpers ────────────────────────────────────────────────────────

function loadFile(path, fallback) {
  if (!existsSync(path)) return fallback;
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch (e) {
    console.error(`[confessions] Corrupted JSON file ${path}:`, e.message);
    try {
      const backup = `${path}.corrupted-${Date.now()}`;
      copyFileSync(path, backup);
      console.error(`[confessions] Backup saved to ${backup}`);
    } catch {}
    return fallback;
  }
}

function saveFile(path, data) {
  const tmp = path + '.tmp';
  writeFileSync(tmp, JSON.stringify(data, null, 2));
  renameSync(tmp, path);
}

function savePub()  { saveFile(PUB_FILE,  cachePub);  }
function saveAnon() { saveFile(ANON_FILE, cacheAnon); }

// ─── One-shot migration from legacy single-file format ──────────────────────

function runMigration() {
  console.log('🔧 Migration confessions.json → encrypted split format…');

  const AUTHOR_PUB = process.env.AUTHOR_PUB;
  const VOTE_SECRET   = process.env.VOTE_SECRET;
  if (!AUTHOR_PUB || !VOTE_SECRET) {
    console.error('\n❌ Migration impossible : AUTHOR_PUB ou VOTE_SECRET manquant dans .env');
    console.error('   Génère-les avec `(internal tool)` sur ton PC, puis ajoute-les au .env du VPS.\n');
    process.exit(1);
  }

  const legacy = JSON.parse(readFileSync(LEGACY_FILE, 'utf-8'));
  const list   = legacy.list ?? [];
  const count  = legacy.count ?? list.length;

  const pubList  = [];
  const anonList = [];

  for (const c of list) {
    const oldYes = c.votes?.yes ?? [];
    const oldNo  = c.votes?.no  ?? [];
    const newVotes = {
      yes: oldYes.map(uid => voteTag(VOTE_SECRET, uid, c.number)),
      no:  oldNo .map(uid => voteTag(VOTE_SECRET, uid, c.number)),
    };

    const base = {
      number:    c.number,
      messageId: c.messageId,
      channelId: c.channelId,
      anonymous: c.anonymous,
      timestamp: c.timestamp,
      votes:     newVotes,
    };

    if (c.anonymous) {
      anonList.push({ ...base, authorIdEnc: encryptAuthor(c.authorId, AUTHOR_PUB) });
    } else {
      pubList.push({ ...base, authorId: c.authorId });
    }
  }

  saveFile(PUB_FILE,  { count, list: pubList  });
  saveFile(ANON_FILE, {        list: anonList });

  // Move legacy file out of the way (keep as backup, never delete)
  const backupPath = `${LEGACY_FILE}.pre-encrypt-backup-${Date.now()}`;
  renameSync(LEGACY_FILE, backupPath);

  console.log(`✅ Migration terminée : ${pubList.length} publique(s) + ${anonList.length} anonyme(s)`);
  console.log(`   Ancien fichier sauvegardé en ${backupPath}`);
}

function runMigrationIfNeeded() {
  if (!existsSync(LEGACY_FILE)) return;
  if (existsSync(PUB_FILE)) {
    // Already migrated — just archive the legacy file
    const backupPath = `${LEGACY_FILE}.pre-encrypt-backup-${Date.now()}`;
    renameSync(LEGACY_FILE, backupPath);
    console.log(`[confessions] Legacy file archived to ${backupPath} (migration already done)`);
    return;
  }
  runMigration();
}

// ─── Lazy load ────────────────────────────────────────────────────────────────

function load() {
  if (cachePub === null || cacheAnon === null) {
    runMigrationIfNeeded();
    cachePub  = loadFile(PUB_FILE,  { count: 0, list: [] });
    cacheAnon = loadFile(ANON_FILE, {           list: [] });
  }
  return { pub: cachePub, anon: cacheAnon };
}

// ─── Public API ──────────────────────────────────────────────────────────────

// Reserve a confession number atomically — call this BEFORE posting the Discord
// message so the embed number and the stored number always match.
export function reserveNumber() {
  const { pub } = load();
  pub.count += 1;
  savePub();
  return pub.count;
}

// Save a confession using a pre-reserved number. Routes to the right file
// based on `anonymous`. For anon, encrypts a JSON {id, username, globalName}
// snapshot — the username is captured AT POST TIME (so future renames don't
// affect the reveal output). For public, keeps `authorId` in clear (the
// username is already visible on the Discord message itself).
//
// authorInfo : { id: string, username: string, globalName: string|null }
export function saveConfession(number, messageId, channelId, authorInfo, anonymous = true) {
  const { pub, anon } = load();
  const base = {
    number,
    messageId,
    channelId,
    anonymous,
    timestamp: Date.now(),
    votes:     { yes: [], no: [] },
  };

  if (anonymous) {
    const AUTHOR_PUB = process.env.AUTHOR_PUB;
    if (!AUTHOR_PUB) throw new Error('AUTHOR_PUB missing in .env');
    const payload = JSON.stringify({
      id:         authorInfo.id,
      username:   authorInfo.username   ?? null,
      globalName: authorInfo.globalName ?? null,
    });
    anon.list.push({ ...base, authorIdEnc: encryptAuthor(payload, AUTHOR_PUB) });

    const maxMemory = parseInt(process.env.MAX_CONFESSIONS_MEMORY) || 1000;
    if (anon.list.length > maxMemory) {
      const evicted = anon.list.shift();
      console.log(`[confessions] Memory limit (${maxMemory}) reached — evicted anon #${evicted.number} from JSON`);
    }
    saveAnon();
  } else {
    pub.list.push({ ...base, authorId: authorInfo.id });

    const maxMemory = parseInt(process.env.MAX_CONFESSIONS_MEMORY) || 1000;
    if (pub.list.length > maxMemory) {
      const evicted = pub.list.shift();
      console.log(`[confessions] Memory limit (${maxMemory}) reached — evicted public #${evicted.number} from JSON`);
    }
    savePub();
  }
}

// Register a vote — returns 'ok', 'already_voted', 'not_found', or 'invalid_choice'.
// userId is hashed (HMAC) per-confession before being stored.
export function vote(number, userId, choice) {
  if (choice !== 'yes' && choice !== 'no') return 'invalid_choice';

  const VOTE_SECRET = process.env.VOTE_SECRET;
  if (!VOTE_SECRET) throw new Error('VOTE_SECRET missing in .env');

  const { pub, anon } = load();
  const inPub      = pub .list.find(c => c.number === number);
  const inAnon     = !inPub && anon.list.find(c => c.number === number);
  const confession = inPub || inAnon;
  if (!confession) return 'not_found';

  const tag = voteTag(VOTE_SECRET, userId, number);
  if (confession.votes.yes.includes(tag) || confession.votes.no.includes(tag)) {
    return 'already_voted';
  }
  confession.votes[choice].push(tag);

  if (inPub) savePub(); else saveAnon();
  return 'ok';
}

// Get vote counts for a confession.
export function getVotes(number) {
  const c = getConfession(number);
  if (!c) return { yes: 0, no: 0 };
  return {
    yes: c.votes.yes.length,
    no:  c.votes.no.length,
  };
}

// Get a single confession by number (searches both files).
// Returns the raw object — for anon, `authorIdEnc` is the encrypted blob.
export function getConfession(number) {
  const { pub, anon } = load();
  return pub.list.find(c => c.number === number)
      ?? anon.list.find(c => c.number === number)
      ?? null;
}

// Delete a confession by number (searches both files).
// Returns the deleted entry or null if not found.
// Numbers are NOT reassigned to avoid confusion.
export function deleteConfession(number) {
  const { pub, anon } = load();

  const idxPub = pub.list.findIndex(c => c.number === number);
  if (idxPub !== -1) {
    const deleted = pub.list.splice(idxPub, 1)[0];
    savePub();
    return deleted;
  }

  const idxAnon = anon.list.findIndex(c => c.number === number);
  if (idxAnon !== -1) {
    const deleted = anon.list.splice(idxAnon, 1)[0];
    saveAnon();
    return deleted;
  }

  return null;
}

// Bulk delete: predicate gets each confession (with authorId in clear for public,
// authorIdEnc for anon — anon entries have no `authorId` field).
// Used by /admin ban delete_public with predicate `c => c.authorId === userId && !c.anonymous`,
// which naturally only matches public confessions (anon entries lack `authorId`).
export function deleteWhere(predicate) {
  const { pub, anon } = load();
  const deleted = [];
  let pubChanged = false, anonChanged = false;

  pub.list = pub.list.filter(c => {
    if (predicate(c)) { deleted.push(c); pubChanged = true; return false; }
    return true;
  });
  anon.list = anon.list.filter(c => {
    if (predicate(c)) { deleted.push(c); anonChanged = true; return false; }
    return true;
  });

  if (pubChanged)  savePub();
  if (anonChanged) saveAnon();
  return deleted;
}

// Reset all confessions (used by /admin wipe). Counter restarts at 0.
export function resetConfessions() {
  cachePub  = { count: 0, list: [] };
  cacheAnon = {           list: [] };
  savePub();
  saveAnon();
}

export function getCount() {
  return load().pub.count;
}

// Returns ALL confessions (public + anon) merged.
// Used by /admin stats, /admin wipe, /top.
export function getAll() {
  const { pub, anon } = load();
  return [...pub.list, ...anon.list];
}

export function getSince(timestampMs) {
  return getAll().filter(c => c.timestamp >= timestampMs);
}
