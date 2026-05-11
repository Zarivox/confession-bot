# Storage layout

The bot uses **flat JSON files** with atomic write-then-rename and an in-memory cache. No database. Here are the exact shapes you'll see on disk.

## `confessions-public.json`

Stores **non-anonymous** confessions. The `authorId` is in clear because the corresponding Discord message already shows the user's identity — encrypting here would be cargo-cult security.

This is also where the **global counter** lives.

```json
{
  "count": 42,
  "list": [
    {
      "number": 4,
      "messageId": "1502243004302495824",
      "channelId": "1501740587676860557",
      "authorId": "276423795877871616",
      "anonymous": false,
      "timestamp": 1778233042986,
      "votes": {
        "yes": [
          "99f44e0c08c723689d1c4867d8ae9ad6d430dfb3392d9fa8ad34bfd6716868c1",
          "bbe3a384171d3862554b256f11e0323ef05882c15d282ecbfd59145f88e2e6d8"
        ],
        "no": []
      }
    }
  ]
}
```

| Field | Type | Description |
|---|---|---|
| `count` | int | Global confession counter (incremented on every new confession, never decremented even on delete) |
| `list[].number` | int | Confession number — matches the `#N` shown in Discord |
| `list[].messageId` | snowflake | The Discord message ID (used by `/admin delete`, `/admin wipe`, ban-with-cleanup) |
| `list[].channelId` | snowflake | Channel ID where the message lives (always the configured `CONFESSION_CHANNEL_ID`) |
| `list[].authorId` | snowflake | Discord user ID — **in clear** for public confessions only |
| `list[].anonymous` | boolean | Always `false` in this file |
| `list[].timestamp` | epoch ms | When the confession was posted |
| `list[].votes.yes[]` | hex strings | HMAC-SHA256 tags of voters (see [Privacy](privacy.md)) |
| `list[].votes.no[]` | hex strings | Same |

## `confessions-anon.json`

Stores **anonymous** confessions. The `authorIdEnc` field is the only piece of data linking back to the original poster, and it's **encrypted at rest** under `AUTHOR_PUB`.

```json
{
  "list": [
    {
      "number": 7,
      "messageId": "1501867234567890123",
      "channelId": "1501740587676860557",
      "authorIdEnc": "pAMZHYx+xLBApSW8u3cSTo6MvRQzzsc/VEL6eN4qQGDY4vNnuxoWpbnvrsGgy1Mm1IAbDwxcRMGIX7p020au7K3jLAyvahlhrgNDNMx9",
      "anonymous": true,
      "timestamp": 1778130924890,
      "votes": {
        "yes": [
          "36262d6304f84fefdf1f4ed91f763ca5bdf05ac9b7723870e7b649039ab73ab0"
        ],
        "no": []
      }
    }
  ]
}
```

| Field | Type | Description |
|---|---|---|
| `list[].number` | int | Same global counter as the public file (numbers are interleaved chronologically) |
| `list[].messageId` / `channelId` | snowflakes | Same as above |
| `list[].authorIdEnc` | base64 | Encrypted snapshot of `{id, username, globalName}` at post time. ~150 bytes. |
| `list[].anonymous` | boolean | Always `true` in this file |
| `list[].timestamp` | epoch ms | Post time |
| `list[].votes.yes[]` / `no[]` | hex | HMAC tags |

The counter does **not** live here — it's in `confessions-public.json`. The two files share the same numbering space.

## `cooldowns.json`

Tracks per-user last-post timestamps + the global cooldown durations. User
identities are stored as **HMAC-SHA256 tags** (same scheme as votes) so that
opening the file gives only opaque hex keys → no way to cross-reference
timestamps against `confessions-anon.json` to identify authors.

```json
{
  "delayMs": 21600000,
  "delayPublicMs": 86400000,
  "users": {
    "8c2d0e4f1a3b9c2d8d4e7f10b9a3f1b9c28d4e7f10b9a3f1b9c2d0e4f1a3b9c2": 1778233042986,
    "7e1a4d8b9c2d8d4e7f10b9a3f1b9c28d4e7f10b9a3f1b9c2d0e4f1a3b9c2d0e4": 1778229440794
  },
  "usersPublic": {
    "8c2d0e4f1a3b9c2d8d4e7f10b9a3f1b9c28d4e7f10b9a3f1b9c2d0e4f1a3b9c2": 1778233042986
  }
}
```

| Field | Description |
|---|---|
| `delayMs` | Anonymous cooldown duration in ms (`0` = disabled) |
| `delayPublicMs` | Public cooldown duration in ms (`0` = disabled) |
| `users` | Map `HMAC(VOTE_SECRET, "u:" + userId) → last-anon-post-timestamp` |
| `usersPublic` | Map `HMAC(VOTE_SECRET, "u:" + userId) → last-public-post-timestamp` |

The bot recomputes the tag on every operation (`getRemainingCooldown(userId)`,
`setLastConfession(userId)`, etc.) — `userId` is provided by Discord on every
interaction, never stored at rest.

## `consents.json`

Just an array of user IDs who signed the contract.

```json
{
  "users": [
    "276423795877871616",
    "374142790038192129"
  ]
}
```

## `bans.json`

Just an array of banned user IDs.

```json
{
  "users": [
    "999999999999999999"
  ]
}
```

## Atomic writes

Every write goes through this pattern (in `confessions.js`, `cooldowns.js`, etc.) :

```js
function saveFile(path, data) {
  const tmp = path + '.tmp';
  writeFileSync(tmp, JSON.stringify(data, null, 2));
  renameSync(tmp, path);
}
```

`renameSync` is **atomic on POSIX filesystems** — at any point, the file at `path` is either the old version or the new version, never half-written. If the bot crashes mid-write, you lose the in-flight write but the file remains valid JSON.

## Corruption recovery

If a JSON file fails to parse on startup :

1. The bot copies the corrupted file to `<file>.corrupted-<timestamp>`
2. Initializes a fresh empty structure in memory
3. Logs an error with the path of the backup
4. Continues running (no crash)

You can later inspect the `.corrupted-*` backup to recover what's salvageable.

## Memory cap

`MAX_CONFESSIONS_MEMORY` (default `1000`) bounds how many confessions live in JSON :

- When the count exceeds the cap, the **oldest entry** is evicted from the JSON file
- The corresponding Discord message **is not deleted** — it stays in the channel forever
- This is a memory hygiene mechanism, not a deletion mechanism

For most servers, 1000 is plenty. Bump it via `MAX_CONFESSIONS_MEMORY=5000` in `.env` if you have a busy server.
