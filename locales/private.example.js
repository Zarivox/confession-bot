// ─────────────────────────────────────────────────────────────────────────────
// PRIVATE LOCALE OVERRIDES — instance-specific strings
// ─────────────────────────────────────────────────────────────────────────────
//
// Copy this file to `locales/private.js` (which is gitignored) and override
// any key from your active locale (`fr.js` or `en.js`).
//
// At startup, the bot loads your active locale, then merges this file on top,
// so any key you define here REPLACES the default.
//
// This is the recommended way to keep instance-specific content (custom
// contract text, server-specific wording, etc.) out of the public repo.
//
// Examples:
//   - Customise the contract description for your private server
//   - Change the success message after signing
//   - Swap the embed title for branding
//
// If `locales/private.js` does not exist, the bot uses the default locale.
// ─────────────────────────────────────────────────────────────────────────────

export default {
  // Example: override the contract description shown in /join and /contrat
  joinContractDesc: [
    '> Custom contract description for this server.',
    '',
    '**1. Your custom rule**',
    'Replace this with your own terms.',
    '',
    '**2. Engagement**',
    "By entering the required phrase, you accept these custom terms.",
  ].join('\n'),

  // You can override any other key from fr.js / en.js the same way.
  // Keys not listed here keep their default value.
};
