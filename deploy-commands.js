import { REST, Routes, SlashCommandBuilder } from 'discord.js';
import 'dotenv/config';

const commands = [
  new SlashCommandBuilder()
    .setName('confession')
    .setDescription('Send an anonymous confession to the dedicated channel')
    .setDMPermission(true)
    .addStringOption(option =>
      option
        .setName('message')
        .setDescription('Your confession (no one will know it was you)')
        .setRequired(true)
        .setMaxLength(2000)
    )
].map(cmd => cmd.toJSON());

const rest = new REST().setToken(process.env.BOT_TOKEN);

try {
  console.log('Deploying slash commands...');

  await rest.put(
    Routes.applicationCommands(process.env.CLIENT_ID),
    { body: commands }
  );

  console.log('Commands deployed successfully! (may take up to 1 hour to appear in DMs)');
} catch (error) {
  console.error('Failed to deploy commands:', error);
}
