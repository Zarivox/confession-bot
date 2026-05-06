export default {
  // /confession
  dmOnly:          '❌ This command can only be used in **direct messages** with me.',
  noContent:       '❌ You must provide at least a message or an image.',
  cooldown:        (t) => `⏳ You need to wait **${t}** before posting a new confession.`,
  channelNotFound: '❌ The confession channel could not be found. Please contact an administrator.',
  invalidChannel:  '❌ The configured channel is not a valid text channel.',
  invalidImage:    '❌ The attached file is not a valid image.',
  sendError:       '❌ Failed to send your confession. Check the bot permissions in the channel.',
  saveError:       '❌ Internal error while saving. Please try again in a moment.',
  success:         (t) => `✅ Your confession has been posted anonymously! You can post again in **${t}**.`,
  successReveal:   `✅ Your confession has been posted with your identity.`,

  // Embed
  embedTitle:      '💬 Anonymous Confession',
  embedFooter:       'Anonymous',
  embedFooterPublic: 'Public confession',
  postedBy:          'Posted by',

  // /top
  topTitle:    'Top Confessions',
  topEmpty:    '❌ No confessions found for this period.',
  periodWeek:  'This week',
  periodMonth: 'This month',
  periodAll:   'All time',

  // Votes
  alreadyVoted:       '❌ You have already voted on this confession.',
  confessionNotFound: '❌ Confession not found.',

  // /join
  joinAlready:       '✅ You have already signed the contract, you can use `/confession`.',
  joinSuccess:       '✅ Contract signed! You can now use `/confession` in DMs with me.',
  joinContractTitle: '📋 Participation Contract — Confessions',
  joinContractDesc:  [
    '> Before you can post a confession, you must read and accept the following terms.\n',
    '**1. Responsibility**',
    'You are solely responsible for the content you post. Any confession may have real consequences.',
    '',
    '**2. Prohibited content**',
    'Confessions that are hateful, discriminatory, harassing, or illegal are strictly forbidden.',
    '',
    '**3. Moderation**',
    'The administration reserves the right to remove any confession at any time without notice or justification.',
    '',
    '**4. Relative anonymity**',
    'While confessions are anonymous to other members, **the administrator can identify the author** in case of serious abuse.',
    '',
    '**5. Commitment**',
    "By clicking **I agree**, you confirm that you have read, understood, and agree to abide by these terms.",
  ].join('\n'),
  joinButton:        'I agree',
  joinNotConsented:  '❌ You must first sign the contract with `/join` before posting a confession.',

  // /playerlist
  playerlistTitle:   '📋 Members who signed the contract',
  playerlistEmpty:   '❌ No members have signed the contract yet.',

  // Internal helper
  authorResult:    (n, tag, id) => `🔍 Confession **#${n}** was posted by **${tag}** (<@${id}>)`,
  revealAdminOnly: '❌ This action is reserved for the administrator.',

  // /admin
  adminDenied:  '❌ You do not have permission to use this command.',
  resetSuccess: (u) => `✅ Cooldown reset for **${u}**. They can post a confession immediately.`,
  delaySuccess: (h) => `✅ Cooldown updated: users can now post every **${h}h**.`,
  deleteSuccess:        (n) => `✅ Confession **#${n}** has been deleted.`,
  deleteNotFound:       '❌ No confession found with that number.',
  deletedEmbedDesc:     'This confession was deleted by the administrator.',
  resetAllWrongConfirm: '❌ You must type exactly **RESET** to confirm.',
  resetAllSuccess:      (n) => `✅ Full reset done. **${n}** message(s) deleted. Next confession will be #1.`,
};
