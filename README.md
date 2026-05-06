# 💬 Confession Bot

A Discord bot that lets users send anonymous (or identified) confessions to a dedicated channel via direct message. Users must first sign a participation contract before posting. Confessions can be voted on by the community. Includes a full admin panel with bans, statistics, and moderation tools.

## Features

- Anonymous confessions posted via DM (no one sees who posted)
- Optional non-anonymous mode (`reveal:true`) — shows identity, separate cooldown
- Independent configurable cooldowns for anonymous and public confessions (0 = disabled)
- ✅/❌ vote buttons on each confession
- Opt-in consent system (`/join`) with contract before first use
- Discord role auto-assigned on consent — controls channel visibility
- Channel permission auto-fix on startup (`@everyone` denied, role allowed)
- Ban system (with optional public confession cleanup)
- `/top` leaderboard by votes (week / month / all time)
- `/playerlist` — paginated list of members who signed the contract
- Full admin panel (`/admin`) — bans, cooldowns, stats, delete, wipe
- Multilingual (`LANG=fr` or `LANG=en`)
- Atomic JSON writes with corruption backup
- Startup validation: bot won't start if any ID is wrong
- Auto-deploy on push via GitHub Actions

## How it works

1. A user runs `/join` and signs the participation contract
2. The bot assigns a "Participant" role → grants channel visibility
3. They open a **DM with the bot** and run `/confession`
4. The bot posts the confession in the configured channel
5. Server members can vote with ✅ or ❌
6. The author gets a private confirmation

> `/confession` is blocked in server channels — it only works in **DMs**.

## Setup

### Prerequisites

- [Node.js](https://nodejs.org/) v18+
- A Discord bot created on the [Developer Portal](https://discord.com/developers/applications)
- **Privileged intents required:** none (only `Guilds` + `DirectMessages`)

### 1. Clone and install

```bash
git clone https://github.com/Zarivox/confession-bot.git
cd confession-bot
npm install
```

### 2. Configure environment variables

Create a `.env` file at the root based on `.env.example`:

| Variable | Required | Description |
|---|---|---|
| `BOT_TOKEN` | ✅ | Bot authentication token |
| `CLIENT_ID` | ✅ | Application ID |
| `GUILD_ID` | ✅ | Your server's ID |
| `CONFESSION_CHANNEL_ID` | ✅ | Channel where confessions are posted |
| `ADMIN_ID` | ✅ | Your Discord user ID (admin commands) |
| `LANG` | — | Bot language (`en` or `fr`, default: `en`) |
| `MAX_CONFESSIONS_MEMORY` | — | Max confessions kept in JSON (default: 1000) |
| `PARTICIPANT_ROLE_ID` | — | Role assigned on `/join` (enables channel auto-permissions) |
| `ALLOW_CHANNEL_MESSAGES` | — | `true`/`false` — let participants type in the channel (default: `false`) |

> All Discord IDs must be 17–20 digit snowflakes — the bot validates the format on startup and exits if any is malformed.

### 3. Deploy slash commands

```bash
npm run deploy
```

> Global commands (`/confession`, `/join`) may take up to 1 hour to appear.
> Guild commands (`/top`, `/admin`, `/playerlist`) update instantly.

### 4. Start the bot

```bash
npm start
```

On startup, the bot will:
- Validate all environment variables and ID formats
- Verify each ID actually exists via Discord API
- Auto-fix channel permissions (deny `@everyone`, allow participant role)
- Exit with a clear error if anything is wrong

## Commands

### User commands

| Command | Where | Description |
|---|---|---|
| `/join` | Server or DM | Sign the participation contract (required before posting) |
| `/contrat` | Server or DM | Read the participation contract at any time (read-only) |
| `/confession` | DM only | Post an anonymous confession |
| `/confession reveal:true` | DM only | Post a confession with your identity |
| `/top période:...` | Server | Show the most upvoted confessions (week/month/all) |

### Admin commands

| Command | Description |
|---|---|
| `/admin reset @user` | Reset a user's cooldowns (anonymous + public) |
| `/admin setdelay type:... hours:X` | Change cooldown for `Anonymous` or `Public` (0 = disabled) |
| `/admin stats` | Show confession statistics |
| `/admin delete number:X` | Delete a confession by number (edits embed to "deleted") |
| `/admin wipe confirm:RESET` | Delete ALL confessions, cooldowns, consents — restarts at #1 |
| `/admin ban user:@... \| id:... [delete_public:true]` | Ban a user (and optionally remove all their public confessions) |
| `/admin unban user:@... \| id:...` | Unban a user (they must `/join` again) |
| `/admin banlist` | Show all banned users |
| `/admin clearban confirm:CLEARBAN` | Wipe the entire ban list |
| `/admin info user:@... \| id:...` | Full status of a user (banned, consented, role, cooldowns, post count) |
| `/playerlist` | Show all members who signed the contract (paginated) |

> Bans persist through `/admin wipe`. Use `/admin clearban` to wipe the ban list.

## Customising per instance (private overrides)

Two extension points let you keep instance-specific code and text out of the
public repo. Both are **gitignored** — they stay on your VPS only.

**Locale overrides** — `locales/private.js`
Override any string from the active locale (contract text, embed titles, etc.).
Copy `locales/private.example.js` to `locales/private.js`, edit, restart. Keys
you don't define keep their default value.

**Event handlers** — `private-handlers.js`
Register your own Discord event listeners (custom DM commands, audit loggers,
reactions, etc.). Copy `private-handlers.example.js` to `private-handlers.js`,
edit, restart. The default export receives `{ client, lang }` and registers
listeners on the client.

If neither file exists, the bot starts normally with default behaviour.

## Required bot permissions

In the server:
- `View Channels`
- `Send Messages`
- `Embed Links`
- `Read Message History`
- `Manage Roles` (to assign the participant role)
- `Manage Channels` (to auto-fix channel permissions on startup)

> The bot's role must be **above** the participant role in the role hierarchy, otherwise it can't assign it.

## Project structure

```
confession-bot/
├── index.js              # Main bot logic (commands, interactions, events)
├── deploy-commands.js    # Slash command registration
├── confessions.js        # Confession data layer (atomic JSON writes)
├── cooldowns.js          # Cooldown management (anonymous + public)
├── consents.js           # Opt-in consent tracking
├── bans.js               # Ban list management
├── locales/
│   ├── fr.js             # French strings
│   ├── en.js             # English strings
│   └── private.example.js # Template for instance-specific overrides (private.js gitignored)
├── private-handlers.example.js # Template for instance-specific event listeners (private-handlers.js gitignored)
├── setup.sh              # VPS setup helper
├── .github/workflows/    # GitHub Actions auto-deploy
├── package.json
└── .env.example          # Environment variable template
```

## Data persistence

The bot uses flat JSON files for storage. All writes are atomic (write-then-rename) and corrupted files are automatically backed up before reset:

- `confessions.json` — list of confessions, votes, authors
- `cooldowns.json` — last post timestamps, cooldown durations
- `consents.json` — list of users who signed the contract
- `bans.json` — banned user IDs

All four are gitignored — only the templates (`.env.example`) are versioned.

## Stack

- [discord.js](https://discord.js.org/) v14.16+
- Node.js ESM (`"type": "module"`)
- Flat JSON files (no database)
- PM2 for process management on VPS
- GitHub Actions for auto-deploy on push to `main`
