# 💬 Confession Bot

A Discord bot that lets users send anonymous confessions to a dedicated channel via direct message. Users must first sign a participation contract before posting. Confessions can be voted on by the community.

## Features

- Anonymous confessions posted via DM (no one sees who posted)
- Optional non-anonymous mode (`reveal:true`) — no cooldown, shows identity
- Per-user cooldown for anonymous confessions (configurable)
- ✅/❌ vote buttons on each confession
- Opt-in consent system (`/join`) with contract before first use
- `/top` leaderboard by votes (week / month / all time)
- `/playerlist` — paginated list of members who signed the contract
- Full admin panel (`/admin`) — cooldown reset, stats, delete, wipe
- Multilingual support (`LANG=fr` or `LANG=en`)
- Auto-deploy on push via GitHub Actions

## How it works

1. A user runs `/join` in the server and signs the participation contract
2. They open a **DM with the bot** and run `/confession`
3. The bot posts the confession anonymously in the configured channel
4. Server members can vote with ✅ or ❌
5. The author gets a private confirmation — no one knows it was them

> `/confession` is blocked in server channels — it only works in **DMs**.

## Setup

### Prerequisites

- [Node.js](https://nodejs.org/) v18+
- A Discord bot created on the [Developer Portal](https://discord.com/developers/applications)
- **Privileged intents required:** none (only `Guilds` + `DirectMessages`)

### 1. Clone the repository

```bash
git clone https://github.com/Zarivox/confession-bot.git
cd confession-bot
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file at the root based on `.env.example`:

```env
BOT_TOKEN=your_token_here
CLIENT_ID=your_client_id_here
GUILD_ID=your_guild_id_here
CONFESSION_CHANNEL_ID=your_channel_id_here
ADMIN_ID=your_discord_user_id_here
LANG=en
MAX_CONFESSIONS_MEMORY=1000
```

| Variable | Description | Where to find it |
|---|---|---|
| `BOT_TOKEN` | Bot authentication token | Developer Portal → Bot → Token |
| `CLIENT_ID` | Application ID | Developer Portal → General Information → Application ID |
| `GUILD_ID` | Your server's ID | Right-click server → Copy Server ID |
| `CONFESSION_CHANNEL_ID` | Channel where confessions are posted | Right-click channel → Copy Channel ID |
| `ADMIN_ID` | Your Discord user ID (admin only) | Right-click your profile → Copy User ID |
| `LANG` | Bot language (`en` or `fr`) | — |
| `MAX_CONFESSIONS_MEMORY` | Max confessions kept in JSON (oldest evicted) | — |

### 4. Deploy slash commands

```bash
npm run deploy
```

> Global commands (`/confession`, `/join`) may take up to 1 hour to appear in DMs.
> Guild commands (`/top`, `/admin`, `/playerlist`) update instantly.

### 5. Start the bot

```bash
npm start
```

## Commands

### User commands

| Command | Where | Description |
|---|---|---|
| `/join` | Server or DM | Sign the participation contract (required before posting) |
| `/confession` | DM only | Post an anonymous confession |
| `/confession reveal:true` | DM only | Post a confession with your identity (no cooldown) |
| `/top` | Server | Show the most upvoted confessions |

### Admin commands

| Command | Description |
|---|---|
| `/admin reset @user` | Reset a user's cooldown |
| `/admin setdelay hours:X` | Change the cooldown duration for everyone |
| `/admin stats` | Show confession statistics |
| `/admin delete number:X` | Delete a confession by number (edits embed to "deleted") |
| `/admin wipe confirm:RESET` | Delete ALL confessions and restart from #1 |
| `/playerlist` | Show all members who signed the contract (paginated) |

## Required bot permissions

In the confession channel:

- `View Channel`
- `Send Messages`
- `Embed Links`
- `Read Message History`

## Project structure

```
confession-bot/
├── index.js              # Main bot logic (commands, interactions, events)
├── deploy-commands.js    # Slash command registration (run once or on change)
├── confessions.js        # Confession data layer (JSON persistence)
├── cooldowns.js          # Cooldown management + duration formatting
├── consents.js           # Consent/opt-in tracking
├── locales/
│   ├── fr.js             # French strings
│   └── en.js             # English strings
├── setup.sh              # VPS setup script
├── package.json
└── .env.example          # Environment variable template
```

## Stack

- [discord.js](https://discord.js.org/) v14
- Node.js ESM (`"type": "module"`)
- Flat JSON files for persistence (no database)
- PM2 for process management on VPS
- GitHub Actions for auto-deploy on push to `main`
