# Shared stats core

This is an isolated stats foundation. The live meadow, pages, saved characters and server routes still use their existing code. None imports this package yet.

From the repository root:

```sh
npm ci
npm run build:shared
npm run test:shared
npm run sim:balance -- --runs 200
npm run sim:balance -- --level 1,10,30,50,99 --class novice_knight,archer,mage --monster all --runs 1000 --seed 1
npm run sim:balance -- --level 1,10,30,50,99 --runs 200 --seed 1 --pvp
```

The rule for future balancing is **change JSON → run sim:balance → commit both**. This task intentionally makes no commit. Check in the dated `sim/out/*.json` and `.md` alongside data changes. The same-day PvP run has a `-pvp` suffix so it cannot overwrite the PvE run. Re-running the same mode/date replaces that mode's report; use a separate copy for historical comparisons.

## Import and build contract

The root npm workspace links `@thainative/shared`. `npm run build` builds it before the existing server/web builds. TypeScript emits JS, declarations and copies of static JSON into `shared/dist/`; dist remains ignored. No alias, bundler plugin or runtime TypeScript loader is needed.

```ts
import {loadGameData, deriveStats, computeDamage, seededRng} from '@thainative/shared';
const data=loadGameData();
const aerin=deriveStats(data.stats.defaultBuild,data);
```

Node resolves `dist/src/index.node.js`, reads the built JSON files on every load, and accepts an optional directory URL for validation tools. Vite resolves the browser entry, which imports the JSON statically and has no Node dependencies. If workspaces are undesirable later, use explicit relative imports of `shared/dist/src/index.node.js` on the server and `shared/dist/src/index.js` in Vite. Rebuild after editing source JSON: Node's default reads the copied dist data, not the source files. Both loaders validate and return the same typed `GameData`; `validateGameData` also accepts an in-memory ten-file object. Errors name the JSON file and dotted path. Schemas reject unknown fields, invalid enums, duplicate IDs, bad references, malformed tables and non-finite values.

## Data and calculation choices

All ten data files have `dataVersion: 1`. Values are explicit, including Thai names, race passives, realm tags, status effects, PvP policy and the EXP table. Equipment/cards share a discriminated modifier vocabulary. Cards require a matching slot, with per-slot capacity checks. Characters store stats **before** race/card bonuses; the returned `stats` are effective values. The sample player intentionally carries `starterGrant: true`, because the brief's legacy default cannot be bought with its stated starting point budget.

`deriveStats` adds race/stat modifiers, caps base stats at 99, computes formulas, adds flat equipment and then multiplies by one plus the summed percentage modifiers. Regen uses the modified HP/SP pools and preserves floats. Display rounding belongs to the caller. Hard DEF/MDEF have no invented numeric cap: their damage reduction is capped at 70%. HP/SP/ATK likewise have no unspecified numeric ceiling.

Other caps: crit 60%; physical hit 5–95% (PvP minimum 25%); ASPD at most 2.2/base weapon interval; cast reduction 50%; movement 1.6×; status/race resistance 80%; elemental resistance 50%; total defensive damage reduction 80%; each race/element/size bonus category +100%. Elemental vulnerabilities may be negative, down to −100%. No default gear exists above the training set. The sword uses a 0.44s base interval, approximately the meadow's mean combo cooldown `(0.38+0.38+0.55)/3`.

`computeDamage` is pure and takes the RNG from its context. Physical single-target attacks roll hit, then eligible physical attacks roll crit, then landed damage rolls variance. Area and magic attacks always hit; magic never crits. `comboThird` selects the data's 170% coefficient. Utilities do zero offensive damage. Heal skills bypass defence, element, size and crit. The ambiguous potion text is interpreted as `65 × (1 + VIT × 0.02)`; the default heals 72 after rounding.

Three formula ambiguities are resolved explicitly:

- Race multiplier is `(1 + capped race bonus) × (1 − race resist)`. The printed expression without parentheses would make resistance ineffective against an attacker with no bonus.
- PvP requires **both** actors to be players. A skill override replaces only the kind multiplier; the mode reduction still applies. Monster damage to a player receives no PvP reduction.
- The total reduction floor is 20% of damage before defensive reductions, retaining the elemental matchup, size and offensive bonuses/crit/variance and PvP skill coefficient. Soft DEF, hard DEF, elemental/race resistance and global PvP reduction share that floor. It never erases an elemental immunity; integer damage rounds up only when necessary to preserve the floor. `breakdown` includes the reference, floor, pre-round result and cap flag.

Element bonuses are applied with the attack element, although the printed formula omits that modifier category. These choices are covered by tests rather than hidden in the simulator.

`statusChance` computes capped resistance and boss immunity; `applyStatus` uses caller-supplied time/RNG and refreshes without stacking. The caller retains CC history and passes successful CC application times for the 15-second 100/50/25/0% diminishing rule. Fear targets ghost bodies only. Scripted boss stun can bypass immunity. `healReduction` combines race and recent-player-hit reductions. Effects are stored as typed data for the next integration task; this package does not move actors or mutate the live sim. Arena equalization/standard-gear selection, honor, karma and potion restrictions remain typed policy for future server enforcement; freepk's level gate is already enforced by damage calculation.

