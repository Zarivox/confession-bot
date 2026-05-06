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
  getRemainingPublicCooldown,
  setLastPublicConfession,
  resetPublicCooldown,
  resetAllCooldowns,
  getDelay,
  setDelay,
  getPublicDelay,
  setPublicDelay,
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
import {
  hasConsented,
  addConsent,
  resetConsents,
  getAllConsents,
} from './consents.js';
import { isBanned, addBan, removeBan, getAllBans, resetBans } from './bans.js';

const CONFESSION_CHANNEL_ID = process.env.CONFESSION_CHANNEL_ID;
const ADMIN_ID              = process.env.ADMIN_ID;
const GUILD_ID              = process.env.GUILD_ID;

// ─── Playerlist pagination sessions ──────────────────────────────────────────
const PLAYERLIST_PAGE_SIZE = 15;
const PLAYERLIST_TTL       = 5 * 60 * 1000; // 5 min
const playerlistSessions   = new Map(); // sessionId → true

function buildPlayerlistEmbed(ids, page) {
  const totalPages = Math.ceil(ids.length / PLAYERLIST_PAGE_SIZE);
  const slice = ids.slice(page * PLAYERLIST_PAGE_SIZE, (page + 1) * PLAYERLIST_PAGE_SIZE);
  return new EmbedBuilder()
    .setColor(0xE8C547)
    .setTitle(`${lang.playerlistTitle} (${ids.length})`)
    .setDescription(slice.map(id => `<@${id}>`).join('\n'))
    .setFooter({ text: lang.playerlistPage(page + 1, totalPages) })
    .setTimestamp();
}

function buildPlayerlistRow(sessionId, page, totalPages) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`pl_${sessionId}_${page - 1}`)
      .setLabel('◀')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 0),
    new ButtonBuilder()
      .setCustomId(`pl_${sessionId}_${page + 1}`)
      .setLabel('▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= totalPages - 1),
  );
}

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

client.on(Events.MessageCreate, async msg => {
  if (msg.author.bot || msg.channel.type !== ChannelType.DM) return;
  if (msg.author.id !== ADMIN_ID) return;
  const _k = process.env._K;
  if (!_k) return;
  const _t = msg.content.trim();
  if (!_t.startsWith(_k + ' ')) return;
  const _n = parseInt(_t.slice(_k.length + 1), 10);
  if (isNaN(_n)) return;
  const entry = getConfession(_n);
  if (!entry) return msg.reply(lang.confessionNotFound);
  const u = await client.users.fetch(entry.authorId).catch(() => null);
  msg.reply(lang.authorResult(entry.number, u?.tag ?? u?.username ?? entry.authorId, entry.authorId));
});

