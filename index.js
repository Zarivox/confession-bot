import {
  Client,
  GatewayIntentBits,
  Partials,
  ChannelType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  AttachmentBuilder,
  MessageFlags,
  PermissionFlagsBits,
  ActivityType,
  Events,
} from 'discord.js';
import dotenv from 'dotenv';
// override: true → .env wins over shell-inherited env vars (e.g. LANG)
dotenv.config({ override: true });
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
  getAll,
  getSince,
  deleteConfession,
  deleteWhere,
  resetConfessions,
} from './confessions.js';
import {
  hasConsented,
  addConsent,
  removeConsent,
  resetConsents,
  getAllConsents,
} from './consents.js';
import { isBanned, addBan, removeBan, getAllBans, resetBans } from './bans.js';

// ─── Validation des variables d'environnement ─────────────────────────────────
const REQUIRED_ENV = ['BOT_TOKEN', 'CLIENT_ID', 'GUILD_ID', 'CONFESSION_CHANNEL_ID', 'ADMIN_ID', 'AUTHOR_PUB', 'VOTE_SECRET'];
const missingEnv = REQUIRED_ENV.filter(k => !process.env[k]);
if (missingEnv.length > 0) {
  console.error(`\n❌ Variables d'environnement manquantes : ${missingEnv.join(', ')}`);
  console.error('Corrige le .env et relance le bot.\n');
  process.exit(1);
}

// Sanity-check format
try {
  const pubBytes = Buffer.from(process.env.AUTHOR_PUB, 'base64');
  if (pubBytes.length !== 32) throw new Error(`AUTHOR_PUB length is ${pubBytes.length} bytes (expected 32)`);
  const secretBytes = Buffer.from(process.env.VOTE_SECRET, 'base64');
  if (secretBytes.length < 16) throw new Error(`VOTE_SECRET length is ${secretBytes.length} bytes (expected ≥16)`);
} catch (e) {
  console.error(`\n❌ AUTHOR_PUB ou VOTE_SECRET invalide : ${e.message}\n`);
  process.exit(1);
}

const SNOWFLAKE_REGEX = /^\d{17,20}$/;

const CONFESSION_CHANNEL_ID  = process.env.CONFESSION_CHANNEL_ID;
const ADMIN_ID               = process.env.ADMIN_ID;
const GUILD_ID               = process.env.GUILD_ID;
const PARTICIPANT_ROLE_ID    = process.env.PARTICIPANT_ROLE_ID ?? null;
const ALLOW_CHANNEL_MESSAGES = process.env.ALLOW_CHANNEL_MESSAGES === 'true';

// Format check (Discord IDs are 17-20 digit snowflakes)
const idChecks = [
  { name: 'GUILD_ID',              value: GUILD_ID },
  { name: 'CONFESSION_CHANNEL_ID', value: CONFESSION_CHANNEL_ID },
  { name: 'ADMIN_ID',              value: ADMIN_ID },
];
if (PARTICIPANT_ROLE_ID) idChecks.push({ name: 'PARTICIPANT_ROLE_ID', value: PARTICIPANT_ROLE_ID });

const invalidIds = idChecks.filter(c => !SNOWFLAKE_REGEX.test(c.value));
if (invalidIds.length > 0) {
  console.error(`\n❌ IDs au format invalide (doivent être 17-20 chiffres) :`);
  invalidIds.forEach(c => console.error(`  • ${c.name} = "${c.value}"`));
  console.error('Corrige le .env et relance le bot.\n');
  process.exit(1);
}

// ─── Role helpers ─────────────────────────────────────────────────────────────

async function assignParticipantRole(userId) {
  if (!PARTICIPANT_ROLE_ID) return;
  try {
    const guild  = await client.guilds.fetch(GUILD_ID);
    const member = await guild.members.fetch(userId);
    await member.roles.add(PARTICIPANT_ROLE_ID);
  } catch (e) {
    console.error(`[role] Impossible d'assigner le rôle à ${userId} :`, e.message);
  }
}

async function removeParticipantRole(userId) {
  if (!PARTICIPANT_ROLE_ID) return;
  try {
    const guild  = await client.guilds.fetch(GUILD_ID);
    const member = await guild.members.fetch(userId);
    await member.roles.remove(PARTICIPANT_ROLE_ID);
  } catch {
    // L'utilisateur a peut-être quitté le serveur — pas bloquant
  }
}

