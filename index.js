import { Client, GatewayIntentBits, EmbedBuilder, Events } from 'discord.js';
import 'dotenv/config';
import {
  getRemainingCooldown,
  setLastConfession,
  resetCooldown,
  getDelay,
  setDelay,
  formatDuration,
} from './cooldowns.js';

const CONFESSION_CHANNEL_ID = process.env.CONFESSION_CHANNEL_ID;
const ADMIN_ID = process.env.ADMIN_ID;

// Load locale based on LANG env variable (default: en)
const lang = (await import(`./locales/${process.env.LANG === 'fr' ? 'fr' : 'en'}.js`)).default;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.DirectMessages,
  ],
});

client.once(Events.ClientReady, (c) => {
  console.log(`Logged in as ${c.user.tag}`);
  console.log(`Language: ${process.env.LANG === 'fr' ? 'fr' : 'en'}`);
  console.log(`Confession channel ID: ${CONFESSION_CHANNEL_ID}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  // ─── /confession ───────────────────────────────────────────────────────────
  if (interaction.commandName === 'confession') {
    if (interaction.inGuild()) {
      return interaction.reply({ content: lang.dmOnly, ephemeral: true });
    }

    const message = interaction.options.getString('message');
    const image = interaction.options.getAttachment('image');

    if (!message && !image) {
      return interaction.reply({ content: lang.noContent, ephemeral: true });
    }

    const remaining = getRemainingCooldown(interaction.user.id);
    if (remaining > 0) {
      return interaction.reply({ content: lang.cooldown(formatDuration(remaining)), ephemeral: true });
    }

    let confessionChannel;
    try {
      confessionChannel = await client.channels.fetch(CONFESSION_CHANNEL_ID);
    } catch {
      return interaction.reply({ content: lang.channelNotFound, ephemeral: true });
    }

    if (!confessionChannel?.isTextBased()) {
      return interaction.reply({ content: lang.invalidChannel, ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setColor(0xE8C547)
      .setTitle(lang.embedTitle)
      .setFooter({ text: lang.embedFooter })
      .setTimestamp();

    if (message) embed.setDescription(message);

    if (image) {
      if (!image.contentType?.startsWith('image/')) {
        return interaction.reply({ content: lang.invalidImage, ephemeral: true });
      }
      embed.setImage(image.url);
    }

    try {
      const posted = await confessionChannel.send({ embeds: [embed] });
      await posted.react('✅');
      await posted.react('❌');
    } catch {
      return interaction.reply({ content: lang.sendError, ephemeral: true });
    }

    setLastConfession(interaction.user.id);

    await interaction.reply({
      content: lang.success(formatDuration(getDelay())),
      ephemeral: true,
    });
  }

  // ─── /admin ────────────────────────────────────────────────────────────────
  if (interaction.commandName === 'admin') {
    if (interaction.user.id !== ADMIN_ID) {
      return interaction.reply({ content: lang.adminDenied, ephemeral: true });
    }

    const sub = interaction.options.getSubcommand();

    if (sub === 'reset') {
      const target = interaction.options.getUser('user');
      resetCooldown(target.id);
      return interaction.reply({ content: lang.resetSuccess(target.username), ephemeral: true });
    }

    if (sub === 'setdelay') {
      const hours = interaction.options.getNumber('hours');
      setDelay(hours * 3600000);
      return interaction.reply({ content: lang.delaySuccess(hours), ephemeral: true });
    }
  }
});

client.login(process.env.BOT_TOKEN);