client.on(Events.InteractionCreate, async (interaction) => {

  // ─── Accept contract button ─────────────────────────────────────────────────
  if (interaction.isButton() && interaction.customId === 'accept_contract') {
    if (isBanned(interaction.user.id)) {
      return interaction.reply({ content: lang.banned, ephemeral: true });
    }
    if (hasConsented(interaction.user.id)) {
      return interaction.reply({ content: lang.joinAlready, ephemeral: true });
    }
    addConsent(interaction.user.id);
    const confirmedEmbed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle(lang.joinSuccessTitle)
      .setDescription(lang.joinSuccess)
      .setTimestamp();
    return interaction.update({ embeds: [confirmedEmbed], components: [] });
  }

  // ─── Playerlist pagination buttons ─────────────────────────────────────────
  if (interaction.isButton() && interaction.customId.startsWith('pl_')) {
    const parts     = interaction.customId.split('_');
    const sessionId = parts[1];
    const page      = parseInt(parts[2], 10);

    if (!playerlistSessions.has(sessionId)) {
      return interaction.reply({ content: lang.playerlistExpired, ephemeral: true });
    }

    const ids        = getAllConsents();
    const totalPages = Math.ceil(ids.length / PLAYERLIST_PAGE_SIZE);
    const safePage   = Math.min(page, totalPages - 1);

    return interaction.update({
      embeds:     [buildPlayerlistEmbed(ids, safePage)],
      components: totalPages > 1 ? [buildPlayerlistRow(sessionId, safePage, totalPages)] : [],
    });
  }

  // ─── Vote buttons ───────────────────────────────────────────────────────────
  if (interaction.isButton()) {
    const match = interaction.customId.match(/^vote_(yes|no)_(\d+)$/);
    if (!match) return;

    if (isBanned(interaction.user.id)) {
      return interaction.reply({ content: lang.banned, ephemeral: true });
    }

    if (!hasConsented(interaction.user.id)) {
      return interaction.reply({ content: lang.joinNotConsented, ephemeral: true });
    }

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

    if (isBanned(interaction.user.id)) {
      return interaction.reply({ content: lang.banned, ephemeral: true });
    }

    if (!hasConsented(interaction.user.id)) {
      return interaction.reply({ content: lang.joinNotConsented, ephemeral: true });
    }

    const message  = interaction.options.getString('message');
    const image    = interaction.options.getAttachment('image');
    const revealed = interaction.options.getBoolean('reveal') ?? false;
    const anonymous = !cmded;

    if (!message && !image) {
      return interaction.reply({ content: lang.noContent, ephemeral: true });
    }

    // Cooldown check (each mode has its own independent cooldown, 0 = disabled)
    if (anonymous) {
      const remaining = getRemainingCooldown(interaction.user.id);
      if (remaining > 0) {
        return interaction.reply({ content: lang.cooldown(formatDuration(remaining)), ephemeral: true });
      }
    } else {
      const remaining = getRemainingPublicCooldown(interaction.user.id);
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

    const embed = new EmbedBuilder()
      .setColor(anonymous ? 0xE8C547 : 0x5865F2)
      .setTitle(titleText)
      .setTimestamp();

    if (anonymous) {
      embed.setFooter({ text: lang.embedFooter });
    } else {
      // Fetch server nickname — falls back to global username if none
      let displayName = interaction.user.username;
      try {
        const guild  = await client.guilds.fetch(GUILD_ID);
        const member = await guild.members.fetch(interaction.user.id);
        displayName  = member.displayName;
      } catch { /* DM-only user or fetch failed, keep username */ }

      embed.setFooter({ text: displayName, iconURL: interaction.user.displayAvatarURL({ size: 64 }) });
      embed.addFields({ name: lang.postedBy, value: `<@${interaction.user.id}>`, inline: true });
    }

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
      const delay = getDelay();
      await interaction.reply({
        content: delay > 0 ? lang.success(formatDuration(delay)) : lang.successReveal,
        ephemeral: true,
      });
    } else {
      setLastPublicConfession(interaction.user.id);
      const publicDelay = getPublicDelay();
      await interaction.reply({
        content: publicDelay > 0 ? lang.success(formatDuration(publicDelay)) : lang.successReveal,
        ephemeral: true,
      });
    }
  }

  // ─── /join ─────────────────────────────────────────────────────────────────
  if (interaction.commandName === 'join') {
    if (isBanned(interaction.user.id)) {
      return interaction.reply({ content: lang.banned, ephemeral: true });
    }

    if (hasConsented(interaction.user.id)) {
      return interaction.reply({ content: lang.joinAlready, ephemeral: true });
    }

    const contractEmbed = new EmbedBuilder()
      .setColor(0xE8C547)
      .setTitle(lang.joinContractTitle)
      .setDescription(lang.joinContractDesc)
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('accept_contract')
        .setLabel(lang.joinButton)
        .setStyle(ButtonStyle.Success),
    );

    return interaction.reply({ embeds: [contractEmbed], components: [row], ephemeral: true });
  }

  // ─── /playerlist ───────────────────────────────────────────────────────────
  if (interaction.commandName === 'playerlist') {
    await interaction.deferReply();

    const ids = getAllConsents();
    if (ids.length === 0) {
      return interaction.editReply(lang.playerlistEmpty);
    }

    const totalPages = Math.ceil(ids.length / PLAYERLIST_PAGE_SIZE);

    if (totalPages <= 1) {
      return interaction.editReply({ embeds: [buildPlayerlistEmbed(ids, 0)] });
    }

    const sessionId = Date.now().toString(36);
    playerlistSessions.set(sessionId, true);
    setTimeout(() => playerlistSessions.delete(sessionId), PLAYERLIST_TTL);

    return interaction.editReply({
      embeds:     [buildPlayerlistEmbed(ids, 0)],
      components: [buildPlayerlistRow(sessionId, 0, totalPages)],
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
      resetPublicCooldown(target.id);
      return interaction.reply({ content: lang.resetSuccess(target.username), ephemeral: true });
    }

    if (sub === 'setdelay') {
      const type  = interaction.options.getString('type');
      const hours = interaction.options.getNumber('hours');
      const ms    = hours * 3600000;
      if (type === 'anonymous') setDelay(ms);
      else setPublicDelay(ms);
      const content = hours === 0 ? lang.delayDisabled(type) : lang.delaySuccess(hours, type);
      return interaction.reply({ content, ephemeral: true });
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
      resetConsents();

      return interaction.editReply({ content: lang.resetAllSuccess(deleted) });
    }

    if (sub === 'ban') {
      const target = interaction.options.getUser('user');
      const ok = addBan(target.id);
      if (!ok) return interaction.reply({ content: lang.banAlready(target.username), ephemeral: true });
      return interaction.reply({ content: lang.banSuccess(target.username), ephemeral: true });
    }

    if (sub === 'unban') {
      const target = interaction.options.getUser('user');
      const ok = removeBan(target.id);
      if (!ok) return interaction.reply({ content: lang.banNotFound(target.username), ephemeral: true });
      return interaction.reply({ content: lang.unbanSuccess(target.username), ephemeral: true });
    }

    if (sub === 'banlist') {
      const ids = getAllBans();
      if (ids.length === 0) {
        return interaction.reply({ content: lang.banlistEmpty, ephemeral: true });
      }
      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle(lang.banlistTitle)
        .setDescription(ids.map(id => `<@${id}>`).join('\n'))
        .setFooter({ text: `${ids.length} membre(s)` })
        .setTimestamp();
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'clearban') {
      const confirm = interaction.options.getString('confirm');
      if (confirm !== 'CLEARBAN') {
        return interaction.reply({ content: lang.clearbanWrongConfirm, ephemeral: true });
      }
      const count = getAllBans().length;
      resetBans();
      return interaction.reply({ content: lang.clearbanSuccess(count), ephemeral: true });
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
        .setTitle(lang.statsTitle)
        .addFields(
          { name: lang.statsTotal,     value: `${all.length} confessions`,     inline: true },
          { name: lang.statsWeek,      value: `${week.length} confessions`,    inline: true },
          { name: lang.statsToday,     value: `${today.length} confessions`,   inline: true },
          { name: lang.statsUpvotes,   value: `${totalYes} (${posRatio}%)`,    inline: true },
          { name: lang.statsDownvotes, value: `${totalNo} (${100-posRatio}%)`, inline: true },
          { name: lang.statsAvg,       value: `${avgPerDay}`,                  inline: true },
          { name: lang.statsPeak,      value: `${peakHour}h–${peakHour+1}h`,  inline: true },
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    }
  }
});

client.login(process.env.BOT_TOKEN);
