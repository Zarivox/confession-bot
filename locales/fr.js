export default {
  // /confession
  dmOnly:          '❌ Cette commande ne peut être utilisée **qu\'en message privé** avec moi.',
  noContent:       '❌ Tu dois fournir au moins un message ou une image.',
  cooldown:        (t) => `⏳ Tu dois attendre encore **${t}** avant de poster une nouvelle confession.`,
  channelNotFound: '❌ Le salon des confessions est introuvable. Contacte un administrateur.',
  invalidChannel:  '❌ Le salon configuré n\'est pas un salon textuel valide.',
  invalidImage:    '❌ Le fichier joint n\'est pas une image valide.',
  sendError:       '❌ Impossible d\'envoyer ta confession. Vérifie les permissions du bot dans le salon.',
  saveError:       '❌ Erreur interne lors de l\'enregistrement. Réessaie dans quelques instants.',
  success:         (t) => `✅ Ta confession a été postée anonymement ! Tu pourras en poster une nouvelle dans **${t}**.`,
  successReveal:   `✅ Ta confession a été postée avec ton identité.`,

  // Embed
  embedTitle:  '💬 Confession anonyme',
  embedFooter:       'Anonyme',
  embedFooterPublic: 'Confession publique',
  postedBy:          'Posté par',

  // /top
  topTitle:    'Top confessions',
  topEmpty:    '❌ Aucune confession trouvée sur cette période.',
  periodWeek:  'Cette semaine',
  periodMonth: 'Ce mois-ci',
  periodAll:   'Depuis toujours',

  // Votes
  alreadyVoted:      '❌ Tu as déjà voté sur cette confession.',
  confessionNotFound:'❌ Confession introuvable.',

  // /join
  joinAlready:      '✅ Tu as déjà signé le contrat, tu peux utiliser `/confession`.',
  joinSuccess:      '✅ Contrat signé ! Tu peux maintenant utiliser `/confession` en MP avec moi.',
  joinContractTitle: '📋 Contrat de participation — Confessions',
  joinContractDesc: [
    '> Avant de pouvoir poster une confession, tu dois lire et accepter les conditions suivantes.\n',
    '**1. Responsabilité**',
    'Tu es entièrement responsable du contenu que tu publies. Toute confession peut avoir des conséquences réelles.',
    '',
    '**2. Contenu interdit**',
    'Les confessions à caractère haineux, discriminatoire, harcelant ou illégal sont strictement interdites.',
    '',
    '**3. Modération**',
    "L'administration se réserve le droit de supprimer toute confession sans préavis et sans avoir à se justifier.",
    '',
    '**4. Anonymat relatif**',
    "Bien que les confessions soient anonymes pour les autres membres, **l'administrateur peut identifier l'auteur** en cas d'abus grave.",
    '',
    '**5. Engagement**',
    "En cliquant sur **J'accepte**, tu confirmes avoir lu ces conditions, les comprendre, et t'engager à les respecter.",
  ].join('\n'),
  joinButton:        "J'accepte",
  joinSuccessTitle:  '✅ Contrat signé !',
  joinNotConsented:  '❌ Tu dois d\'abord signer le contrat avec `/join` pour poster une confession.',

  // /playerlist
  playerlistTitle:   '📋 Membres ayant signé le contrat',
  playerlistEmpty:   '❌ Aucun membre n\'a encore signé le contrat.',
  playerlistPage:    (cur, total) => `Page ${cur} / ${total}`,
  playerlistExpired: '❌ Liste expirée, refais `/playerlist`.',

  // Helper interne
  authorResult:    (n, tag, id) => `🔍 La confession **#${n}** a été postée par **${tag}** (<@${id}>)`,
  revealAdminOnly: '❌ Cette action est réservée à l\'administrateur.',

  // /admin stats
  statsTitle:    '📊 Statistiques des confessions',
  statsTotal:    '📝 Total',
  statsWeek:     '📅 Cette semaine',
  statsToday:    '🌅 Aujourd\'hui',
  statsUpvotes:  '✅ Votes positifs',
  statsDownvotes:'❌ Votes négatifs',
  statsAvg:      '📈 Moyenne/jour',
  statsPeak:     '⏰ Heure de pointe (UTC)',

  // Ban
  banned:        '🚫 Tu es banni et ne peux plus interagir avec le bot de confessions.',
  banSuccess:    (u) => `✅ **${u}** a été banni et retiré de la liste des participants.`,
  banAlready:    (u) => `❌ **${u}** est déjà banni.`,
  banNoTarget:   '❌ Fournis un utilisateur ou un ID.',
  unbanSuccess:  (u) => `✅ **${u}** a été débanni.`,
  banNotFound:   (u) => `❌ **${u}** n'est pas dans la liste des bannis.`,
  banlistTitle:       '🚫 Membres bannis',
  banlistEmpty:       '✅ Aucun membre banni.',
  clearbanWrongConfirm: '❌ Tu dois taper exactement **CLEARBAN** pour confirmer.',
  clearbanSuccess:    (n) => `✅ Liste de bannissement vidée. **${n}** membre(s) débanni(s).`,

  // /admin
  adminDenied:   '❌ Tu n\'as pas la permission d\'utiliser cette commande.',
  resetSuccess:  (u) => `✅ Les cooldowns de **${u}** ont été réinitialisés (anonyme + public).`,
  delaySuccess:  (h, type) => `✅ Cooldown **${type === 'anonymous' ? 'anonyme' : 'public'}** mis à jour : **${h}h**.`,
  delayDisabled: (type) => `✅ Cooldown **${type === 'anonymous' ? 'anonyme' : 'public'}** désactivé.`,
  deleteSuccess:      (n) => `✅ La confession **#${n}** a été supprimée.`,
  deleteNotFound:     '❌ Aucune confession trouvée avec ce numéro.',
  deletedEmbedDesc:   'Cette confession a été supprimée par l\'administrateur.',
  resetAllWrongConfirm: '❌ Tu dois taper exactement **RESET** pour confirmer.',
  resetAllSuccess:    (n) => `✅ Reset complet effectué. **${n}** message(s) supprimé(s). La prochaine confession sera la #1.`,
};