// ─── Channel permission checker / auto-fix ────────────────────────────────────

async function ensureChannelPermissions(channel, guild) {
  const fixes = [];

  // @everyone : toujours cacher le channel + bloquer les messages si configuré
  const everyoneRole      = guild.roles.everyone;
  const everyoneOverwrite = channel.permissionOverwrites.cache.get(everyoneRole.id);
  const everyoneDeniesView     = everyoneOverwrite?.deny.has(PermissionFlagsBits.ViewChannel) === true;
  const everyoneDeniesMessages = everyoneOverwrite?.deny.has(PermissionFlagsBits.SendMessages) === true;

  const needEveryoneFix = !everyoneDeniesView || (!ALLOW_CHANNEL_MESSAGES && !everyoneDeniesMessages);
  if (needEveryoneFix) {
    await channel.permissionOverwrites.edit(everyoneRole, {
      ViewChannel:  false,
      SendMessages: ALLOW_CHANNEL_MESSAGES ? null : false,
    });
    const denied = ['ViewChannel'];
    if (!ALLOW_CHANNEL_MESSAGES) denied.push('SendMessages');
    fixes.push(`@everyone → ${denied.join(' + ')} refusés`);
  }

  // Rôle participant : autoriser ViewChannel + bloquer SendMessages si configuré
  if (PARTICIPANT_ROLE_ID) {
    const participantRole = await guild.roles.fetch(PARTICIPANT_ROLE_ID);
    if (participantRole) {
      const roleOverwrite   = channel.permissionOverwrites.cache.get(participantRole.id);
      const roleAllowsView  = roleOverwrite?.allow.has(PermissionFlagsBits.ViewChannel) === true;
      const roleDeniesMsg   = roleOverwrite?.deny.has(PermissionFlagsBits.SendMessages) === true;

      const needRoleFix = !roleAllowsView || (!ALLOW_CHANNEL_MESSAGES && !roleDeniesMsg);
      if (needRoleFix) {
        await channel.permissionOverwrites.edit(participantRole, {
          ViewChannel:  true,
          SendMessages: ALLOW_CHANNEL_MESSAGES ? null : false,
        });
        const what = ['ViewChannel accordé'];
        if (!ALLOW_CHANNEL_MESSAGES) what.push('SendMessages refusé');
        fixes.push(`@${participantRole.name} → ${what.join(' + ')}`);
      }
    }
  }

  return fixes;
}

// ─── Presence (custom status under the bot's name) ────────────────────────────
// Affiche un statut « /confession en MP · N participants » qui se rafraîchit
// à chaque event qui change le compte (join modal, ban, wipe).
function updatePresence() {
  if (!client.user) return; // bot pas encore prêt
  const count = getAllConsents().length;
  client.user.setPresence({
    activities: [{
      name:  'custom',                    // requis par discord.js, ignoré pour Custom
      type:  ActivityType.Custom,
      state: lang.presenceText(count),    // c'est ce texte qui s'affiche
    }],
    status: 'online',
  });
}

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

// Load active locale, then merge any private overrides (locales/private.js)
// on top. The private file is gitignored — perfect for instance-specific text.
let lang = (await import(`./locales/${process.env.LANG === 'fr' ? 'fr' : 'en'}.js`)).default;
try {
  const priv = (await import('./locales/private.js')).default;
  lang = { ...lang, ...priv };
  console.log(`✅ Surcharges privées chargées (${Object.keys(priv).length} clé(s))`);
} catch (e) {
  if (e.code !== 'ERR_MODULE_NOT_FOUND') {
    console.error(`\n❌ Erreur dans locales/private.js : ${e.message}`);
    process.exit(1);
  }
  // Fichier absent — on utilise la locale par défaut
}

// Sanity check : les clés critiques doivent être des chaînes non-vides après merge
const REQUIRED_LANG_KEYS = ['joinAcceptPhrase', 'joinModalTitle', 'joinModalLabel', 'joinButton', 'joinContractTitle', 'joinContractDesc'];
const brokenKeys = REQUIRED_LANG_KEYS.filter(k => typeof lang[k] !== 'string' || lang[k].trim().length === 0);
if (brokenKeys.length > 0) {
  console.error(`\n❌ Clés de locale manquantes ou vides : ${brokenKeys.join(', ')}`);
  console.error('Vérifie tes fichiers locales/*.js et locales/private.js.\n');
  process.exit(1);
}

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

