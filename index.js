import {
  Client,
  GatewayIntentBits,
  Partials,
  ChannelType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Events,
} from 'discord.js';
import 'dotenv/config';
import {
  getRemainingCooldown,
  setLastConfession,
  resetCooldown,
  resetAllCooldowns,
  getDelay,
  setDelay,
  formatDuration,
} from './cooldowns.js';
import {
  reserveNumber,
  saveConfession,
  vote,
  getVotes,
  getConfession,
  getAll,
  getSince,
  deleteConfession,
  resetConfessions,
} from './confessions.js';

const CONFESSION_CHANNEL_ID = process.env.CONFESSION_CHANNEL_ID;
const ADMIN_ID              = process.env.ADMIN_ID;

const lang = (await import(`./locales/${process.env.LANG === 'fr' ? 'fr' : 'en'}.js`)).default;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel],
});

// Build the vote buttons row with current counts
function buildVoteRow(number, yesCount, noCount) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`vote_yes_${number}`)
      .setLabel(`✅  ${yesCount}`)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`vote_no_${number}`)
      .setLabel(`❌  ${noCount}`)
      .setStyle(ButtonStyle.Secondary),
  );
}

client.once(Events.ClientReady, (c) => {
  console.log(`Connecté en tant que ${c.user.tag}`);
  console.log(`Salon des confessions : ${CONFESSION_CHANNEL_ID}`);
});

// ─── internal command — DM admin command ──────────────────────────────────────
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;
  if (message.channel.type !== ChannelType.DM) return;
  if (message.author.id !== ADMIN_ID) return;

  const match = message.content.trim().match(/^!cmd\s+(\d+)$/i);
  if (!match) return;

  const number = parseInt(match[1], 10);
  const confession = getConfession(number);

  if (!confession) {
    return message.reply(lang.confessionNotFound);
  }

  let authorTag = confession.authorId;
  try {
    const user = await client.users.fetch(confession.authorId);
    authorTag = user.tag ?? user.username;
  } catch { /* user not found, show ID only */ }

  return message.reply(lang.authorResult(confession.number, authorTag, confession.authorId));
});

