# Customization

The bot is designed to be self-hostable as-is, but two **gitignored extension points** let you customize per-instance without modifying versioned code :

1. `locales/private.js` — overrides any locale string
2. `private-handlers.js` — registers extra Discord event listeners

Both are optional. If neither file exists, the bot starts normally with default behavior.

---

## Locale overrides — `locales/private.js`

Use this to customize the contract text, embed titles, error messages, or any other user-facing string — without forking the public locale files.

### How it works

On startup, the bot loads the active locale (`fr.js` or `en.js`) and merges `locales/private.js` on top :

```js
let lang = (await import(`./locales/${LANG}.js`)).default;
try {
  const priv = (await import('./locales/private.js')).default;
  lang = { ...lang, ...priv };
} catch { /* file absent → use defaults */ }
```

Any key you define in `private.js` overrides the corresponding key in the public locale. Keys you don't define keep their default value.

### Example : custom contract for your server

Copy the template and edit :

```bash
cp locales/private.example.js locales/private.js
```

Then edit `locales/private.js` :

```js
export default {
  joinContractTitle: '📋 Server X — Confession participation contract',

  joinContractDesc: [
    '> Before posting, please read and accept the following terms.\n',
    '**1. Content**',
    'This is a private server — confessions can be sensitive.',
    '',
    '**2. Anonymity**',
    'Confessions are 100% anonymous to other members.',
    '',
    '**3. Moderation**',
    'Admin reserves the right to remove any confession without notice.',
    '',
    '**4. Commitment**',
    'By typing the accept phrase, you confirm you have read and agree.',
  ].join('\n'),

  // You can override any other key :
  embedTitle: '🤐 Anonymous secret',
  joinSuccessTitle: '🎉 Welcome aboard!',
};
```

Restart the bot — your overrides take effect.

### Sanity check at startup

The bot validates that critical locale keys (`joinAcceptPhrase`, `joinModalTitle`, `joinModalLabel`, `joinButton`, `joinContractTitle`, `joinContractDesc`) are non-empty strings **after** the merge. If you accidentally break one with a typo or wrong type, the bot exits with a clear error instead of crashing on the first interaction.

### Discord modal label limit

Modal input labels are capped at **45 characters** by Discord. If you customize `joinModalLabel`, keep it short. The default fits :

```js
joinModalLabel: 'Type : I accept and consent', // 27 chars ✅
```

---

## Custom event listeners — `private-handlers.js`

Use this to add Discord event listeners (custom DM commands, audit loggers, reactions, automatic actions on join, etc.) that aren't versioned.

### How it works

If `private-handlers.js` exists, its default export is called once at startup with `{ client, lang }` :

```js
try {
  const { default: registerPrivateHandlers } = await import('./private-handlers.js');
  await registerPrivateHandlers({ client, lang });
} catch (e) {
  if (e.code !== 'ERR_MODULE_NOT_FOUND') process.exit(1);
}
```

A missing file is silently ignored. A syntax error fails loudly with a clear message.

### Example : audit logger

```js
import { Events, ChannelType } from 'discord.js';

export default function register({ client, lang }) {
  const AUDIT_CHANNEL = process.env.AUDIT_CHANNEL_ID;
  if (!AUDIT_CHANNEL) return;

  client.on(Events.MessageCreate, async (msg) => {
    if (msg.author.bot) return;
    if (msg.channel.type !== ChannelType.DM) return;
    // log every DM the bot receives to the audit channel
    const ch = await client.channels.fetch(AUDIT_CHANNEL).catch(() => null);
    if (ch?.isTextBased()) {
      ch.send(`📨 DM from ${msg.author.tag}: ${msg.content.slice(0, 200)}`);
    }
  });
}
```

### Example : welcome on join

```js
import { Events } from 'discord.js';

export default function register({ client, lang }) {
  client.on(Events.GuildMemberAdd, async (member) => {
    try {
      await member.send(
        `Welcome to the server! Run \`/join\` to access the confession system.`
      );
    } catch { /* DM closed */ }
  });
}
```

### What you have access to

The `register` function receives :

- `client` — the live `discord.js` `Client` instance, already connected
- `lang` — the merged locale object (defaults + your `private.js` overrides)

You can :

- Register any Discord event (`Events.MessageCreate`, `Events.GuildMemberAdd`, etc.)
- Read user IDs from `process.env`
- Import the data layer modules (`confessions.js`, `consents.js`, etc.) if you want to query state

You should **not** :

- Block the function — register listeners and return quickly
- Register things that depend on slash command interactions (those are handled in core `index.js`)

---

## What's gitignored

The `.gitignore` blocks anything that should stay local-only :

```gitignore
node_modules/
.env
.env.backup-*

# Runtime data files
confessions-public.json
confessions-anon.json
confessions.json
confessions.json.legacy-backup-*
cooldowns.json
consents.json
bans.json
*.json.tmp
*.bak-*

# Per-instance overrides
locales/private.js
locales/private.js.bak-*
private-handlers.js
private-handlers.js.bak-*

# Local operational scripts
scripts/
```

If you fork the repo, your private files stay local on your VPS. The public repo only contains the templates (`*.example.js`).

## Tips

- **Iteration cycle** : edit private file → `pm2 restart confession-bot` → test in Discord. Takes 5 seconds.
- **Backup** : your `private.js` and `private-handlers.js` aren't in git, so back them up separately if they contain anything important.
- **Versioning your privates** : if you want to track changes, create a separate **private** repo and clone it inside your bot directory, or just keep dated copies.