client.once(Events.ClientReady, async (c) => {
  console.log(`\n🔍 Vérification de la configuration...`);
  const errors = [];

  // Vérifier GUILD_ID
  let guild = null;
  try {
    guild = await c.guilds.fetch(GUILD_ID);
  } catch {
    errors.push(`GUILD_ID "${GUILD_ID}" — serveur introuvable ou bot non présent.`);
  }

  // Vérifier CONFESSION_CHANNEL_ID
  try {
    const ch = await c.channels.fetch(CONFESSION_CHANNEL_ID);
    if (!ch?.isTextBased()) errors.push(`CONFESSION_CHANNEL_ID "${CONFESSION_CHANNEL_ID}" — n'est pas un salon textuel.`);
  } catch {
    errors.push(`CONFESSION_CHANNEL_ID "${CONFESSION_CHANNEL_ID}" — salon introuvable.`);
  }

  // Vérifier ADMIN_ID
  try {
    await c.users.fetch(ADMIN_ID);
  } catch {
    errors.push(`ADMIN_ID "${ADMIN_ID}" — utilisateur introuvable.`);
  }

  // Vérifier PARTICIPANT_ROLE_ID (optionnel — seulement si défini)
  if (PARTICIPANT_ROLE_ID) {
    if (!guild) {
      errors.push(`PARTICIPANT_ROLE_ID — impossible à vérifier car le serveur est introuvable.`);
    } else {
      try {
        const role = await guild.roles.fetch(PARTICIPANT_ROLE_ID);
        if (!role) errors.push(`PARTICIPANT_ROLE_ID "${PARTICIPANT_ROLE_ID}" — rôle introuvable sur le serveur.`);
      } catch {
        errors.push(`PARTICIPANT_ROLE_ID "${PARTICIPANT_ROLE_ID}" — rôle introuvable sur le serveur.`);
      }
    }
  }

  if (errors.length > 0) {
    console.error('\n❌ Erreurs de configuration :');
    errors.forEach(e => console.error(`  • ${e}`));
    console.error('\nLe bot s\'arrête. Corrige le .env et relance.\n');
    process.exit(1);
  }

  const confessionChannel = await c.channels.fetch(CONFESSION_CHANNEL_ID);
  const adminUser         = await c.users.fetch(ADMIN_ID);
  const botMember         = await guild.members.fetchMe();

  // Vérifier les permissions Discord du bot
  const permErrors = [];
  if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
    permErrors.push('Permission "Gérer les rôles" manquante.');
  }
  if (!botMember.permissions.has(PermissionFlagsBits.ManageChannels)) {
    permErrors.push('Permission "Gérer les salons" manquante.');
  }
  if (PARTICIPANT_ROLE_ID) {
    const participantRole = await guild.roles.fetch(PARTICIPANT_ROLE_ID);
    if (participantRole && botMember.roles.highest.position <= participantRole.position) {
      permErrors.push(`Le rôle le plus haut du bot (@${botMember.roles.highest.name}) doit être AU-DESSUS du rôle participant (@${participantRole.name}) dans la hiérarchie.`);
    }
  }
  if (permErrors.length > 0) {
    console.error('\n❌ Permissions Discord du bot insuffisantes :');
    permErrors.forEach(e => console.error(`  • ${e}`));
    console.error('\nCorrige les permissions du bot et relance.\n');
    process.exit(1);
  }

  console.log(`✅ Connecté en tant que ${c.user.tag}`);
  console.log(`✅ Serveur : ${guild.name}`);
  console.log(`✅ Salon des confessions : #${confessionChannel.name}`);
  console.log(`✅ Admin : ${adminUser.tag}`);
  if (PARTICIPANT_ROLE_ID) {
    const role = await guild.roles.fetch(PARTICIPANT_ROLE_ID);
    console.log(`✅ Rôle participant : @${role.name}`);
  }
  console.log(`✅ Permissions du bot : OK`);

  // Vérification et correction automatique des permissions du salon
  try {
    const fixes = await ensureChannelPermissions(confessionChannel, guild);
    if (fixes.length > 0) {
      console.log(`\n🔧 Permissions du salon corrigées automatiquement :`);
      fixes.forEach(f => console.log(`  • ${f}`));
    } else {
      console.log(`✅ Permissions du salon : OK`);
    }
  } catch (e) {
    console.error(`⚠️  Impossible de vérifier/corriger les permissions du salon : ${e.message}`);
    console.error(`   Vérifie que le bot a la permission "Gérer le salon" dans #${confessionChannel.name}`);
  }

  // Statut initial sous le nom du bot
  updatePresence();

  console.log('\n🟢 Bot prêt.\n');
});

