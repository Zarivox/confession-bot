import { REST, Routes, SlashCommandBuilder } from 'discord.js';
import 'dotenv/config';

const commands = [
  new SlashCommandBuilder()
    .setName('confession')
    .setDescription('Envoie une confession anonyme dans le salon dédié')
    .setDMPermission(true)
    .addStringOption(option =>
      option
        .setName('message')
        .setDescription('Ta confession (personne ne saura que c\'est toi)')
        .setRequired(true)
        .setMaxLength(2000)
    )
].map(cmd => cmd.toJSON());

const rest = new REST().setToken(process.env.BOT_TOKEN);

try {
  console.log('Déploiement des commandes slash...');

  await rest.put(
    Routes.applicationCommands(process.env.CLIENT_ID),
    { body: commands }
  );

  console.log('Commandes globales déployées ! (peut prendre jusqu\'à 1h pour apparaître en MP)');
} catch (error) {
  console.error('Erreur lors du déploiement :', error);
}
