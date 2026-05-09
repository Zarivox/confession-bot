# Getting started

Self-hosting the bot takes about 10 minutes : create a Discord application, copy a few IDs, fill in `.env`, register the slash commands, run.

## Prerequisites

- **Node.js 18+** (LTS recommended)
- A **Discord application + bot** created on the [Developer Portal](https://discord.com/developers/applications)
- A server where you have **`Manage Channels`** + **`Manage Roles`** permissions
- (For VPS deploy) a Linux host with PM2, SSH, and an inbound port for SSH

!!! note "Privileged intents"
    The bot only needs `Guilds` + `DirectMessages` intents — **no privileged intents**. You don't have to enable Message Content / Server Members / Presence on the Developer Portal.

## 1. Clone and install

```bash
git clone https://github.com/Zarivox/confession-bot.git
cd confession-bot
npm install
```

## 2. Create the `.env` file

Copy the template and fill in real values :

```bash
cp .env.example .env
```

Edit `.env`. Each variable is documented in the [Configuration](configuration.md) page.

!!! danger "Required variables"
    The bot **refuses to start** if any of these are missing :
    `BOT_TOKEN`, `CLIENT_ID`, `GUILD_ID`, `CONFESSION_CHANNEL_ID`, `ADMIN_ID`, `AUTHOR_PUB`, `VOTE_SECRET`.

## 3. Invite the bot to your server

Use the OAuth2 URL generator in the Developer Portal :

- **Scopes** : `bot`, `applications.commands`
- **Bot permissions** :
    - View Channels
    - Send Messages
    - Embed Links
    - Read Message History
    - Manage Roles (for the participant role)
    - Manage Channels (for auto-fix of the confession channel permissions)

Open the generated URL, pick your server, authorize.

!!! warning "Role hierarchy"
    The bot's role must be **above** the participant role in your server's role list, otherwise the bot can't assign / remove the role on `/join` and `/admin ban`.

## 4. Register the slash commands

```bash
npm run deploy
```

This calls Discord's API to register all the bot's commands. **Global commands** (`/confession`, `/join`, `/contrat`, `/help`, `/cooldown`) can take up to one hour to appear the first time. **Guild commands** (`/top`, `/admin`, `/playerlist`) update instantly.

!!! tip "Auto-registration on push"
    The provided GitHub Actions workflow runs `node deploy-commands.js` on every push to `main`, so once you've set up CI you only need this manual step the very first time.

## 5. Start the bot

```bash
npm start
```

On startup the bot will :

1. Validate every environment variable + ID format
2. Resolve each ID against the Discord API (`GUILD_ID`, channel, admin user, role)
3. Verify its own bot permissions and role hierarchy
4. Auto-fix the confession channel permissions if needed
5. Auto-migrate any pre-existing `confessions.json` to the split + encrypted format
6. Set the live custom status (`/confession en MP · N participants`)
7. Print `🟢 Bot prêt.`

If anything fails, you get a precise error message and the bot exits — fix the issue and restart.

## What's next

- [Configuration reference](configuration.md) — every env var explained
- [Deployment](deployment.md) — VPS + GitHub Actions auto-deploy
- [Commands](../commands/index.md) — what users and admins can do
