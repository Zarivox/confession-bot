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
  console.log(`Bot connecté en tant que ${c.user.tag}`);
  console.log(`Confessions → salon ID: ${CONFESSION_CHANNEL_ID}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== 'confession') return;

  // Bloquer si la commande est utilisée dans un serveur
  if (interaction.inGuild()) {
    return interaction.reply({
      content: '❌ Cette commande ne peut être utilisée **qu\'en message privé** avec moi.',
      ephemeral: true,
    });
  }

  const message = interaction.options.getString('message');

  // Récupérer le salon de confessions
  let confessionChannel;
  try {
    confessionChannel = await client.channels.fetch(CONFESSION_CHANNEL_ID);
  } catch {
    return interaction.reply({
      content: '❌ Le salon de confessions est introuvable. Contacte un administrateur.',
      ephemeral: true,
    });
  }

  if (!confessionChannel?.isTextBased()) {
    return interaction.reply({
      content: '❌ Le salon configuré n\'est pas un salon textuel valide.',
      ephemeral: true,
    });
  }

  // Construire l'embed de confession anonyme
  const embed = new EmbedBuilder()
    .setColor(0x2b2d31)
    .setTitle('💬 Confession anonyme')
    .setDescription(message)
    .setFooter({ text: 'Anonyme' })
    .setTimestamp();

  // Poster la confession et ajouter les réactions
  try {
    const posted = await confessionChannel.send({ embeds: [embed] });
    await posted.react('✅');
    await posted.react('❌');
  } catch {
    return interaction.reply({
      content: '❌ Impossible d\'envoyer ta confession. Vérifie les permissions du bot dans le salon.',
      ephemeral: true,
    });
  }

  // Confirmer à l'utilisateur en MP (message éphémère = visible que par lui)
  await interaction.reply({
    content: '✅ Ta confession a été postée anonymement !',
    ephemeral: true,
  });
});

client.login(process.env.BOT_TOKEN);
