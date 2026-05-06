export default {
  // /confession
  dmOnly:          '❌ Cette commande ne peut être utilisée **qu\'en message privé** avec moi.',
  noContent:       '❌ Tu dois fournir au moins un message ou une image.',
  cooldown:        (t) => `⏳ Tu dois attendre encore **${t}** avant de poster une nouvelle confession.`,
  channelNotFound: '❌ Le salon des confessions est introuvable. Contacte un administrateur.',
  invalidChannel:  '❌ Le salon configuré n\'est pas un salon textuel valide.',
  invalidImage:    '❌ Le fichier joint n\'est pas une image valide.',
  sendError:       '❌ Impossible d\'envoyer ta confession. Vérifie les permissions du bot dans le salon.',
  success:         (t) => `✅ Ta confession a été postée anonymement ! Tu pourras en poster une nouvelle dans **${t}**.`,

  // Embed
  embedTitle:  '💬 Confession anonyme',
  embedFooter: 'Anonyme',

  // /top
  topTitle:    'Top confessions',
  topEmpty:    '❌ Aucune confession trouvée sur cette période.',
  periodWeek:  'Cette semaine',
  periodMonth: 'Ce mois-ci',
  periodAll:   'Depuis toujours',

  // /admin
  adminDenied:  '❌ Tu n\'as pas la permission d\'utiliser cette commande.',
  resetSuccess: (u) => `✅ Le cooldown de **${u}** a été réinitialisé. Il peut poster une confession immédiatement.`,
  delaySuccess: (h) => `✅ Délai mis à jour : les utilisateurs peuvent maintenant poster toutes les **${h}h**.`,
};
