# FAQ

Common questions, gotchas, and design decisions.

---

## General

### Can the bot handle multiple servers ?

**No.** The bot is **single-tenant by design**. It expects exactly one `GUILD_ID` and uses guild-scoped commands like `/admin`, `/top`, `/playerlist` registered to that server only. The slash commands registered globally (`/confession`, `/join`, `/cooldown`, etc.) are usable in DM but expect the user to be a member of the configured guild.

If you want to host the same code for multiple servers, run **separate bot instances** with their own `.env` files. They can share the codebase via git but each has its own data files and Discord application.

### Does the bot need any privileged Discord intents ?

**No.** Only `Guilds` + `DirectMessages`. You don't need to enable Message Content / Server Members / Presence in the Developer Portal.

### What happens if the bot is offline when someone tries `/confession` ?

Discord shows them « The application did not respond in time ». No data is corrupted — the user just retries when the bot is back up.

### What's the storage cap ?

`MAX_CONFESSIONS_MEMORY` defaults to **1000 entries** total (public + anonymous combined). When the cap is reached, the oldest entry is evicted from JSON — but **the corresponding Discord message stays in the channel forever**. Eviction is a memory hygiene mechanism, not a deletion mechanism.

Bump via `MAX_CONFESSIONS_MEMORY=5000` in `.env` if you have a busy server. There's no DB to worry about.

---

## Posting

### Why is `/confession` blocked on the server ?

To preserve anonymity. If the slash command was usable on the server, a malicious actor could observe the « X is using /confession » indicator that Discord briefly displays, and correlate that with the next anonymous post.

DM-only also keeps the workflow private — nobody else sees you typing.

### Why do video confessions look different from image confessions ?

Discord doesn't render user-uploaded videos inside embeds — only YouTube / Twitch / etc. URLs. To avoid an ugly « tiny embed above giant video » layout, the bot skips the embed entirely for videos and uses a plain message with a colored emoji indicator (🟡 anon / 🔵 public) followed by the title and content.

For text-only and image confessions, the embed is rich and pretty.

### Why are video CDN URLs « anti-expiry » ?

Discord rotated its CDN to use signed URLs that expire after 24 hours in 2024. If the bot just forwarded the user's attachment URL, after 24h the file would 404 in the channel.

The bot uses `AttachmentBuilder(file.url, { name })` to **download the file from the user's URL and re-upload it** as part of the bot's own message. The result : a permanent CDN URL on the bot's message, no expiry. Users don't notice the difference.

### Can I let users post text + image + video at the same time ?

Currently no — the `fichier` option is a single attachment field. Discord interactions support a single attachment per option. The combined behavior of the bot is :

- Text only → embed with description
- Text + image → embed with description + image
- Text + video → plain message with title + content
- Image only → embed with image
- Video only → plain message with title

If you really need multi-attachment support, you'd have to fork and add multiple `addAttachmentOption` calls in `deploy-commands.js`, plus handle the loop in `index.js`.

---

## Cooldowns

### Why two cooldowns (anonymous + public) ?

So you can rate-limit anonymous posts harder than public ones (or vice-versa). Common pattern : 6h anonymous (people abuse anon for spam) + 24h public. Or no cooldown at all on public, since people are accountable.

### Why does cooldown `0` mean « disabled » ?

Easier UI than handling `null` / undefined cases. `0 ms` means « no waiting required », which is what you want when you disable a cooldown.

### Why does the bot show « 1h 23min 45s » formatted ?

