# STATUS — D&D Campaign Companion

**Date:** 2026-10-27
**State:** Complete and verified. Ready to use.

## What was built

A single-file, zero-dependency, local-first web app (`index.html`) for
tabletop-roleplay campaign record-keeping:

- **Campaigns**: create/switch/delete multiple campaigns.
- **Sessions & recaps**: title, played-on date, full recap text; word count;
  copy-to-clipboard; created/edited timestamps shown and stored.
- **NPCs & party**: PCs (player/class/level) and NPCs (role/faction/location);
  deleting a person cleans up their inventory and relationship hints and
  re-homes their loot to the party.
- **Inventories**: per-person item lists, stacked by name across quantity;
  add/edit/delete; "Move" transfers all or part of a stack and merges
  same-name items at the destination.
- **Loot**: separate treasure list with gp values, holder, and live totals.
- **Quest log**: open/done/dropped with notes and timestamps.
- **Relationship hints**: directed pair bonds between any two characters with
  a type label and a short hint, timestamped.
- **Session-zero worksheet**: 10 starter questions (safety tools, lines & veils,
  loot splitting, cadence, backstory consent, and more); saves as you type.
- **Global search**: one box scans every section; results are timestamped,
  snippet-highlighted (`<mark>`), and clicking a result jumps to its tab.
- **Export/Import**: whole database as pretty-printed JSON; import merges or
  replaces with per-campaign validation.
- **Sample content**: a seeded one-shot campaign, "The Lantern of Deepmoor
  Abbey" — 3 PCs, 3 NPCs, inventories, 4 treasure lots, 4 quests, 4
  relationship hints, 2 session recaps, and a fully answered worksheet.

## How to run

Open `index.html` in any modern browser (double-click works — `file://` is
fine). Data persists in that browser's localStorage. No server, build step,
account, or network access involved.

## Verification results

```
node tests.js        → 27 passed, 0 failed
node smoke-test.js   → 6/6 checks passed (UI boot, seed, all tabs render,
                       search rendering, dialogs build, campaign switching)
```

- `tests.js` exercises the app's exact logic (extracted from the
  `/*LOGIC-START*/ … /*LOGIC-END*/` region of `index.html`), covering recap
  logic (mandatory title/recap, date validation, timestamps, sorting,
  summarization, word count, formatted export) and inventory logic
  (stacking, positive-qty validation, partial/full removal with clamping,
  whole-item transfers with same-name merging, fraction quantities).
- A manual balance check confirmed every tab renders balanced HTML
  (open/close counts equal for div/span/h2/h3/button/label/select/textarea).
- Packaging checks: exactly one `<script>` and one `<style>`, no external
  URLs, no `@import`, no secrets.

Bugs found and fixed during verification: missing `loot` array on new
campaigns; quantity-0 silently became 1 when adding items; seed
relationships missing timestamps; item names not canonicalized (stack key was
case-insensitive but display wasn't); search result click-through referenced
an undefined handler; UI object not exported for programmatic tests; seed
not persisted until first edit; session-zero debounce could save to a
campaign that was switched mid-timer (now guarded).

## Known gaps

- **No multi-window/multi-tab sync**: two open tabs of the same app can
  overwrite each other's localStorage writes. Fine for one GM tab; export
  before serious parallel editing.
- **Search** is case-insensitive substring matching with no ranking or typo
  tolerance; results are capped at 60 with newest-timestamp ordering.
- **localStorage capacity** (~5 MB per origin) is generous for text but not
  unbounded; very heavy image-in-notes usage would eventually hit it (images
  aren't supported anyway).
- **Recap editing** replaces text; there is no revision history beyond the
  `updatedAt` stamp.
- No filesystem access by design — backups are manual (Export button).

## Repo layout

- `index.html` — the entire app (HTML + CSS + JS in one file).
- `tests.js` — logic tests (run: `node tests.js`).
- `smoke-test.js` — dependency-free UI boot smoke test (`node smoke-test.js`).
- `README.md`, `LICENSE` (MIT, © 2026 Asdale Dynamics, LLC), `STATUS.md`.

A self-contained tooling project by Asdale Dynamics, LLC.
