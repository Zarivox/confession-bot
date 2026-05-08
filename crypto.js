// ─────────────────────────────────────────────────────────────────────────────
// crypto.js — Asymmetric encryption + HMAC tags for vote anonymisation
// ─────────────────────────────────────────────────────────────────────────────
//
// Pure native Node.js crypto (no dependencies). Compatible with Node 18+.
//
// ASYMMETRIC ENCRYPTION (used for anon authorIds in confessions-anon.json) :
//   - Asymmetric, anonymous-sender, ephemeral-key construction
//   - Layout : eph_pubkey(32) || iv(12) || ciphertext(N) || authtag(16)
//   - Bot has AUTHOR_PUB → can encrypt, CANNOT decrypt
//   - Only holds the corresponding private component
//   - Same plaintext yields different ciphertext each call (random ephemeral key)
//
// HMAC TAG (used for vote.yes / vote.no arrays) :
//   - Deterministic : same (userId, confessionNumber) → same tag
//   - One-way : tag → userId is impossible
//   - Lookup-only : bot computes tag for current voter and checks array membership
// ─────────────────────────────────────────────────────────────────────────────

import crypto from 'node:crypto';

const X25519_SPKI_PREFIX  = Buffer.from('302a300506032b656e032100', 'hex');
const X25519_PKCS8_PREFIX = Buffer.from('302e020100300506032b656e04220420', 'hex');
const HKDF_INFO           = Buffer.from('confession-bot-sealed-v1');

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

// ─── Asymmetric encryption encryption ────────────────────────────────────────────────────
//
// Encrypts `plaintext` (UTF-8 string) for the holder of the private component.
// `recipientPubKeyB64` is the X25519 public key (base64-encoded raw 32 bytes).
//
// Returns base64(ephPubKey || iv || ciphertext || authTag).

export function encryptAuthor(plaintext, recipientPubKeyB64) {
  const recipientRaw    = Buffer.from(recipientPubKeyB64, 'base64');
  if (recipientRaw.length !== 32) {
    throw new Error(`Invalid AUTHOR_PUB length: ${recipientRaw.length} (expected 32)`);
  }
  const recipientPubObj = rawToPubKey(recipientRaw);

  // Ephemeral keypair — fresh randomness for every encryption
  const { publicKey: ephPub, privateKey: ephPriv } = crypto.generateKeyPairSync('x25519');
  const ephPubRaw = pubKeyToRaw(ephPub);

  // ECDH(eph_priv, recipient_pub) → shared secret
  const shared = crypto.diffieHellman({ privateKey: ephPriv, publicKey: recipientPubObj });

  // HKDF-SHA256 → AES-256 key (salt = both pubkeys for domain separation)
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
//
// Returns a hex string. Same (userId, confessionNumber) → same tag.
// secret is base64-encoded (typically from VOTE_SECRET env var).

export function voteTag(secretB64, userId, confessionNumber) {
  const secret = Buffer.from(secretB64, 'base64');
  if (secret.length < 16) {
    throw new Error(`Invalid VOTE_SECRET length: ${secret.length} bytes (need ≥16)`);
  }
  return crypto.createHmac('sha256', secret)
    .update(`${userId}:${confessionNumber}`)
    .digest('hex');
}
