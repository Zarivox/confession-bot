# Admin commands

Every command under `/admin` is gated by `ADMIN_ID`. Any other user gets a permission error.

All admin replies are **ephemeral** (only the admin sees them).

---

## `/admin reset`

Reset both cooldowns (anonymous + public) for a specific user — useful as a "give them a pass" mechanic.

| Option | Type | Required | Notes |
|---|---|---|---|
| `user` | user mention | ✅ | Target |

**Effect** : `cooldowns.json` entries for that user are removed. They can post immediately, regardless of when they last posted.

---

## `/admin setdelay`

Change the cooldown duration for a specific mode.

| Option | Type | Required | Notes |
|---|---|---|---|
| `type` | `Anonymous` / `Public (reveal)` | ✅ | Which cooldown to change |
| `hours` | number, 0–168 | one of hours/minutes | Hour part (supports decimals like `1.5`) |
| `minutes` | number, 0–10080 | one of hours/minutes | Minute part, added to hours |

Examples :

| Goal | Command |
|---|---|
| 6h cooldown for anon | `/admin setdelay type:Anonymous hours:6` |
| 1h30 cooldown for anon | `/admin setdelay type:Anonymous hours:1.5` or `hours:1 minutes:30` |
| Exactly 10 minutes | `/admin setdelay type:Anonymous minutes:10` |
| Disable anon cooldown | `/admin setdelay type:Anonymous hours:0 minutes:0` |
| 24h cooldown for public | `/admin setdelay type:"Public (reveal)" hours:24` |

Setting both `hours` and `minutes` to `0` **disables** the cooldown for that mode (unlimited posting).

---

## `/admin stats`

Returns an ephemeral embed with the bot's overall statistics :

- 📝 Total confessions
- 📅 This week
- 🌅 Today
- ✅ Total upvotes (with %)
- ❌ Total downvotes (with %)
- 📈 Average per day (since the first confession)
- ⏰ Peak hour (UTC)

Counts merge both public and anonymous confessions transparently.

---

## `/admin delete`

Delete a specific confession by number.

| Option | Type | Required | Notes |
|---|---|---|---|
| `number` | integer ≥1 | ✅ | The confession number to delete |

**Effect** :

1. The entry is removed from `confessions-public.json` or `confessions-anon.json` (whichever holds it)
2. The Discord message is **edited in place** (not deleted) to a gray "🗑️ Confession #N — deleted by administrator" embed, with content / attachments / vote buttons all stripped
3. The confession number is **not reused** — the global counter keeps incrementing

This way users see that something used to be there, with clear admin context, instead of a confusing gap or a deleted message.

---

## `/admin wipe`

**Destructive** — removes everything.

| Option | Type | Required | Notes |
|---|---|---|---|
| `confirm` | string | ✅ | Must be exactly `RESET` |

**Effect** :

1. Iterates every confession from both files and deletes the corresponding Discord message
2. Resets `confessions-public.json` (counter back to 0, list empty) and `confessions-anon.json` (list empty)
3. Resets all cooldowns (`cooldowns.json`)
4. Resets all consents (`consents.json`)
5. Removes the participant role from every previous signer (if `PARTICIPANT_ROLE_ID` is set)
6. Updates the live presence count to 0
7. Replies with the count of messages successfully deleted

The next confession after a wipe is **#1**.

!!! warning "Bans persist"
    `/admin wipe` does **NOT** clear the ban list. Use `/admin clearban` for that.

---

## `/admin ban`

Ban a user from the confession system.

| Option | Type | Required | Notes |
|---|---|---|---|
| `user` | user mention | one of user/id | Target if still in the server |
| `id` | string (snowflake) | one of user/id | Target by ID if they left the server |
| `delete_public` | boolean | optional | Also delete every public confession by this user |

**Effect** :

1. Adds the user ID to `bans.json`
2. Removes their consent (`consents.json`)
3. Removes the participant role (if applicable)
4. If `delete_public:true` :
    - Filters `confessions-public.json` for entries where `authorId === user`
    - For each match, edits the Discord message to the gray "deleted" embed
    - Strips content / attachments / buttons
    - Reports `« banned, removed from participants, and N public confession(s) deleted »`

!!! info "Anonymous confessions are untouched"
    `delete_public:true` only operates on the **public** file. Anonymous confessions remain — by design, the bot has no way to filter them by author since their author IDs are encrypted at rest.

---

## `/admin unban`

Reverse a ban.

| Option | Type | Required | Notes |
|---|---|---|---|
| `user` | user mention | one of user/id | Target if still in the server |
| `id` | string (snowflake) | one of user/id | Target by ID if they left the server |

**Effect** : the user ID is removed from `bans.json`. They can interact with the bot again, but **must re-sign the contract via `/join`** before posting (the unban does not restore consent).

---

## `/admin banlist`

Show all banned users as an ephemeral embed listing each as `<@id>`.

If the list is empty, replies with « No banned members ».

---

## `/admin clearban`

Wipe the entire ban list.

| Option | Type | Required | Notes |
|---|---|---|---|
| `confirm` | string | ✅ | Must be exactly `CLEARBAN` |

**Effect** : `bans.json` is reset to empty. All previously banned users can interact again (and must re-sign the contract).

The reply tells you how many users were unbanned.
