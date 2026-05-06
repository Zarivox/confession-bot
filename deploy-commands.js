import { REST, Routes, SlashCommandBuilder } from 'discord.js';
import 'dotenv/config';

const confessionCommand = new SlashCommandBuilder()
  .setName('confession')
  .setDescription('Send an anonymous confession to the dedicated channel')
  .setDMPermission(true)
  .addStringOption(option =>
    option
      .setName('message')
      .setDescription('Your confession (no one will know it was you)')
      .setRequired(false)
      .setMaxLength(2000)
  )
  .addAttachmentOption(option =>
    option
      .setName('image')
      .setDescription('Optional image to attach to your confession')
      .setRequired(false)
  );

const adminCommand = new SlashCommandBuilder()
  .setName('admin')
  .setDescription('Admin commands for managing confessions')
  .setDMPermission(false)
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
      .setDescription('Change the cooldown duration for everyone')
      .addNumberOption(option =>
        option
          .setName('hours')
          .setDescription('New cooldown in hours (e.g. 3 for 3h, 0.5 for 30min)')
          .setRequired(true)
          .setMinValue(0.1)
          .setMaxValue(168)
      )
  );

const rest = new REST().setToken(process.env.BOT_TOKEN);

try {
  console.log('Deploying slash commands...');

  // /confession — global command (available in DMs)
  await rest.put(
    Routes.applicationCommands(process.env.CLIENT_ID),
    { body: [confessionCommand.toJSON()] }
  );

  // /admin — guild command (instant update, server only)
  await rest.put(
    Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
    { body: [adminCommand.toJSON()] }
  );

  console.log('Commands deployed successfully!');
} catch (error) {
  console.error('Failed to deploy commands:', error);
}
