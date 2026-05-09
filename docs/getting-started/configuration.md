# Configuration

All configuration lives in a single `.env` file at the project root. The bot validates everything at startup and exits with a clear error message if any value is missing or malformed.

## Reference table

| Variable | Required | Format | Description |
|---|---|---|---|
| `BOT_TOKEN` | ✅ | string | Bot authentication token (Developer Portal → Bot → Token) |
| `CLIENT_ID` | ✅ | snowflake (17–20 digits) | Application ID (Developer Portal → General Information) |
| `GUILD_ID` | ✅ | snowflake | Your server's ID |
| `CONFESSION_CHANNEL_ID` | ✅ | snowflake | Channel where confessions are posted |
| `ADMIN_ID` | ✅ | snowflake | Discord user ID who can run `/admin` and is the sole authority |
| `AUTHOR_PUB` | ✅ | base64, 32 bytes | X25519 public key — used to encrypt anonymous author IDs at rest |
| `VOTE_SECRET` | ✅ | base64, ≥16 bytes | HMAC key used to anonymize voter IDs in JSON files |
| `LANG` | — | `en` \| `fr` | Bot language (default: `en`) |
| `MAX_CONFESSIONS_MEMORY` | — | integer | Max confessions kept in JSON (default: `1000`). Oldest evicted on overflow. Discord messages remain untouched. |
| `PARTICIPANT_ROLE_ID` | — | snowflake | Role assigned on `/join`. If set, the bot auto-fixes channel permissions so only members with this role can see confessions. |
| `ALLOW_CHANNEL_MESSAGES` | — | `true` \| `false` | Let participants send regular messages in the confession channel (default: `false`) |

!!! tip "Snowflake format"
    All Discord IDs must be 17–20 digit numeric strings ("snowflakes"). The bot validates the format on startup. To copy an ID, enable Developer Mode in Discord (`Settings → Advanced → Developer Mode`), then right-click anything and pick `Copy ID`.

## Required vs optional behavior

The bot **will not start** without the required variables. Optional variables enable additional features :

- **Without `PARTICIPANT_ROLE_ID`** : the bot still works but you have to manage channel access manually. The role-related commands behave as no-ops where applicable.
- **Without `LANG`** : defaults to English.
- **Without `MAX_CONFESSIONS_MEMORY`** : default is 1000, more than enough for most servers.
- **Without `ALLOW_CHANNEL_MESSAGES`** : defaults to `false` (participants can read but not chat in the channel).

## Internal vs operational variables

The bot also reads :

- `_K` — optional internal trigger token used by [`private-handlers.js`](../customization.md). Not validated by core, only used if you've set up a private handler that depends on it.

You can add any other variable you need in `.env` — anything beyond the ones in the table above is ignored by core and only relevant if you reference it from your own code.

## Where the env file is loaded

The bot uses `dotenv.config({ override: true })` :

```js
import dotenv from 'dotenv';
dotenv.config({ override: true });
```

The `override: true` flag means values from `.env` **win over any shell-inherited variables**. If your shell has `LANG=C.UTF-8` set, the bot will still use the `LANG=fr` from `.env`. This avoids the classic gotcha where the bot runs in the wrong language because the shell exported a different `LANG`.

## Validating your `.env` quickly

Just run :

```bash
node index.js
```

The startup checks will tell you exactly what's missing or wrong. Common errors :

| Error | Fix |
|---|---|
| `Variables d'environnement manquantes : X, Y` | Add missing variables to `.env` |
| `IDs au format invalide` | Make sure each ID is 17–20 digits |
| `serveur introuvable ou bot non présent` | Check the bot is in the server, and `GUILD_ID` is right |
| `n'est pas un salon textuel` | `CONFESSION_CHANNEL_ID` points to a voice/category/forum channel |
| `Permission "Gérer les rôles" manquante` | Re-invite the bot with the right OAuth scopes |
| `rôle le plus haut du bot doit être AU-DESSUS du rôle participant` | Move the bot's role up in your server's role list |
| `AUTHOR_PUB length is X bytes (expected 32)` | The base64 string must decode to exactly 32 bytes |
| `VOTE_SECRET length is X bytes (expected ≥16)` | Use at least 16 bytes (24+ recommended) |

## Security hygiene

- **Never commit `.env`** — it's in `.gitignore` for a reason
- **Rotate `BOT_TOKEN`** if you suspect leak (Developer Portal → Bot → Reset Token)
- **`AUTHOR_PUB`** is safe to commit publicly (it's a public key by definition)
- **`VOTE_SECRET`** should be treated like a server-side secret — leaking it lets an attacker test "did user X vote on confession N?" if they know X