## Golden tuning and conflicts

Only the allowed default build and monster data were tuned. The formulas and skill coefficients remain as specified.

| JSON value | Requested | Tuned | Reason |
|---|---:|---:|---|
| Default INT after race | 2 | 4 | SP 67.32 → 68.64, just inside ±15% of 80 |
| Pink HP | 50 | 42 | Three nominal 14-damage basic hits |
| Pink hard DEF/MDEF | 2 | 15 | Wind→water's 150% multiplier otherwise overshoots spin |
| Pink ATK | 10 | 12 | Incoming damage 6 → 8 after new DEF/size rules |
| King HP | 900 | 1100 | Offensive average-play TTK enters 60–120 seconds |
| King phase-one ATK | 22 | 27 | Incoming damage 17 → 21 |

At unit variance without crit: basic **14**, combo-third **24**, whirlwind **44**, meteor **13**, incoming pink **8**, phase-one King **21**, HP **126**, SP **68.64**. Before tuning those were 15, 27, 50, 8, 6, 17, 126 and 67.32 respectively. The meteor's fire→water multiplier is explicitly 0.5; neutral-vs-water at the same stats would yield about 26. Today's meadow meteor does a fixed 58, so preserving that feel is incompatible with this new formula and default build.

The brief calls spin ≈39, while today's sim actually uses 38. Tuned 44 is +12.82% from 39 but +15.79% from 38. Tests assert the first target and explicitly record that the second fails; they do not silently change the tolerance. With water kept for meteor and nonnegative DEF, the rounded basic ≥14/third ≥24 constraints imply spin ≥44, so all actual-value tolerances cannot be met together by these inputs.

The original default allocates eleven stat increases (22 cost points), not three free points. Raising INT adds two more, for 26 cost points. That is a named starter fixture, not the legal `buildForLevel` allocation; other auto builds spend only `3 × level` points and leave no affordable upgrade. The closed-form EXP table also differs eventually from today's recursively rounded, uncapped 1.45× progression; it remains exactly as requested, with a 1.18× slope after level 20.

## Reading balance results

The simulator prints a compact table with red outliers and writes full JSON/Markdown. TTK and landed hits-to-die report mean/p10/p90. EXP/min includes a two-second walk per kill, human EXP bonus and win rate. Each ordered class pair is run at each requested level in both duel and GvG with `--pvp`.

This is a transparent model, not the live meadow. Each trial starts at full HP/SP, regens at the new per-five-second rates, and picks the highest-damage affordable off-cooldown skill, then basic combo. Cast delay and ASPD recovery are included. Bosses expose a fixed 35% attack window in each four seconds to model repositioning/telegraphs; that choice is reported in output. Incoming monsters use a basic hit every 1.5s (King 2s). There are no consumables, camp heals, scripted stun windows, King phase changes/summons, evasion movement or skill unlock restrictions. Stub classes receive a simulator-only copy of the training sword's stats with their class weapon type; no real bow/staff item is invented in production data.

**TTK is potential offensive kill time, including trials where the player loses the survival race.** Losses are not dropped from percentiles. Win rate separately tracks concurrent HP, counts simultaneous lethal hits as draws with half credit (also recorded as `drawRate`), and avoids first-actor tie bias; EXP is zero on losses. The level-one default loses to the King without defensive movement/potions, even when its offensive TTK is in the requested range. `censored` counts 600s timeouts. Hits-to-die is an isolated landed-basic-hit budget without regen (crit/variance retained), not attack attempts. High-level characters farming level-one monsters and all classes sharing the current three offensive skills produce many red rows; these are findings, not auto-tuning instructions. Arena gear equalization is outside the duel/GvG simulator.

The SP regen formula is much lower than the live meadow's 4 SP/s (default here about 0.27/s), and the current fixed +20 HP/+5 MP level gains differ from the new scaling formulas. Review these differences before a future integration. Running this package does not change either behavior in the playable game.

Pink jelly is also a one-shot to an opening whirlwind in this rotation, unlike today’s fixed 38 vs 48 HP. That is flagged as sub-second TTK, not hidden by tuning away the elemental rule. The simulator is a tool to expose these conflicts, not a claim that the data are ready to replace live combat.

Verification: all **71 tests** pass (35 meadow, 12 server, one web build, 23 shared), the full build passes, and workspace imports were independently compiled with Vite and the server’s TypeScript 5.9/NodeNext setup. At 200 runs/row, the saved PvE report covers 75 rows/15,000 trials and flags 42 rows; duel/GvG covers 90 rows/18,000 trials and flags 32. No 600s timeouts occurred. The default King potential TTK is **67.20s** (p10 65.00, p90 69.00), with **0% win rate** under the documented defensive limitations. Full before/after values and conflicts are in `.codex-run/stats-core-report.json`; the requested Markdown copy is `.codex-run/balance-step1.md`.
