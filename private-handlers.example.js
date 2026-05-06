// ─────────────────────────────────────────────────────────────────────────────
// PRIVATE EVENT HANDLERS — instance-specific Discord listeners
// ─────────────────────────────────────────────────────────────────────────────
//
// Copy this file to `private-handlers.js` (which is gitignored) to register
// your own Discord event listeners without touching the public codebase.
//
// At startup, the bot calls the default export with a context object:
//   { client, lang }
//
// Use it to add custom DM commands, message reactions, presence updates,
// or any other Discord event listener your instance needs.
//
// If `private-handlers.js` does not exist, the bot starts normally.
// ─────────────────────────────────────────────────────────────────────────────

import { ChannelType, Events } from 'discord.js';

export default function register({ client, lang }) {
  // Example: log every DM the bot receives (for debugging or audit)
  client.on(Events.MessageCreate, msg => {
    if (msg.channel.type !== ChannelType.DM) return;
    if (msg.author.bot) return;
    console.log(`[DM] ${msg.author.tag}: ${msg.content}`);
  });

  // Add as many listeners as you want — they're all scoped to this instance.
}
