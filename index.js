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
import {
  saveConfession,
  getAll,
  getSince,
} from './confessions.js';

const CONFESSION_CHANNEL_ID = process.env.CONFESSION_CHANNEL_ID;
const ADMIN_ID = process.env.ADMIN_ID;

const lang = (await import(`./locales/${process.env.LANG === 'fr' ? 'fr' : 'en'}.js`)).default;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.DirectMessages,
  ],
});

client.once(Events.ClientReady, (c) => {
  console.log(`Connecté en tant que ${c.user.tag}`);
  console.log(`Salon des confessions : ${CONFESSION_CHANNEL_ID}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  // ─── /confession ───────────────────────────────────────────────────────────
  if (interaction.commandName === 'confession') {
    if (interaction.inGuild()) {
      return interaction.reply({ content: lang.dmOnly, ephemeral: true });
    }

    const message = interaction.options.getString('message');
    const image   = interaction.options.getAttachment('image');

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

    if (image && !image.contentType?.startsWith('image/')) {
      return interaction.reply({ content: lang.invalidImage, ephemeral: true });
    }

    // Numéro de confession provisoire pour construire l'embed
    const nextNumber = getAll().length + 1;

    const embed = new EmbedBuilder()
      .setColor(0xE8C547)
      .setTitle(`${lang.embedTitle} #${nextNumber}`)
      .setFooter({ text: lang.embedFooter })
      .setTimestamp();

    if (message) embed.setDescription(message);
    if (image)   embed.setImage(image.url);

    let posted;
    try {
      posted = await confessionChannel.send({ embeds: [embed] });
      await posted.react('✅');
      await posted.react('❌');
    } catch {
      return interaction.reply({ content: lang.sendError, ephemeral: true });
    }

    // Enregistrer la confession avec l'ID du message Discord
    const number = saveConfession(posted.id, CONFESSION_CHANNEL_ID);
    setLastConfession(interaction.user.id);

    await interaction.reply({
      content: lang.success(formatDuration(getDelay())),
      ephemeral: true,
    });
  }

  // ─── /top ──────────────────────────────────────────────────────────────────
  if (interaction.commandName === 'top') {
    await interaction.deferReply();

    const period = interaction.options.getString('période') ?? 'week';

    const periodMs = {
      week:  7  * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000,
      all:   Infinity,
    }[period];

    const since = period === 'all' ? 0 : Date.now() - periodMs;
    const confessions = getSince(since);

    if (confessions.length === 0) {
      return interaction.editReply(lang.topEmpty);
    }

    // Récupérer les votes depuis Discord
    const channel = await client.channels.fetch(CONFESSION_CHANNEL_ID);
    const withVotes = [];

    for (const c of confessions) {
      try {
        const msg = await channel.messages.fetch(c.messageId);
        const yes = msg.reactions.cache.get('✅')?.count ?? 1;
        const no  = msg.reactions.cache.get('❌')?.count ?? 1;
        withVotes.push({ ...c, yes: yes - 1, no: no - 1 }); // -1 pour enlever le vote du bot
      } catch {
        // Message supprimé, on l'ignore
      }
    }

    // Trier par ✅ décroissant et prendre le top 5
    const top5 = withVotes
      .sort((a, b) => b.yes - a.yes)
      .slice(0, 5);

    const periodLabel = { week: lang.periodWeek, month: lang.periodMonth, all: lang.periodAll }[period];

    const embed = new EmbedBuilder()
      .setColor(0xE8C547)
      .setTitle(`🏆 ${lang.topTitle} — ${periodLabel}`)
      .setTimestamp();

    const lines = top5.map((c, i) =>
      `**#${c.number}** — ✅ ${c.yes} · ❌ ${c.no}`
    );

    embed.setDescription(lines.join('\n'));

    await interaction.editReply({ embeds: [embed] });
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

    if (sub === 'stats') {
      await interaction.deferReply({ ephemeral: true });

      const all   = getAll();
      const week  = getSince(Date.now() - 7  * 24 * 60 * 60 * 1000);
      const today = getSince(Date.now() - 24 * 60 * 60 * 1000);

      // Récupérer les votes de toutes les confessions
      const channel = await client.channels.fetch(CONFESSION_CHANNEL_ID);
      let totalYes = 0, totalNo = 0;

      // Calculer l'heure de pointe
      const hourCounts = new Array(24).fill(0);

      for (const c of all) {
        const h = new Date(c.timestamp).getHours();
        hourCounts[h]++;

        try {
          const msg = await channel.messages.fetch(c.messageId);
          const yes = (msg.reactions.cache.get('✅')?.count ?? 1) - 1;
          const no  = (msg.reactions.cache.get('❌')?.count ?? 1) - 1;
          totalYes += yes;
          totalNo  += no;
        } catch {
          // Message supprimé
        }
      }

      const peakHour  = hourCounts.indexOf(Math.max(...hourCounts));
      const totalVotes = totalYes + totalNo;
      const posRatio  = totalVotes > 0 ? Math.round((totalYes / totalVotes) * 100) : 0;
      const avgPerDay = all.length > 0
        ? (all.length / Math.max(1, Math.ceil((Date.now() - all[0].timestamp) / 86400000))).toFixed(1)
        : 0;

      const embed = new EmbedBuilder()
        .setColor(0xE8C547)
        .setTitle('📊 Statistiques des confessions')
        .addFields(
          { name: '📝 Total',           value: `${all.length} confessions`,    inline: true },
          { name: '📅 Cette semaine',   value: `${week.length} confessions`,   inline: true },
          { name: '🌅 Aujourd\'hui',    value: `${today.length} confessions`,  inline: true },
          { name: '✅ Votes positifs',  value: `${totalYes} (${posRatio}%)`,   inline: true },
          { name: '❌ Votes négatifs',  value: `${totalNo} (${100-posRatio}%)`, inline: true },
          { name: '📈 Moyenne/jour',    value: `${avgPerDay}`,                 inline: true },
          { name: '⏰ Heure de pointe', value: `${peakHour}h–${peakHour+1}h`, inline: true },
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    }
  }
});

client.login(process.env.BOT_TOKEN);
