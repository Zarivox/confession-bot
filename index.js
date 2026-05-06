import { Client, GatewayIntentBits, EmbedBuilder, Events } from 'discord.js';
import 'dotenv/config';

const CONFESSION_CHANNEL_ID = process.env.CONFESSION_CHANNEL_ID;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.DirectMessages,
  ],
});

client.once(Events.ClientReady, (c) => {
  console.log(`Logged in as ${c.user.tag}`);
  console.log(`Confessions channel ID: ${CONFESSION_CHANNEL_ID}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== 'confession') return;

  // Block the command if used inside a server
  if (interaction.inGuild()) {
    return interaction.reply({
      content: '❌ This command can only be used in **direct messages** with me.',
      ephemeral: true,
    });
  }

  const message = interaction.options.getString('message');
  const image = interaction.options.getAttachment('image');

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
    .setColor(0x2b2d31)
    .setTitle('💬 Anonymous Confession')
    .setDescription(message)
    .setFooter({ text: 'Anonymous' })
    .setTimestamp();

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

  // Confirm to the user via ephemeral reply (only visible to them)
  await interaction.reply({
    content: '✅ Your confession has been posted anonymously!',
    ephemeral: true,
  });
});

client.login(process.env.BOT_TOKEN);
