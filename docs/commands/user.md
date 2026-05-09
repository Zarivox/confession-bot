# User commands

Commands that any member can run (within the rules). Anything that posts something requires having signed the contract via `/join` first.

---

## `/join`

**Where** : server or DM
**What** : Opens the participation contract as an ephemeral embed, with a button to launch the modal.

When the user clicks **« Sign the contract »** :

1. A modal pops up
2. The user must type the **exact accept phrase** (e.g. `« I accept and consent »`)
3. On submit, the bot :
    - Records consent in `consents.json`
    - Assigns the participant role (if `PARTICIPANT_ROLE_ID` is set)
    - Updates the live presence count
    - Replies with a green confirmation embed

If the typed phrase doesn't match exactly, the modal returns an error and consent is **not** recorded.

!!! note "Modal label limit"
    Discord caps modal labels at 45 characters. The default phrase + label fit within the limit. If you customize the phrase via `locales/private.js`, keep this in mind.

---

## `/contrat`

**Where** : server or DM
**What** : Re-display the contract embed (read-only, ephemeral) for users who already signed or just want to read it again.

Banned users are blocked.

---

## `/help`

**Where** : server or DM
**What** : Display the full help menu as an ephemeral embed with three sections :

- **In DM with the bot** — `/confession`, `/join`, `/contrat`, `/cooldown`, `/help`
- **On the server** — `/top`, `/join`, `/contrat`, `/help`, vote buttons
- **Admin** — only shown if the caller is the configured `ADMIN_ID`

---

## `/confession`

**Where** : DM only — blocked on servers
**Requires** : signed contract, not banned, cooldown elapsed (or disabled)

### Options

| Option | Type | Required | Notes |
|---|---|---|---|
| `message` | string (≤2000 chars) | one of message/fichier | The confession text |
| `fichier` | attachment | one of message/fichier | An image OR a video. Type auto-detected via `contentType` |
| `reveal` | boolean | optional | If `true`, posts with your identity (separate cooldown applies) |

You must provide at least `message` **or** `fichier`. You can provide both.

### What happens behind the scenes

1. Bot checks ban status, consent, and cooldown
2. Bot validates the attachment (image or video only) and the size against your server's boost-tier upload limit
3. Bot **reserves a number** atomically (so the embed number = stored number)
4. Bot crafts the post :
    - **Image or text-only** → rich embed (yellow for anon, blue for public)
    - **Video** → plain message with `🟡` (anon) or `🔵` (public) indicator and the title in the body. Discord doesn't embed user-uploaded videos, so the embed is skipped to avoid an ugly layout.
5. Bot **re-uploads** the attachment via `AttachmentBuilder(file.url, { name })` to bypass Discord's 24h CDN URL expiry — the file lives on the bot's message permanently
6. Bot adds the ✅ / ❌ vote buttons
7. Bot saves the entry :
    - **Public** → `confessions-public.json`, `authorId` in clear (already visible on the message itself)
    - **Anonymous** → `confessions-anon.json`, `authorIdEnc` is encrypted at rest under `AUTHOR_PUB`
8. Bot updates the cooldown timestamp and replies to the user with success + cooldown hint

### Cooldowns

Two independent timers — anonymous and public — each configurable via `/admin setdelay`. Setting either to `0` disables that cooldown entirely (unlimited posting).

If a user tries to post during cooldown, the bot replies with the remaining time formatted nicely (`1h 23min 45s`).

---

## `/cooldown`

**Where** : DM only
**What** : Display your remaining anonymous and public cooldowns in an ephemeral embed.

Format :

```
⏳ Your cooldowns

🟡 Anonymous cooldown  : 1h 23min 45s
🔵 Public cooldown     : ✅ Available
```

If a cooldown is configured to `0` (disabled), the field shows `— (disabled)`.

---

## `/top`

**Where** : server
**What** : Public leaderboard of the most upvoted confessions for a given period.

| Option | Choices | Default |
|---|---|---|
| `période` | `week` / `month` / `all` | `week` |

Returns the **top 5** confessions from both files (public + anonymous), sorted by ✅ count, formatted as `**#N** — ✅ Y · ❌ N`.

---

## `/playerlist`

**Where** : server
**What** : Paginated list of all members who signed the contract.

- 15 members per page
- Buttons `◀` / `▶` to navigate
- Session expires after 5 minutes — running `/playerlist` again starts a fresh paginated view

---

## Vote buttons

Below each confession, two buttons : ✅ and ❌ with the running counts.

- **One vote per user per confession** — clicking a second time gets the « already voted » error
- Voter IDs are **never stored as plaintext** — each vote is recorded as an HMAC-SHA256 tag, lookup-only
- Banned users cannot vote
- Members who haven't signed the contract cannot vote — they're prompted to run `/join` first
