import { REST, Routes, SlashCommandBuilder, InteractionContextType } from 'discord.js';
import 'dotenv/config';

const confessionCommand = new SlashCommandBuilder()
  .setName('confession')
  .setDescription('Send a confession to the dedicated channel')
  .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel)
  .addStringOption(option =>
    option
      .setName('message')
      .setDescription('Your confession')
      .setRequired(false)
      .setMaxLength(2000)
  )
  .addAttachmentOption(option =>
    option
      .setName('image')
      .setDescription('Optional image to attach to your confession')
      .setRequired(false)
  )
  .addBooleanOption(option =>
    option
      .setName('reveal')
      .setDescription('Reveal your identity (no cooldown, unlimited posts)')
      .setRequired(false)
  );

const joinCommand = new SlashCommandBuilder()
  .setName('join')
  .setDescription('Sign the participation contract to access the confession system')
  .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel);

const contratCommand = new SlashCommandBuilder()
  .setName('contrat')
  .setDescription('Read the participation contract at any time')
  .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel);

const playerlistCommand = new SlashCommandBuilder()
  .setName('playerlist')
  .setDescription('Show members who have signed the confession contract')
  .setContexts(InteractionContextType.Guild);

const topCommand = new SlashCommandBuilder()
  .setName('top')
  .setDescription('Show the most upvoted confessions')
  .setContexts(InteractionContextType.Guild)
  .addStringOption(option =>
    option
      .setName('période')
      .setDescription('Time period to filter by')
      .setRequired(false)
      .addChoices(
        { name: 'This week',  value: 'week'  },
        { name: 'This month', value: 'month' },
        { name: 'All time',   value: 'all'   },
      )
  );

const adminCommand = new SlashCommandBuilder()
  .setName('admin')
  .setDescription('Admin commands for managing confessions')
  .setContexts(InteractionContextType.Guild)
  .addSubcommand(sub =>
    sub
      .setName('reset')
      .setDescription('Reset the cooldown of a user (give them a pass)')
      .addUserOption(option =>
        option.setName('user').setDescription('The user to reset').setRequired(true)
      )
  )
  .addSubcommand(sub =>
    sub
      .setName('setdelay')
      .setDescription('Change the cooldown for anonymous or public confessions (0 = disabled)')
      .addStringOption(option =>
        option
          .setName('type')
          .setDescription('Which cooldown to change')
          .setRequired(true)
          .addChoices(
            { name: 'Anonymous', value: 'anonymous' },
            { name: 'Public (reveal)', value: 'public' },
          )
      )
      .addNumberOption(option =>
        option
          .setName('hours')
          .setDescription('Cooldown in hours (0 to disable, e.g. 0.5 for 30min)')
          .setRequired(true)
          .setMinValue(0)
          .setMaxValue(168)
      )
  )
  .addSubcommand(sub =>
    sub
      .setName('stats')
      .setDescription('Show confession statistics')
  )
  .addSubcommand(sub =>
    sub
      .setName('delete')
      .setDescription('Delete a confession by number')
      .addIntegerOption(option =>
        option
          .setName('number')
          .setDescription('Confession number to delete')
          .setRequired(true)
          .setMinValue(1)
      )
  )
  .addSubcommand(sub =>
    sub
      .setName('wipe')
      .setDescription('Delete ALL confessions and wipe memory — restarts at #1')
      .addStringOption(option =>
        option
          .setName('confirm')
          .setDescription('Type RESET to confirm')
          .setRequired(true)
      )
  )
  .addSubcommand(sub =>
    sub
      .setName('ban')
      .setDescription('Ban a user from the confession system')
      .addUserOption(option =>
        option.setName('user').setDescription('User to ban (if still in the server)').setRequired(false)
      )
      .addStringOption(option =>
        option.setName('id').setDescription('User ID to ban (if they left the server)').setRequired(false)
      )
      .addBooleanOption(option =>
        option.setName('delete_public').setDescription('Also delete all public confessions from this user').setRequired(false)
      )
  )
  .addSubcommand(sub =>
    sub
      .setName('unban')
      .setDescription('Unban a user from the confession system')
      .addUserOption(option =>
        option.setName('user').setDescription('User to unban (if still in the server)').setRequired(false)
      )
      .addStringOption(option =>
        option.setName('id').setDescription('User ID to unban (if they left the server)').setRequired(false)
      )
  )
  .addSubcommand(sub =>
    sub
      .setName('banlist')
      .setDescription('Show all banned users')
  )
  .addSubcommand(sub =>
    sub
      .setName('clearban')
      .setDescription('Remove ALL bans at once')
      .addStringOption(option =>
        option
          .setName('confirm')
          .setDescription('Type CLEARBAN to confirm')
          .setRequired(true)
      )
  )
  .addSubcommand(sub =>
    sub
      .setName('info')
      .setDescription('Show full status of a user (banned, consented, role, cooldowns, confessions)')
      .addUserOption(option =>
        option.setName('user').setDescription('User to inspect (if still in the server)').setRequired(false)
      )
      .addStringOption(option =>
        option.setName('id').setDescription('User ID to inspect (if they left the server)').setRequired(false)
      )
  );

const rest = new REST().setToken(process.env.BOT_TOKEN);

try {
  console.log('Deploying slash commands...');

  // /confession, /join, /contrat — global commands (available in DMs)
  await rest.put(
    Routes.applicationCommands(process.env.CLIENT_ID),
    { body: [confessionCommand.toJSON(), joinCommand.toJSON(), contratCommand.toJSON()] }
  );

  // /top, /admin, /playerlist — guild commands (instant update, server only)
  await rest.put(
    Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
    { body: [topCommand.toJSON(), adminCommand.toJSON(), playerlistCommand.toJSON()] }
  );

  console.log('Commands deployed successfully!');
} catch (error) {
  console.error('Failed to deploy commands:', error);
}
