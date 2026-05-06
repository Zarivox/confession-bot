import {
  Client,
  GatewayIntentBits,
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
  getDelay,
  setDelay,
  formatDuration,
} from './cooldowns.js';
import {
  saveConfession,
  vote,
  getVotes,
  getAll,
  getSince,
} from './confessions.js';

const CONFESSION_CHANNEL_ID = process.env.CONFESSION_CHANNEL_ID;
const ADMIN_ID              = process.env.ADMIN_ID;

const lang = (await import(`./locales/${process.env.LANG === 'fr' ? 'fr' : 'en'}.js`)).default;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.DirectMessages,
  ],
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

    // Update button counts on the message
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
      posted = await confessionChannel.send({
        embeds:     [embed],
        components: [buildVoteRow(nextNumber, 0, 0)],
      });
    } catch {
      return interaction.reply({ content: lang.sendError, ephemeral: true });
    }

    saveConfession(posted.id, CONFESSION_CHANNEL_ID);
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

    if (sub === 'stats') {
      await interaction.deferReply({ ephemeral: true });

      const all   = getAll();
      const week  = getSince(Date.now() - 7  * 86400000);
      const today = getSince(Date.now() - 86400000);

      let totalYes = 0, totalNo = 0;
      const hourCounts = new Array(24).fill(0);

      for (const c of all) {
        hourCounts[new Date(c.timestamp).getHours()]++;
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
        .setTitle('📊 Statistiques des confessions')
        .addFields(
          { name: '📝 Total',            value: `${all.length} confessions`,     inline: true },
          { name: '📅 Cette semaine',    value: `${week.length} confessions`,    inline: true },
          { name: '🌅 Aujourd\'hui',     value: `${today.length} confessions`,   inline: true },
          { name: '✅ Votes positifs',   value: `${totalYes} (${posRatio}%)`,    inline: true },
          { name: '❌ Votes négatifs',   value: `${totalNo} (${100-posRatio}%)`, inline: true },
          { name: '📈 Moyenne/jour',     value: `${avgPerDay}`,                  inline: true },
          { name: '⏰ Heure de pointe',  value: `${peakHour}h–${peakHour+1}h`,  inline: true },
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    }
  }
});

client.login(process.env.BOT_TOKEN);
