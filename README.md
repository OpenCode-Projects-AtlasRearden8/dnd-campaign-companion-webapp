# D&D Campaign Companion

A **local-first, single-file web app** for tabletop roleplay campaigns: session recaps,
NPC & party inventories, loot, a quest log, relationship hints between characters, and a
session-zero worksheet — everything **timestamped and searchable**, stored entirely in your
browser's localStorage. No cloud. No accounts. No dependencies.

> Looking for something else? This app is for **tabletop/pen-and-paper games**
> (D&D and friends). It is distinct from the Game Backlog Tracker, which tracks
> **video games** you play and finish.

Built by **Asdale Dynamics, LLC** as a practical, beginner-friendly tool: plain HTML,
CSS, and JavaScript in one `index.html` file that you can open straight from your
desktop — even offline, from `file://`.

## Quick start

1. Download or clone this folder.
2. Double-click `index.html` (or open it in any modern browser).
3. That's it. The app ships with a sample one-shot campaign,
   *The Lantern of Deepmoor Abbey*, so you can explore every feature
   before committing your own notes to it.

Your data lives in `localStorage` under the key `dnd-campaign-companion-v1`
for the origin you opened it from (for `file://`, that's your browser's
local file origin). Nothing is ever transmitted anywhere.

## What's inside

| Tab | What it tracks |
| --- | --- |
| **Sessions & Recaps** | Per-session recaps with title, date, full text, word count, created/edited timestamps, and one-click copy for sharing. |
| **NPCs & Party** | PCs (player, class, level) and NPCs (role, faction, habitat). Each person tracks their own inventory. |
| **Inventories & Loot** | Per-person gear, stacked by name and quantity, with "Move" to hand items around (partial amounts split; same-name stacks merge). Loot is tracked separately with gp values and totals. |
| **Quest Log** | Open / done / dropped, with notes and timestamps. |
| **Relationships** | Short "hints" — debts, secrets, rivalries — between any two characters, keyed for future sessions. |
| **Session Zero** | A 10-question worksheet (safety tools, lines & veils, loot splitting, cadence, backstory consent…) that saves as you type. |

**Global search** (top bar) scans recaps, PCs/NPCs, inventory, loot, quests,
relationships, and the worksheet at once, showing timestamped, highlighted
snippets you can click through to.

**Export / Import**: download the whole database as JSON, import backups back
in (merge or replace). Since it's plain JSON, it stays readable and greppable.

## Running the tests

Pure Node, no dependencies:

```sh
node tests.js       # logic tests: recap + inventory + quest/loot/search/seed
node smoke-test.js  # boots the UI in a dependency-free DOM shim
```

Both print pass/fail counts and exit non-zero on any failure. The app's core
logic lives between `/*LOGIC-START*/` and `/*LOGIC-END*/` markers in
`index.html`; the tests extract and exercise exactly the code the UI runs.

## Design notes

- **Everything is timestamped.** Every session, person, item, quest, hint and
  worksheet answer carries `createdAt` and `updatedAt`, shown in the UI and
  included in search results.
- **The logic layer is pure.** No DOM access in the game-logic functions, so
  behavior is identical in the browser and in Node's test harness.
- **File-over-platform.** One HTML file, one backup file, no services.

## Known limits

- `localStorage` is per-browser, per-origin: switching browsers or profiles
  means using Export/Import. Clearing site data clears the data — export first.
- Single-player-ish: no collaboration or sync. It's a tabletop assistant, not a
  VTT.
- Search is substring-based (case-insensitive); there is no "did you mean".

## License

MIT — see `LICENSE`. Copyright (c) 2026 Asdale Dynamics, LLC.