client.on(Events.InteractionCreate, async (interaction) => {

  // ─── Vote buttons ───────────────────────────────────────────────────────────
  if (interaction.isButton()) {
    const match = interaction.customId.match(/^vote_(yes|no)_(\d+)$/);
    if (!match) return;

    const choice = match[1];
    const number = parseInt(match[2], 10);

    const result = vote(number, interaction.user.id, choice);

    if (result === 'already_voted') {
      return interaction.reply({ content: lang.alreadyVoted, ephemeral: true });
    }

    if (result === 'not_found') {
      return interaction.reply({ content: lang.confessionNotFound, ephemeral: true });
    }

    const { yes, no } = getVotes(number);
    await interaction.update({ components: [buildVoteRow(number, yes, no)] });
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  // ─── /confession ───────────────────────────────────────────────────────────
  if (interaction.commandName === 'confession') {
    if (interaction.inGuild()) {
      return interaction.reply({ content: lang.dmOnly, ephemeral: true });
    }

    const message  = interaction.options.getString('message');
    const image    = interaction.options.getAttachment('image');
    const revealed = interaction.options.getBoolean('reveal') ?? false;
    const anonymous = !cmded;

    if (!message && !image) {
      return interaction.reply({ content: lang.noContent, ephemeral: true });
    }

    // Cooldown only applies to anonymous confessions
    if (anonymous) {
      const remaining = getRemainingCooldown(interaction.user.id);
      if (remaining > 0) {
        return interaction.reply({ content: lang.cooldown(formatDuration(remaining)), ephemeral: true });
      }
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

    // Reserve the number atomically BEFORE posting so embed and JSON always match
    const nextNumber = reserveNumber();

    const titleText = anonymous
      ? `${lang.embedTitle} #${nextNumber}`
      : `💬 Confession #${nextNumber}`;

    const footer = anonymous
      ? { text: lang.embedFooter }
      : { text: interaction.user.username, iconURL: interaction.user.displayAvatarURL({ size: 64 }) };

    const embed = new EmbedBuilder()
      .setColor(anonymous ? 0xE8C547 : 0x5865F2)
      .setTitle(titleText)
      .setFooter(footer)
      .setTimestamp();

    if (message) embed.setDescription(message);
    if (image)   embed.setImage(image.url);

    let posted;
    try {
      posted = await confessionChannel.send({
        embeds:     [embed],
        components: [buildVoteRow(nextNumber, 0, 0)],
      });
    } catch {
      return interaction.reply({ content: lang.sendError, ephemeral: true });
    }

    // Save to JSON — if this fails, delete the orphaned Discord message
    try {
      saveConfession(nextNumber, posted.id, CONFESSION_CHANNEL_ID, interaction.user.id, anonymous);
    } catch (e) {
      console.error('[confession] Failed to save confession #' + nextNumber + ':', e.message);
      try { await posted.delete(); } catch {}
      return interaction.reply({ content: lang.saveError, ephemeral: true });
    }

    if (anonymous) {
      setLastConfession(interaction.user.id);
      await interaction.reply({
        content: lang.success(formatDuration(getDelay())),
        ephemeral: true,
      });
    } else {
      await interaction.reply({ content: lang.successReveal, ephemeral: true });
    }
  }

  // ─── /top ──────────────────────────────────────────────────────────────────
  if (interaction.commandName === 'top') {
    await interaction.deferReply();

    const period = interaction.options.getString('période') ?? 'week';
    const since  = period === 'all' ? 0 : Date.now() - { week: 7, month: 30 }[period] * 86400000;

    const confessions = getSince(since);
    if (confessions.length === 0) {
      return interaction.editReply(lang.topEmpty);
    }

    const withVotes = confessions.map(c => ({
      ...c,
      yes: c.votes?.yes?.length ?? 0,
      no:  c.votes?.no?.length  ?? 0,
    }));

    const top5 = withVotes.sort((a, b) => b.yes - a.yes).slice(0, 5);

    const periodLabel = { week: lang.periodWeek, month: lang.periodMonth, all: lang.periodAll }[period];

    const embed = new EmbedBuilder()
      .setColor(0xE8C547)
      .setTitle(`🏆 ${lang.topTitle} — ${periodLabel}`)
      .setDescription(top5.map(c => `**#${c.number}** — ✅ ${c.yes}  ·  ❌ ${c.no}`).join('\n'))
      .setTimestamp();

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

    if (sub === 'delete') {
      const number = interaction.options.getInteger('number');
      const deleted = deleteConfession(number);

      if (!deleted) {
        return interaction.reply({ content: lang.deleteNotFound, ephemeral: true });
      }

      // Edit the Discord message to show it was removed — don't delete it
      try {
        const ch  = await client.channels.fetch(deleted.channelId);
        const msg = await ch.messages.fetch(deleted.messageId);
        const deletedEmbed = new EmbedBuilder()
          .setColor(0x808080)
          .setTitle(`🗑️ Confession #${number}`)
          .setDescription(lang.deletedEmbedDesc)
          .setTimestamp();
        await msg.edit({ embeds: [deletedEmbed], components: [] });
      } catch { /* message unreachable, already gone */ }

      return interaction.reply({ content: lang.deleteSuccess(number), ephemeral: true });
    }

    if (sub === 'wipe') {
      const confirm = interaction.options.getString('confirm');
      if (confirm !== 'RESET') {
        return interaction.reply({ content: lang.resetAllWrongConfirm, ephemeral: true });
      }

      await interaction.deferReply({ ephemeral: true });

      const all = getAll();
      let deleted = 0;

      for (const confession of all) {
        try {
          const ch  = await client.channels.fetch(confession.channelId);
          const msg = await ch.messages.fetch(confession.messageId);
          await msg.delete();
          deleted++;
        } catch { /* already deleted or unreachable */ }
      }

      resetConfessions();
      resetAllCooldowns();

      return interaction.editReply({ content: lang.resetAllSuccess(deleted) });
    }

    if (sub === 'stats') {
      await interaction.deferReply({ ephemeral: true });

      const all   = getAll();
      const week  = getSince(Date.now() - 7  * 86400000);
      const today = getSince(Date.now() - 86400000);

      let totalYes = 0, totalNo = 0;
      const hourCounts = new Array(24).fill(0);

      for (const c of all) {
        hourCounts[new Date(c.timestamp).getUTCHours()]++;
        totalYes += c.votes?.yes?.length ?? 0;
        totalNo  += c.votes?.no?.length  ?? 0;
      }

      const peakHour   = hourCounts.indexOf(Math.max(...hourCounts));
      const totalVotes = totalYes + totalNo;
      const posRatio   = totalVotes > 0 ? Math.round((totalYes / totalVotes) * 100) : 0;
      const avgPerDay  = all.length > 0
        ? (all.length / Math.max(1, Math.ceil((Date.now() - all[0].timestamp) / 86400000))).toFixed(1)
        : 0;

      const embed = new EmbedBuilder()
        .setColor(0xE8C547)
        .setTitle('📊 Confession Statistics')
        .addFields(
          { name: '📝 Total',       value: `${all.length} confessions`,     inline: true },
          { name: '📅 This week',   value: `${week.length} confessions`,    inline: true },
          { name: '🌅 Today',       value: `${today.length} confessions`,   inline: true },
          { name: '✅ Upvotes',     value: `${totalYes} (${posRatio}%)`,    inline: true },
          { name: '❌ Downvotes',   value: `${totalNo} (${100-posRatio}%)`, inline: true },
          { name: '📈 Avg/day',     value: `${avgPerDay}`,                  inline: true },
          { name: '⏰ Peak hour (UTC)', value: `${peakHour}h–${peakHour+1}h`, inline: true },
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    }
  }
});

client.login(process.env.BOT_TOKEN);
