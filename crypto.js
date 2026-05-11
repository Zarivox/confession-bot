// ─────────────────────────────────────────────────────────────────────────────
// crypto.js — Author ID encryption + vote tag hashing
// ─────────────────────────────────────────────────────────────────────────────
//
// Pure native Node.js crypto (no dependencies). Compatible with Node 18+.
//
// encryptAuthor : encrypts a UTF-8 string under AUTHOR_PUB. Same plaintext
// yields different ciphertext each call (random ephemeral key + IV).
// Output layout : eph_pub(32) || iv(12) || ciphertext(N) || authtag(16).
//
// voteTag : deterministic HMAC-SHA256 keyed with VOTE_SECRET. Same
// (userId, confessionNumber) yields the same tag. Cannot be reversed.
// ─────────────────────────────────────────────────────────────────────────────

import crypto from 'node:crypto';

const X25519_SPKI_PREFIX  = Buffer.from('302a300506032b656e032100', 'hex');
const HKDF_INFO           = Buffer.from('confession-bot-author-v1');

function rawToPubKey(raw) {
  return crypto.createPublicKey({
    key: Buffer.concat([X25519_SPKI_PREFIX, raw]),
    format: 'der',
    type:   'spki',
  });
}

function pubKeyToRaw(keyObject) {
  return keyObject.export({ type: 'spki', format: 'der' }).slice(X25519_SPKI_PREFIX.length);
}

// ─── Author encryption ────────────────────────────────────────────────────────

export function encryptAuthor(plaintext, recipientPubKeyB64) {
  const recipientRaw = Buffer.from(recipientPubKeyB64, 'base64');
  if (recipientRaw.length !== 32) {
    throw new Error(`Invalid AUTHOR_PUB length: ${recipientRaw.length} (expected 32)`);
  }
  const recipientPubObj = rawToPubKey(recipientRaw);

  const { publicKey: ephPub, privateKey: ephPriv } = crypto.generateKeyPairSync('x25519');
  const ephPubRaw = pubKeyToRaw(ephPub);

  const shared = crypto.diffieHellman({ privateKey: ephPriv, publicKey: recipientPubObj });

  const aesKey = Buffer.from(crypto.hkdfSync(
    'sha256',
    shared,
    Buffer.concat([ephPubRaw, recipientRaw]),
    HKDF_INFO,
    32,
  ));

  const iv     = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', aesKey, iv);
  const ct     = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()]);
  const tag    = cipher.getAuthTag();

  return Buffer.concat([ephPubRaw, iv, ct, tag]).toString('base64');
}

// ─── HMAC vote tag ────────────────────────────────────────────────────────────

export function voteTag(secretB64, userId, confessionNumber) {
  const secret = Buffer.from(secretB64, 'base64');
  if (secret.length < 16) {
    throw new Error(`Invalid VOTE_SECRET length: ${secret.length} bytes (need ≥16)`);
  }
  return crypto.createHmac('sha256', secret)
    .update(`${userId}:${confessionNumber}`)
    .digest('hex');
}

// ─── HMAC user tag ────────────────────────────────────────────────────────────
//
// Used by cooldowns.js (and any other module that needs to track per-user
// state without keeping plaintext IDs at rest). Same secret as voteTag — the
// inputs are structurally different so the outputs never collide in practice.

export function userTag(secretB64, userId) {
  const secret = Buffer.from(secretB64, 'base64');
  if (secret.length < 16) {
    throw new Error(`Invalid VOTE_SECRET length: ${secret.length} bytes (need ≥16)`);
  }
  return crypto.createHmac('sha256', secret)
    .update(`u:${userId}`)
    .digest('hex');
}
