# Confession Bot

A Discord bot that lets users send **anonymous (or identified) confessions** to a dedicated channel via direct message. Members vote on each confession with ✅ / ❌, and admins get a full moderation panel.

Built with **discord.js v14**, **Node.js ESM**, and flat JSON files (no database).
Deployed automatically on push via GitHub Actions.

---

## At a glance

<div class="grid cards" markdown>

-   :material-incognito:{ .lg .middle } **Privacy by design**

    ---

    Anonymous confessions stay anonymous: voter IDs are HMAC-tagged, anonymous author IDs are encrypted at rest. Casual file inspection reveals nothing.

    [:octicons-arrow-right-24: Privacy at rest](architecture/privacy.md)

-   :material-message-text:{ .lg .middle } **Slash commands everywhere**

    ---

    `/confession` in DM, `/top` and admin tools on the server. Modal-based contract signature for first-time users.

    [:octicons-arrow-right-24: Commands reference](commands/index.md)

-   :material-rocket-launch:{ .lg .middle } **Automated deploy**

    ---

    Push to `main` → GitHub Actions builds, registers slash commands, restarts PM2. Zero manual steps after initial setup.

    [:octicons-arrow-right-24: Deployment](getting-started/deployment.md)

-   :material-cog:{ .lg .middle } **Built-in admin panel**

    ---

    `/admin` subcommands for stats, cooldowns, bans, deletes, and full reset. Protected by a single `ADMIN_ID`.

    [:octicons-arrow-right-24: Admin commands](commands/admin.md)

</div>

---

## Core features

- **Anonymous confessions** posted via DM — only the bot's account appears as poster
- **Identified mode** (`reveal:true`) — separate cooldown, identity shown
- **Image or video attachment** support — auto-detected and re-uploaded by the bot to bypass Discord's 24h CDN URL expiry
- **Per-mode cooldowns** (anonymous / public) — independently configurable, `0` disables
- **`/cooldown`** in DM lets users check their remaining cooldowns
- **✅/❌ vote buttons** — one vote per user per confession, votes are anonymized in storage
- **Opt-in consent** via `/join` modal — type the exact accept phrase to sign the contract
- **Discord role** auto-assigned on consent — controls channel visibility automatically
- **Channel permission auto-fix** at startup — denies `@everyone`, allows the participant role
- **Ban system** with optional cleanup of public confessions
- **`/top` leaderboard** by votes (week / month / all time)
- **`/playerlist`** paginated view of contract signers
- **Live custom status** under the bot showing the active participant count
- **Multilingual** — `LANG=fr` or `LANG=en`
- **Atomic JSON writes** with corruption auto-backup
- **Startup validation** — bot refuses to start if any ID, permission, or env var is wrong

---

## Tech stack

| Layer | Choice |
|---|---|
| Runtime | Node.js 18+ (ESM) |
| Discord library | [discord.js](https://discord.js.org/) v14.16+ |
| Storage | Flat JSON files — atomic write-then-rename |
| Crypto | Native Node `crypto` (X25519 + AES-256-GCM + HMAC-SHA256), zero dependencies |
| Process manager | PM2 |
| CI/CD | GitHub Actions auto-deploy on `main` |

---

## Where to next

- **Self-hoster?** → [Getting started](getting-started/index.md)
- **Curious about the storage model?** → [Architecture](architecture/index.md)
- **Want to customize per-instance text or add private listeners?** → [Customization](customization.md)
- **Quick FAQ?** → [FAQ](faq.md)
