# Privacy at rest

The bot is built so that **opening a JSON file with `cat` reveals as little as possible**. Two complementary techniques are used :

1. **Asymmetric encryption** for anonymous author IDs
2. **HMAC tagging** for voter IDs

Both run in the bot's process at write time. Both rely on `crypto.js`, which uses **only Node's built-in `node:crypto` module** — zero third-party dependencies for the cryptographic primitives.

## Anonymous author IDs

For an anonymous confession, the bot stores `authorIdEnc` instead of `authorId`. This field is a base64-encoded blob produced by `encryptAuthor()` in `crypto.js`.

### Construction

```mermaid
flowchart LR
    P[plaintext: JSON of id/username/globalName] --> E
    K[AUTHOR_PUB X25519 public key] --> E
    E[encryptAuthor]
    E --> B[base64 blob: ephPub || iv || ciphertext || authTag]
```

For each call :

1. **Ephemeral X25519 keypair** is generated fresh (random for every encryption)
2. **ECDH** combines the ephemeral private key with `AUTHOR_PUB` to produce a shared secret
3. **HKDF-SHA256** derives a 256-bit AES key from that shared secret, salted with both public keys
4. **AES-256-GCM** encrypts the plaintext with a fresh 12-byte IV, producing ciphertext + 16-byte authentication tag
5. The output is `eph_pub(32) || iv(12) || ciphertext(N) || authtag(16)`, then base64

Same plaintext encrypted twice yields **different** blobs (random ephemeral key + IV). This means an attacker can't tell whether two anon confessions are by the same author by looking at the file.

### What's encrypted

The plaintext is a JSON snapshot captured **at post time** :

```json
{
  "id": "276423795877871616",
  "username": "zari667",
  "globalName": "Zari"
}
```

`username` is captured at the moment of posting, so it represents who the user was when they confessed — not who they may have renamed themselves to since.

### Why this matters

The bot itself is configured with `AUTHOR_PUB` only — it has no way to undo this encryption. Reading `confessions-anon.json` gives you :

- The Discord message ID and channel ID (which point to the bot-authored message in the channel — anon, no help)
- A timestamp
- An opaque base64 blob
- HMAC tags of voters

That's it. There is no path from `authorIdEnc` back to a userId from inside the running bot.

## Vote tags (HMAC)

Voter IDs are never stored in clear. Each vote is keyed on `(userId, confessionNumber)` and stored as a deterministic hash :

```js
voteTag(secret, userId, confessionNumber) =
    HMAC_SHA256(secret, userId + ":" + confessionNumber)
```

Where `secret = base64decode(VOTE_SECRET)`.

### Why deterministic ?

So the bot can answer *« has this user already voted on this confession ? »* without needing to reverse anything :

```js
const tag = voteTag(VOTE_SECRET, currentUserId, currentConfessionNumber);
if (confession.votes.yes.includes(tag) || confession.votes.no.includes(tag)) {
    return 'already_voted';
}
```

The bot computes the tag for the **clicker** (whose userId is provided live by Discord), and checks for membership in the array. No decryption involved — just a hash comparison.

### Why per-confession ?

Including the confession number in the input means the same user gets a **different tag for every confession**. So an attacker reading the JSON can't tell that the same person voted across multiple confessions, only that there were *N voters per confession*.

### What an attacker with the file can / can't do

| Goal | Possible with file alone ? |
|---|---|
| « Who voted on confession #42 ? » | ❌ — tags are one-way |
| « Did Bob vote on confession #42 ? » (Bob's userId known + `VOTE_SECRET` known) | ⚠️ Yes — recompute Bob's tag and grep |
| « What did Bob vote across all confessions ? » | ⚠️ Yes (laborious) — recompute his tag for each confession |
| « Find all voters for confession #42 by inverting the tags » | ❌ — HMAC is one-way |
| « Cluster votes to identify which user voted what » | ❌ — per-confession scoping breaks cross-confession linking |

The targeted lookup case requires :

1. Knowing exactly which user you're testing
2. Having access to the server (where `VOTE_SECRET` lives in `.env`)
3. Actively computing tags

This is **deliberate and conscious** — much harder to do accidentally than it would be with plaintext IDs.

## Properties summary

| Property | Plain (`authorId`) | Encrypted (`authorIdEnc`) | HMAC tag |
|---|---|---|---|
| Reversible to userId by the bot | ✅ | ❌ | ❌ |
| Reversible to userId by anyone with `.env` | ✅ | ❌ (no private key on server) | ⚠️ Targeted only |
| Same input → same output | ✅ | ❌ | ✅ |
| Reveals user even from a single record | ✅ | ❌ | ❌ |
| Storage cost per record | ~20 bytes | ~150 bytes | ~64 bytes |

## What is **not** protected

For full transparency :

- **`consents.json` contains userIds in clear** — the bot needs them for the participant list, and the same userIds are already publicly visible on Discord via the participant role anyway.
- **`bans.json` contains userIds in clear** — the bot operator needs to manage bans by ID (`/admin unban`, `/admin banlist`). No timestamps in this file, so no correlation attack possible.
- **The Discord channel itself shows the bot's messages** with timestamps. If a user is online when an anon confession appears, anyone watching the member list could correlate. This is a Discord-platform concern, not something the bot can solve.
- **The bot operator with full server access** can run the bot's own code with debug logging to reveal posters going forward. Privacy at rest only protects what's already on disk.

!!! note "cooldowns.json is also tagged"
    `cooldowns.json` used to store userIds in clear, which allowed a
    correlation attack : per-user timestamps could be matched against
    anonymous confession timestamps to identify authors. That file is now
    HMAC-tagged with the same scheme as votes — opaque hex keys, no
    cross-referencing possible.

## Summary

The combination of asymmetric author encryption + per-confession HMAC vote tags means :

- A casual `cat confessions-anon.json` reveals **nothing** about who posted or who voted
- An admin reading the file can confirm targeted hypotheses about voters (with effort) but cannot enumerate voters
- An admin **cannot** decrypt anonymous author IDs from the file — the bot has no private key for this
