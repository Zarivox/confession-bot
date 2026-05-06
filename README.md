# 💬 Confession Bot

A Discord bot that lets users send anonymous confessions to a dedicated channel via direct message.

## How it works

1. A user opens a **DM with the bot** and runs the `/confession` command
2. They write their message in the command option
3. The bot posts the confession in the configured channel as an **anonymous embed**
4. Server members can vote with ✅ or ❌ to share their opinion
5. The author gets a private confirmation — no one knows it was them

> The command is blocked in server channels. It only works in **DMs**.

## Setup

### Prerequisites

- [Node.js](https://nodejs.org/) v18+
- A Discord bot created on the [Developer Portal](https://discord.com/developers/applications)

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
CONFESSION_CHANNEL_ID=your_channel_id_here
```

| Variable | Where to find it |
|---|---|
| `BOT_TOKEN` | Developer Portal → Bot → Token |
| `CLIENT_ID` | Developer Portal → General Information → Application ID |
| `CONFESSION_CHANNEL_ID` | Right-click the Discord channel → Copy Channel ID |

### 4. Deploy the slash command

```bash
npm run deploy
```

> Global commands can take up to **1 hour** to appear, but are usually instant.

### 5. Start the bot

```bash
npm start
```

## Required permissions

The bot needs the following permissions in the confession channel:

- `View Channel`
- `Send Messages`
- `Embed Links`
- `Add Reactions`

## Project structure

```
confession-bot/
├── index.js              # Main bot logic
├── deploy-commands.js    # Slash command registration
├── package.json
└── .env.example          # Environment variable template
```

## Stack

- [discord.js](https://discord.js.org/) v14
- Node.js ESM (`"type": "module"`)
