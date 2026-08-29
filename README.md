# Aestra Fabula Ultima Character Tracker — V1

A mobile-friendly shared character tracker for a Fabula Ultima campaign.

## Included in V1

- Player login / signup through Supabase Auth
- One editable character sheet per player per campaign
- Character identity, theme, origin, level and portrait URL
- MIG / DEX / INS / WLP die sizes
- HP / MP / IP with touch-friendly +/- controls
- Fabula Points
- Status effects
- Initiative, Defence, Magic Defence and Crisis
- Classes, skills, equipment, spells, bonds, inventory / notes
- GM-only dashboard showing every player's current HP / MP / IP and statuses
- Row Level Security so players can edit only their own sheet while a GM can access all sheets
- Local demo mode before Supabase is configured

## 1. Test it locally first

You can open `index.html` directly and choose **Open local demo instead**. Demo mode saves to your browser with localStorage.

For the full online version, use the steps below.

## 2. Create a Supabase project

1. Create a new project at Supabase.
2. Open **SQL Editor**.
3. Paste all of `schema.sql` and run it.
4. Open **Authentication** and make sure Email authentication is enabled.
5. Create your own account from the website once it is running.
6. In **Table Editor -> profiles**, change your account's `is_gm` value to `true`.
7. In **Table Editor -> campaigns**, create a campaign named `Aestra` and copy its UUID.

## 3. Configure the website

Open `config.js` and enter:

```js
window.AESTRA_CONFIG = {
  supabaseUrl: "https://YOUR-PROJECT.supabase.co",
  supabaseAnonKey: "YOUR-PUBLIC-ANON-KEY",
  campaignId: "YOUR-CAMPAIGN-UUID"
};
```

The Supabase anon key is designed to be public in a browser app. The database is protected by the Row Level Security policies in `schema.sql`. Do not put a Supabase service-role key in this file.

## 4. Put it on GitHub Pages

Create a new GitHub repository, for example `aestra-character-tracker`, and upload every file from this folder to the repository root.

Then open:

**Settings -> Pages -> Build and deployment -> Deploy from a branch -> main / root**

GitHub will give you the live Pages address.

## 5. Give it to players

Each player visits the site, creates an account, and signs in. Their first save creates their personal character sheet for the campaign.

Your account should be the only account with `is_gm = true` unless you want another GM to have full access.

## Security notes

- `service_role` keys must never be added to this project.
- Players are restricted by Supabase Row Level Security, not just hidden buttons in the interface.
- The default design allows one character per account per campaign. This can be expanded later.

## Natural V2 upgrades

- Structured class / skill picker instead of text boxes
- Fabula Ultima automatic derived-stat calculations
- Weapon / armour attack formulas
- Separate spell and equipment cards
- Bonds UI
- Multiple characters per player
- Campaign invite codes
- Live Supabase Realtime updates on the GM dashboard
- Aestra-specific artwork and styling
- GM damage / healing controls directly from the dashboard