Because `0.17 hours` (which is what you'd get from naive division) is unreadable. The bot's `formatDuration()` helper in `cooldowns.js` converts ms to a human-friendly « 1h 23min » or « 12s » format.

---

## Privacy

### Can the admin (you, the bot operator) read who posted what ?

For **public confessions** : yes, the `authorId` is in clear in `confessions-public.json`. But that's no leak — the same userId is publicly visible on the Discord message itself.

For **anonymous confessions** : the `authorIdEnc` field is encrypted at rest under `AUTHOR_PUB`, with no decryption capability available to the bot or the bot operator from the server alone. Reading the file gives an opaque blob.

### Can the admin see who voted what ?

No. Voter IDs are stored as **HMAC-SHA256 tags** keyed on `(userId, confessionNumber)`. Reading the file shows only random-looking hex strings.

A targeted lookup (« did user X vote on confession N ? ») is theoretically possible if you have access to `VOTE_SECRET` from `.env` and you actively choose to recompute X's tag and grep — but this is a deliberate, conscious action, not something you can do by accident.

See [Privacy at rest](architecture/privacy.md) for the full rundown.

### Does the bot leak anything via Discord itself ?

Discord knows everything that happens on Discord — that's tautological. Specifically :

- Discord knows who clicked which slash command
- Discord knows who DMed the bot what
- Discord stores all messages (including DMs)

This is a platform-level reality and not something the bot can hide. If your threat model includes Discord as an adversary, this bot can't help — you'd need an out-of-band channel.

### What's the « participant role » for if confessions are anonymous ?

It controls **channel visibility**. By default, `@everyone` is denied `View Channel` on the confession channel, and only members with the participant role can see it. This means people who haven't signed the contract (and thus have no role) don't see confessions at all — making anon confessions visible only to the opt-in audience.

---

## Operations

### How do I update the bot ?

`git push` your changes to `main`. The GitHub Actions workflow will SSH into your VPS, pull, install, register slash commands, and restart PM2 — typically in 15–25 seconds.

### How do I roll back ?

```bash
ssh root@your-vps
cd /root/confession-bot
git log --oneline -10
git reset --hard <good-sha>
npm install --omit=dev
pm2 restart confession-bot
```

Better : commit a fix and push.

### What if a deploy breaks the bot ?

Check `pm2 logs confession-bot` for the error. The bot's startup validation is verbose and tells you exactly what failed. Common causes :

- Missing env var → fix `.env`, restart
- Discord API error → temporary, retry
- Code error → check the failing commit, push a fix

If the bot is in a crash loop, `pm2 stop confession-bot`, fix the issue, then `pm2 restart`.

### How do I back up the data ?

Tar everything except `node_modules` :

```bash
ssh root@vps "tar czf backup.tgz -C /root confession-bot --exclude=node_modules"
scp root@vps:backup.tgz ./
```

Or set up a daily cron + offsite copy.

### Can I run the bot on Windows ?

Probably yes. The code is pure Node ESM with no native modules. PM2 works on Windows. The auto-deploy workflow assumes a Unix VPS with SSH, so you'd need to adapt that part. But for local dev, Windows is fine.

---

## Troubleshooting

### « The application did not respond in time »

Discord requires a slash command response within 3 seconds. If your handler does a slow operation (Discord API call, role fetch on a big server), `interaction.deferReply()` first, then do the work, then `interaction.editReply()`.

The bot already does this for the slow paths (modal submit, ban, info, stats, top, playerlist).

### Modal label « Échec de l'interaction »

Usually means the modal label exceeds Discord's 45-character limit. Check `joinModalLabel` in your `locales/private.js`.

### Bot starts but `/confession` says « commande inconnue »

Slash commands take up to 1 hour to propagate globally on first registration. If you just deployed, give it time — or trigger faster by re-registering on the guild scope (already done by default for `/admin`, `/top`, `/playerlist`).

### `LANG` is set to `fr` in `.env` but the bot speaks English

Your shell exported `LANG=C.UTF-8` before running the bot, and Node's `dotenv` doesn't override existing env vars by default. The bot uses `dotenv.config({ override: true })` which fixes this — make sure you're on the latest version of the code.

---

## Contributing

The repo is on GitHub at [Zarivox/confession-bot](https://github.com/Zarivox/confession-bot). Issues and pull requests welcome.

When working on locale strings, remember the **Discord 45-char modal label limit** and the auto-validation of critical keys.

When touching the storage layer, keep writes atomic (write-then-rename) and update the in-memory cache synchronously.
