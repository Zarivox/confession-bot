# Commands

The bot exposes both **user commands** (anyone can run, with rules) and **admin commands** (gated by `ADMIN_ID`).

Slash commands are split into two categories at registration time :

- **Global commands** — usable in DM with the bot **and** on any server. May take up to one hour to appear after first registration.
- **Guild commands** — usable only on the configured `GUILD_ID`. Update instantly.

| Command | Type | Where | Purpose |
|---|---|---|---|
| `/confession` | global | DM only (blocked in server) | Post a confession |
| `/join` | global | server or DM | Open the participation contract modal |
| `/contrat` | global | server or DM | Re-read the contract |
| `/help` | global | server or DM | Show the help embed |
| `/cooldown` | global | DM only | Show your remaining cooldowns |
| `/top` | guild | server | Top voted confessions (week / month / all) |
| `/playerlist` | guild | server | Paginated list of contract signers |
| `/admin …` | guild | server | Admin subcommands (see [Admin commands](admin.md)) |

## Two reads to dive in

- [User commands](user.md) — what every member can use
- [Admin commands](admin.md) — moderator panel, gated by `ADMIN_ID`