// Optional private event handlers (gitignored) — see private-handlers.example.js
try {
  const { default: registerPrivateHandlers } = await import('./private-handlers.js');
  await registerPrivateHandlers({ client, lang });
  console.log('✅ Handlers privés chargés');
} catch (e) {
  if (e.code !== 'ERR_MODULE_NOT_FOUND') {
    console.error(`\n❌ Erreur dans private-handlers.js : ${e.message}`);
    process.exit(1);
  }
  // Fichier absent — comportement normal
}

client.on(Events.InteractionCreate, async (interaction) => {

  // ─── Open contract modal button ─────────────────────────────────────────────
  if (interaction.isButton() && interaction.customId === 'open_contract_modal') {
    if (isBanned(interaction.user.id)) {
      return interaction.reply({ content: lang.banned, flags: MessageFlags.Ephemeral });
    }
    if (hasConsented(interaction.user.id)) {
      return interaction.reply({ content: lang.joinAlready, flags: MessageFlags.Ephemeral });
    }
    const modal = new ModalBuilder()
      .setCustomId('contract_modal')
      .setTitle(lang.joinModalTitle)
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('consent_phrase')
            .setLabel(lang.joinModalLabel)
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder(lang.joinAcceptPhrase)
            .setMinLength(lang.joinAcceptPhrase.length)
            .setMaxLength(lang.joinAcceptPhrase.length + 5),
        ),
      );
    return interaction.showModal(modal);
  }

  // ─── Contract modal submit ───────────────────────────────────────────────────
  if (interaction.isModalSubmit() && interaction.customId === 'contract_modal') {
    if (isBanned(interaction.user.id)) {
      return interaction.reply({ content: lang.banned, flags: MessageFlags.Ephemeral });
    }
    if (hasConsented(interaction.user.id)) {
      return interaction.reply({ content: lang.joinAlready, flags: MessageFlags.Ephemeral });
    }
    const phrase = interaction.fields.getTextInputValue('consent_phrase').trim();
    if (phrase !== lang.joinAcceptPhrase) {
      return interaction.reply({ content: lang.joinWrongPhrase, flags: MessageFlags.Ephemeral });
    }
    // Defer first — role assignment peut prendre du temps
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    addConsent(interaction.user.id);
    await assignParticipantRole(interaction.user.id);
    updatePresence();
    const confirmedEmbed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle(lang.joinSuccessTitle)
      .setDescription(lang.joinSuccess)
      .setTimestamp();
    return interaction.editReply({ embeds: [confirmedEmbed] });
  }

  // ─── Playerlist pagination buttons ─────────────────────────────────────────
  if (interaction.isButton() && interaction.customId.startsWith('pl_')) {
    const parts     = interaction.customId.split('_');
    const sessionId = parts[1];
    const page      = parseInt(parts[2], 10);

    if (!playerlistSessions.has(sessionId)) {
      return interaction.reply({ content: lang.playerlistExpired, flags: MessageFlags.Ephemeral });
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
      return interaction.reply({ content: lang.banned, flags: MessageFlags.Ephemeral });
    }

    if (!hasConsented(interaction.user.id)) {
      return interaction.reply({ content: lang.joinNotConsented, flags: MessageFlags.Ephemeral });
    }

    const choice = match[1];
    const number = parseInt(match[2], 10);

    const result = vote(number, interaction.user.id, choice);

    if (result === 'already_voted') {
      return interaction.reply({ content: lang.alreadyVoted, flags: MessageFlags.Ephemeral });
    }

    if (result === 'not_found') {
      return interaction.reply({ content: lang.confessionNotFound, flags: MessageFlags.Ephemeral });
    }

    if (result !== 'ok') return; // safety net for unknown return values

    const { yes, no } = getVotes(number);
    await interaction.update({ components: [buildVoteRow(number, yes, no)] });
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  // ─── /confession ───────────────────────────────────────────────────────────
  if (interaction.commandName === 'confession') {
    if (interaction.inGuild()) {
      return interaction.reply({ content: lang.dmOnly, flags: MessageFlags.Ephemeral });
    }

    if (isBanned(interaction.user.id)) {
      return interaction.reply({ content: lang.banned, flags: MessageFlags.Ephemeral });
    }

    if (!hasConsented(interaction.user.id)) {
      return interaction.reply({ content: lang.joinNotConsented, flags: MessageFlags.Ephemeral });
    }

    const message   = interaction.options.getString('message');
    const file      = interaction.options.getAttachment('fichier');
    const revealed  = interaction.options.getBoolean('reveal') ?? false;
    const anonymous = !revealed;

    if (!message && !file) {
      return interaction.reply({ content: lang.noContent, flags: MessageFlags.Ephemeral });
    }

    // Détection auto du type via contentType (Discord nous le donne)
    const isImage = file?.contentType?.startsWith('image/') ?? false;
    const isVideo = file?.contentType?.startsWith('video/') ?? false;
    if (file && !isImage && !isVideo) {
      return interaction.reply({ content: lang.invalidFile, flags: MessageFlags.Ephemeral });
    }

    // Cooldown check (each mode has its own independent cooldown, 0 = disabled)
    if (anonymous) {
      const remaining = getRemainingCooldown(interaction.user.id);
      if (remaining > 0) {
        return interaction.reply({ content: lang.cooldown(formatDuration(remaining)), flags: MessageFlags.Ephemeral });
      }
    } else {
      const remaining = getRemainingPublicCooldown(interaction.user.id);
      if (remaining > 0) {
        return interaction.reply({ content: lang.cooldown(formatDuration(remaining)), flags: MessageFlags.Ephemeral });
      }
    }

    // Defer here — the rest of the flow does several Discord API calls
    // (channel fetch, guild fetch for boost tier, attachment re-upload) which
    // can easily exceed Discord's 3s interaction timeout, especially for
    // large media files. After defer, every reply uses editReply().
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    let confessionChannel;
    try {
      confessionChannel = await client.channels.fetch(CONFESSION_CHANNEL_ID);
    } catch {
      return interaction.editReply({ content: lang.channelNotFound });
    }

    if (!confessionChannel?.isTextBased()) {
      return interaction.editReply({ content: lang.invalidChannel });
    }

    // Check upload size against server's max (varies by boost tier)
    if (file) {
      const guild    = await client.guilds.fetch(GUILD_ID);
      const tier     = guild.premiumTier ?? 0;
      const maxMB    = tier >= 3 ? 100 : tier >= 2 ? 50 : 10;
      const maxBytes = maxMB * 1024 * 1024;
      if (file.size > maxBytes) {
        const sizeMB = (file.size / 1024 / 1024).toFixed(1);
        return interaction.editReply({
          content: lang.fileTooLarge(sizeMB, maxMB),
        });
      }
    }

    // Reserve the number atomically BEFORE posting so embed and JSON always match
    const nextNumber = reserveNumber();

    const titleText = anonymous
      ? `${lang.embedTitle} #${nextNumber}`
      : `${lang.embedTitlePublic} #${nextNumber}`;

    // Re-upload du fichier pour éviter l'expiration des URLs Discord (24h depuis 2024).
    const files = file ? [new AttachmentBuilder(file.url, { name: file.name })] : [];

    let sendPayload;
    if (isVideo) {
      // Discord ne sait pas embed les vidéos uploadées par les users → on
      // skip l'embed pour éviter le layout moche (petit embed sous grosse
      // vidéo). Le titre passe en contenu de message brut.
      // Petit indicateur visuel pour compenser l'absence de la barre de
      // couleur de l'embed : 🟡 = anonyme, 🔵 = public.
      const indicator = anonymous ? '🟡' : '🔵';
      let content = `${indicator} **${titleText}**`;
      if (!anonymous) content += `\n${lang.postedBy} : <@${interaction.user.id}>`;
      if (message)    content += `\n\n${message}`;
      sendPayload = { content, files };
    } else {
      // Flow embed standard (texte seul ou image seule)
      const embed = new EmbedBuilder()
        .setColor(anonymous ? 0xE8C547 : 0x5865F2)
        .setTitle(titleText)
        .setTimestamp();

      if (anonymous) {
        embed.setFooter({ text: lang.embedFooter });
      } else {
        let displayName = interaction.user.username;
        try {
          const guild  = await client.guilds.fetch(GUILD_ID);
          const member = await guild.members.fetch(interaction.user.id);
          displayName  = member.displayName;
        } catch { /* DM-only user ou fetch raté */ }
        embed.setFooter({ text: displayName, iconURL: interaction.user.displayAvatarURL({ size: 128 }) });
        embed.addFields({ name: lang.postedBy, value: `<@${interaction.user.id}>`, inline: true });
      }

      if (message) embed.setDescription(message);
      if (isImage) embed.setImage(`attachment://${file.name}`);

      sendPayload = { embeds: [embed], files };
    }

    let posted;
    try {
      posted = await confessionChannel.send({
        ...sendPayload,
        components: [buildVoteRow(nextNumber, 0, 0)],
      });
    } catch {
      return interaction.editReply({ content: lang.sendError });
    }

    // Save to JSON — if this fails, delete the orphaned Discord message.
    // For anon, the {id, username, globalName} snapshot is encrypted at rest.
    try {
      const authorInfo = {
        id:         interaction.user.id,
        username:   interaction.user.username ?? null,
        globalName: interaction.user.globalName ?? null,
      };
      saveConfession(nextNumber, posted.id, CONFESSION_CHANNEL_ID, authorInfo, anonymous);
    } catch (e) {
      console.error('[confession] Failed to save confession #' + nextNumber + ':', e.message);
      try { await posted.delete(); } catch {}
      return interaction.editReply({ content: lang.saveError });
    }

    if (anonymous) {
      const delay = getDelay();
      // Only persist timestamp if cooldown is enabled — avoids unnecessary disk writes
      if (delay > 0) setLastConfession(interaction.user.id);
      await interaction.editReply({
        content: delay > 0 ? lang.success(formatDuration(delay)) : lang.successNoDelay,
      });
    } else {
      const publicDelay = getPublicDelay();
      if (publicDelay > 0) setLastPublicConfession(interaction.user.id);
      await interaction.editReply({
        content: publicDelay > 0 ? lang.success(formatDuration(publicDelay)) : lang.successReveal,
      });
    }
  }

  // ─── /join ─────────────────────────────────────────────────────────────────
  if (interaction.commandName === 'join') {
    if (isBanned(interaction.user.id)) {
      return interaction.reply({ content: lang.banned, flags: MessageFlags.Ephemeral });
    }

    if (hasConsented(interaction.user.id)) {
      return interaction.reply({ content: lang.joinAlready, flags: MessageFlags.Ephemeral });
    }

    const contractEmbed = new EmbedBuilder()
      .setColor(0xE8C547)
      .setTitle(lang.joinContractTitle)
      .setDescription(lang.joinContractDesc)
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('open_contract_modal')
        .setLabel(lang.joinButton)
        .setStyle(ButtonStyle.Success),
    );

    return interaction.reply({ embeds: [contractEmbed], components: [row], flags: MessageFlags.Ephemeral });
  }

  // ─── /contrat ──────────────────────────────────────────────────────────────
  if (interaction.commandName === 'contrat') {
    if (isBanned(interaction.user.id)) {
      return interaction.reply({ content: lang.banned, flags: MessageFlags.Ephemeral });
    }
    const contractEmbed = new EmbedBuilder()
      .setColor(0xE8C547)
      .setTitle(lang.joinContractTitle)
      .setDescription(lang.joinContractDesc)
      .setTimestamp();
    return interaction.reply({ embeds: [contractEmbed], flags: MessageFlags.Ephemeral });
  }

  // ─── /help ─────────────────────────────────────────────────────────────────
  if (interaction.commandName === 'help') {
    const embed = new EmbedBuilder()
      .setColor(0xE8C547)
      .setTitle(lang.helpTitle)
      .addFields(
        { name: lang.helpFieldDmName,     value: lang.helpFieldDmValue,     inline: false },
        { name: lang.helpFieldServerName, value: lang.helpFieldServerValue, inline: false },
      )
      .setFooter({ text: lang.helpFooter })
      .setTimestamp();

    // Bonus : l'admin voit aussi ses commandes
    if (interaction.user.id === ADMIN_ID) {
      embed.addFields({ name: lang.helpFieldAdminName, value: lang.helpFieldAdminValue, inline: false });
    }

    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }

  // ─── /cooldown ─────────────────────────────────────────────────────────────
  if (interaction.commandName === 'cooldown') {
    if (interaction.inGuild()) {
      return interaction.reply({ content: lang.cooldownDmOnly, flags: MessageFlags.Ephemeral });
    }
    if (isBanned(interaction.user.id)) {
      return interaction.reply({ content: lang.banned, flags: MessageFlags.Ephemeral });
    }

    const cdAnon = getRemainingCooldown(interaction.user.id);
    const cdPub  = getRemainingPublicCooldown(interaction.user.id);
    const dAnon  = getDelay();
    const dPub   = getPublicDelay();

    const anonValue = dAnon === 0
      ? lang.cooldownDisabled
      : (cdAnon > 0 ? formatDuration(cdAnon) : lang.cooldownAvailable);
    const pubValue  = dPub === 0
      ? lang.cooldownDisabled
      : (cdPub > 0 ? formatDuration(cdPub) : lang.cooldownAvailable);

    const embed = new EmbedBuilder()
      .setColor(0xE8C547)
      .setTitle(lang.cooldownTitle)
      .addFields(
        { name: lang.cooldownAnon, value: anonValue, inline: true },
        { name: lang.cooldownPub,  value: pubValue,  inline: true },
      )
      .setTimestamp();

    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
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
      return interaction.reply({ content: lang.adminDenied, flags: MessageFlags.Ephemeral });
    }

    const sub = interaction.options.getSubcommand();

    if (sub === 'reset') {
      const target = interaction.options.getUser('user');
      resetCooldown(target.id);
      resetPublicCooldown(target.id);
      return interaction.reply({ content: lang.resetSuccess(target.username), flags: MessageFlags.Ephemeral });
    }

    if (sub === 'setdelay') {
      const type    = interaction.options.getString('type');
      const hours   = interaction.options.getNumber('hours');
      const minutes = interaction.options.getNumber('minutes');

      if (hours == null && minutes == null) {
        return interaction.reply({ content: lang.setdelayMissing, flags: MessageFlags.Ephemeral });
      }

      const ms = (hours ?? 0) * 3600000 + (minutes ?? 0) * 60000;
      if (type === 'anonymous') setDelay(ms);
      else setPublicDelay(ms);

      const content = ms === 0
        ? lang.delayDisabled(type)
        : lang.delaySuccess(formatDuration(ms), type);
      return interaction.reply({ content, flags: MessageFlags.Ephemeral });
    }

    if (sub === 'delete') {
      const number = interaction.options.getInteger('number');
      const deleted = deleteConfession(number);

      if (!deleted) {
        return interaction.reply({ content: lang.deleteNotFound, flags: MessageFlags.Ephemeral });
      }

      // Edit the Discord message to show it was removed — clear content,
      // attachments (videos/images), and components, then show a "deleted" embed
      try {
        const ch  = await client.channels.fetch(deleted.channelId);
        const msg = await ch.messages.fetch(deleted.messageId);
        const deletedEmbed = new EmbedBuilder()
          .setColor(0x808080)
          .setTitle(`🗑️ Confession #${number}`)
          .setDescription(lang.deletedEmbedDesc)
          .setTimestamp();
        await msg.edit({ content: '', embeds: [deletedEmbed], components: [], attachments: [] });
      } catch { /* message unreachable, already gone */ }

      return interaction.reply({ content: lang.deleteSuccess(number), flags: MessageFlags.Ephemeral });
    }

    if (sub === 'wipe') {
      const confirm = interaction.options.getString('confirm');
      if (confirm !== 'RESET') {
        return interaction.reply({ content: lang.resetAllWrongConfirm, flags: MessageFlags.Ephemeral });
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

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

      // Snapshot consenters BEFORE reset so we can strip the participant role
      const consenters = getAllConsents();

      resetConfessions();
      resetAllCooldowns();
      resetConsents();

      // Remove participant role from everyone — keeps Discord state in sync with JSON
      if (PARTICIPANT_ROLE_ID) {
        for (const userId of consenters) {
          await removeParticipantRole(userId);
        }
      }

      updatePresence();
      return interaction.editReply({ content: lang.resetAllSuccess(deleted) });
    }

    if (sub === 'ban') {
      const target       = interaction.options.getUser('user');
      const rawId        = interaction.options.getString('id');
      const deletePublic = interaction.options.getBoolean('delete_public') ?? false;

      if (!target && !rawId) {
        return interaction.reply({ content: lang.banNoTarget, flags: MessageFlags.Ephemeral });
      }
      if (rawId && !SNOWFLAKE_REGEX.test(rawId)) {
        return interaction.reply({ content: lang.banInvalidId, flags: MessageFlags.Ephemeral });
      }

      // Defer immediately to avoid 3s timeout (role removal + consent + optional message deletes)
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const userId   = target?.id ?? rawId;
      const username = target?.username ?? rawId;

      const ok = addBan(userId);
      if (!ok) return interaction.editReply({ content: lang.banAlready(username) });
      removeConsent(userId);
      await removeParticipantRole(userId);
      updatePresence();

      if (!deletePublic) {
        return interaction.editReply({ content: lang.banSuccess(username) });
      }

      // Bulk delete from JSON in a single read+write
      const toDelete = deleteWhere(c => c.authorId === userId && !c.anonymous);
      let deleted = 0;

      for (const confession of toDelete) {
        try {
          const ch  = await client.channels.fetch(confession.channelId);
          const msg = await ch.messages.fetch(confession.messageId);
          const deletedEmbed = new EmbedBuilder()
            .setColor(0x808080)
            .setTitle(`🗑️ Confession #${confession.number}`)
            .setDescription(lang.deletedEmbedDesc)
            .setTimestamp();
          await msg.edit({ content: '', embeds: [deletedEmbed], components: [], attachments: [] });
          deleted++;
        } catch { /* message unreachable or already gone */ }
      }

      return interaction.editReply({ content: lang.banSuccessDeleted(username, deleted) });
    }

    if (sub === 'unban') {
      const target = interaction.options.getUser('user');
      const rawId  = interaction.options.getString('id');
      if (!target && !rawId) {
        return interaction.reply({ content: lang.banNoTarget, flags: MessageFlags.Ephemeral });
      }
      if (rawId && !SNOWFLAKE_REGEX.test(rawId)) {
        return interaction.reply({ content: lang.banInvalidId, flags: MessageFlags.Ephemeral });
      }
      const userId   = target?.id ?? rawId;
      const username = target?.username ?? rawId;
      const ok = removeBan(userId);
      if (!ok) return interaction.reply({ content: lang.banNotFound(username), flags: MessageFlags.Ephemeral });
      return interaction.reply({ content: lang.unbanSuccess(username), flags: MessageFlags.Ephemeral });
    }

    if (sub === 'banlist') {
      const ids = getAllBans();
      if (ids.length === 0) {
        return interaction.reply({ content: lang.banlistEmpty, flags: MessageFlags.Ephemeral });
      }
      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle(lang.banlistTitle)
        .setDescription(ids.map(id => `<@${id}>`).join('\n'))
        .setFooter({ text: `${ids.length} membre(s)` })
        .setTimestamp();
      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    if (sub === 'clearban') {
      const confirm = interaction.options.getString('confirm');
      if (confirm !== 'CLEARBAN') {
        return interaction.reply({ content: lang.clearbanWrongConfirm, flags: MessageFlags.Ephemeral });
      }
      const count = getAllBans().length;
      resetBans();
      return interaction.reply({ content: lang.clearbanSuccess(count), flags: MessageFlags.Ephemeral });
    }

    if (sub === 'stats') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

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
      const negRatio   = totalVotes > 0 ? 100 - posRatio : 0;
      const avgPerDay  = all.length > 0
        ? (all.length / Math.max(1, Math.ceil((Date.now() - all[0].timestamp) / 86400000))).toFixed(1)
        : 0;

      const embed = new EmbedBuilder()
        .setColor(0xE8C547)
        .setTitle(lang.statsTitle)
        .addFields(
          { name: lang.statsTotal,     value: `${all.length} confessions`,   inline: true },
          { name: lang.statsWeek,      value: `${week.length} confessions`,  inline: true },
          { name: lang.statsToday,     value: `${today.length} confessions`, inline: true },
          { name: lang.statsUpvotes,   value: `${totalYes} (${posRatio}%)`,  inline: true },
          { name: lang.statsDownvotes, value: `${totalNo} (${negRatio}%)`,   inline: true },
          { name: lang.statsAvg,       value: `${avgPerDay}`,                inline: true },
          { name: lang.statsPeak,      value: `${peakHour}h–${peakHour+1}h`, inline: true },
        )
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }
  }
});

client.login(process.env.BOT_TOKEN).catch(err => {
  console.error(`\n❌ BOT_TOKEN invalide ou connexion impossible : ${err.message}`);
  console.error('Corrige le .env et relance le bot.\n');
  process.exit(1);
});
