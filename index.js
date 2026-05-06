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

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.DirectMessages,
  ],
});

client.once(Events.ClientReady, (c) => {
  console.log(`Logged in as ${c.user.tag}`);
  console.log(`Confession channel ID: ${CONFESSION_CHANNEL_ID}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  // ─── /confession ───────────────────────────────────────────────────────────
  if (interaction.commandName === 'confession') {
    // Block the command if used inside a server
    if (interaction.inGuild()) {
      return interaction.reply({
        content: '❌ This command can only be used in **direct messages** with me.',
        ephemeral: true,
      });
    }

    const message = interaction.options.getString('message');
    const image = interaction.options.getAttachment('image');

    // Require at least a message or an image
    if (!message && !image) {
      return interaction.reply({
        content: '❌ You must provide at least a message or an image.',
        ephemeral: true,
      });
    }

    // Check the user cooldown
    const remaining = getRemainingCooldown(interaction.user.id);
    if (remaining > 0) {
      return interaction.reply({
        content: `⏳ You need to wait **${formatDuration(remaining)}** before posting a new confession.`,
        ephemeral: true,
      });
    }

    // Fetch the confession channel
    let confessionChannel;
    try {
      confessionChannel = await client.channels.fetch(CONFESSION_CHANNEL_ID);
    } catch {
      return interaction.reply({
        content: '❌ The confession channel could not be found. Please contact an administrator.',
        ephemeral: true,
      });
    }

    if (!confessionChannel?.isTextBased()) {
      return interaction.reply({
        content: '❌ The configured channel is not a valid text channel.',
        ephemeral: true,
      });
    }

    const embed = new EmbedBuilder()
      .setColor(0xE8C547)
      .setTitle('💬 Anonymous Confession')
      .setFooter({ text: 'Anonymous' })
      .setTimestamp();

    if (message) embed.setDescription(message);

    // Validate and attach the image if provided
    if (image) {
      if (!image.contentType?.startsWith('image/')) {
        return interaction.reply({
          content: '❌ The attached file is not a valid image.',
          ephemeral: true,
        });
      }
      embed.setImage(image.url);
    }

    // Post the confession and add voting reactions
    try {
      const posted = await confessionChannel.send({ embeds: [embed] });
      await posted.react('✅');
      await posted.react('❌');
    } catch {
      return interaction.reply({
        content: '❌ Failed to send your confession. Check the bot permissions in the channel.',
        ephemeral: true,
      });
    }

    // Record the confession timestamp
    setLastConfession(interaction.user.id);

    const delay = getDelay();
    await interaction.reply({
      content: `✅ Your confession has been posted anonymously! You can post again in **${formatDuration(delay)}**.`,
      ephemeral: true,
    });
  }

  // ─── /admin ────────────────────────────────────────────────────────────────
  if (interaction.commandName === 'admin') {
    // Restricted to the admin defined in .env
    if (interaction.user.id !== ADMIN_ID) {
      return interaction.reply({
        content: '❌ You do not have permission to use this command.',
        ephemeral: true,
      });
    }

    const sub = interaction.options.getSubcommand();

    if (sub === 'reset') {
      const target = interaction.options.getUser('user');
      resetCooldown(target.id);
      return interaction.reply({
        content: `✅ Cooldown reset for **${target.username}**. They can post a confession immediately.`,
        ephemeral: true,
      });
    }

    if (sub === 'setdelay') {
      const hours = interaction.options.getNumber('hours');
      setDelay(hours * 3600000);
      return interaction.reply({
        content: `✅ Cooldown updated: users can now post every **${hours}h**.`,
        ephemeral: true,
      });
    }
  }
});

client.login(process.env.BOT_TOKEN);
