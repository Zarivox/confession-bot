export default {
  // /confession
  dmOnly:          '❌ This command can only be used in **direct messages** with me.',
  noContent:       '❌ You must provide at least a message or an image.',
  cooldown:        (t) => `⏳ You need to wait **${t}** before posting a new confession.`,
  channelNotFound: '❌ The confession channel could not be found. Please contact an administrator.',
  invalidChannel:  '❌ The configured channel is not a valid text channel.',
  invalidImage:    '❌ The attached file is not a valid image.',
  sendError:       '❌ Failed to send your confession. Check the bot permissions in the channel.',
  success:         (t) => `✅ Your confession has been posted anonymously! You can post again in **${t}**.`,

  // Embed
  embedTitle:  '💬 Anonymous Confession',
  embedFooter: 'Anonymous',

  // /top
  topTitle:    'Top Confessions',
  topEmpty:    '❌ No confessions found for this period.',
  periodWeek:  'This week',
  periodMonth: 'This month',
  periodAll:   'All time',

  // Votes
  alreadyVoted:       '❌ You have already voted on this confession.',
  confessionNotFound: '❌ Confession not found.',

  // Helper context menu
  actionLabel:       'Author action',
  helperNotFound:    '❌ This message is not linked to a known confession.',
  authorResult:      (n, tag, id) => `🔍 Confession **#${n}** was posted by **${tag}** (<@${id}>)`,
  revealAdminOnly:   '❌ This action is reserved for the administrator.',

  // /admin
  adminDenied:  '❌ You do not have permission to use this command.',
  resetSuccess: (u) => `✅ Cooldown reset for **${u}**. They can post a confession immediately.`,
  delaySuccess: (h) => `✅ Cooldown updated: users can now post every **${h}h**.`,
};
