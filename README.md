# Aestra Complete Companion — Build 122

A shared, mobile-first Fabula Ultima campaign companion for Aestra, backed by Supabase and deployed through GitHub Pages.

## Current player experience

- Hero Console / Play screen with character name, level, classes, HP, MP, IP and Fabula Points
- Live MIG / DEX / INS / WLP dice on the Hero Console
- Status-aware attribute dice: Slow → DEX, Dazed → INS, Weak → MIG, Shaken → WLP, with the existing Enraged/Poisoned combinations preserved
- Adventure Mode with quick actions, attacks, magic, skills, items and core actions
- Character Build, Inventory and Notes pages
- Bonds, equipment, spells, Arcana, Heroic Skills and class progression
- Dedicated class tools including Floralist, Gourmet, Invoker, Merchant, Chanter, Commander, Dancer, Symbolist, Esper, Mutant and Pilot systems
- Rules Compendium and global Ctrl/Cmd + K search
- Character Creator using enabled campaign source books
- Undo for session resource/status changes

## GM experience

- Party dashboard and detailed character editing
- Quick party resource controls
- Scene controls with safe New Scene resets
- Persistent scene clocks and campaign source settings
- GM Magiseed support

## Campaign sources

Enabled:

- Core Rulebook
- High Fantasy Atlas
- Natural Fantasy Atlas
- Techno Fantasy Atlas

Explicitly disabled for this campaign:

- Quirks
- Zero Powers
- Technospheres

## Build 122 stabilisation work

Build 122 begins the transition from the original long-form character editor toward a player-first companion app.

- The primary player area is labelled **Play**.
- The Hero Console now displays all four current Attribute dice.
- Attribute dice listen to the same status-adjustment events as the character sheet; there is no second condition rules engine.
- Status-reduced dice are visually marked and show their base die.
- Name-scoped local Quick/Undo data is migrated when a character is renamed so it is not silently lost.
- Important player controls receive larger touch targets and clearer keyboard focus treatment.
- Legacy GM INS markup is repaired at runtime for compatibility with the existing editor modules.
- PWA/version/cache metadata has been bumped to Build 122.

The larger legacy module chain is intentionally still present in Build 122. It is being stabilised before deeper consolidation so working class mechanics are not put at risk by a single large rewrite.

## Validation

The GitHub Actions validation workflow checks:

- JavaScript syntax for every root JavaScript module
- JSON manifest/version validity
- Completion/cache module wiring
- Build 122 Hero Console attribute integration
- The status-to-attribute reduction contract
- Campaign systems that must remain disabled

## Local demo

Open `index.html` and choose **Open local demo instead**. Demo mode stores its character locally in the browser.

## Supabase configuration

The browser uses the public Supabase anon/publishable key from `config.js` / the page configuration. Database security is enforced with Row Level Security from `schema.sql`.

Never place a Supabase `service_role` key in this repository.

## Deployment

GitHub Pages deploys the `main` branch. The PWA service worker uses versioned caches and `version.json` to notify clients when a newer tracker build is available.
