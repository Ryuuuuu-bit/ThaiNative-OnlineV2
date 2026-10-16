# Codex task: stats core — data files, formulas, balance simulator (step 1 of the stats plan)

Read first: root `package.json`, `meadow-3d/src/sim.ts` (current hard-coded numbers), `meadow-3d/tests/*.test.mjs`, `server/src/store/types.ts`, `server/tsconfig.json`.

Goal: one shared, pure, data-driven combat-stats core that both the client and (in the next task) the server will import. **Do not change gameplay, `sim.ts`, any page, the server routes or any PNG in this task.** This task only adds the package, its data, its tests and a simulator.

## 1. Package layout

New workspace package `shared/` (`"name": "@thainative/shared"`, `"type": "module"`, TypeScript, built to `shared/dist` with `tsc`, consumed via relative import or npm workspaces — pick the simpler one that works for both Vite and the server build, and document it).

```
shared/
  data/  stats.json elements.json races.json classes.json skills.json monsters.json status.json pvp.json items.json cards.json
  src/   schema.ts  load.ts  derive.ts  damage.ts  status.ts  index.ts
  sim/   balance.ts
  tests/ *.test.ts
```

Every JSON file has `"dataVersion": 1`. `schema.ts` defines zod schemas for each file; `load.ts` validates on load and throws a readable error naming the file and path. Export `loadGameData()` (Node: reads files; browser: static `import` of the JSON) returning one typed `GameData` object.

## 2. Data (exact values)

### stats.json
- Base stats: `str agi vit int dex luk`, start 1 each, **3 points per Base Lv**, max 99, max Base Lv 99.
- Raise cost of the next point by current value: 1–10 → 2, 11–20 → 3, 21–30 → 4, 31–40 → 5, 41–50 → 6, 51–60 → 7, 61–70 → 8, 71–80 → 9, 81–90 → 10, 91–99 → 11.
- EXP to next level: `round(60 × 1.45^(lv-1))` for lv 1–20, then `round(prev × 1.18)` up to 99 (generate the table into the file).
- `statResetFree: true`.
- Caps: `maxDefReduction 0.70`, `maxCrit 0.60`, `hitChance [0.05, 0.95]`, `pvpMinHit 0.25`, `maxCastReduction 0.50`, `maxMoveSpeed 1.60`, `maxResist 0.80`, `maxElementResist 0.50`, `maxDamageReductionTotal 0.80`, `maxBonusPerCategory 1.00` (sum of +% per race / per element / per size, each category capped at +100%).

### Derived stats (`derive.ts` → `deriveStats(char, data)`) — before equipment unless noted
| stat | formula |
|---|---|
| maxHp | (100 + 20×Lv) × (1 + VIT/100) × class.hpMul + equipment flat |
| maxSp | (60 + 6×Lv) × (1 + INT/100) × class.spMul + equipment flat |
| atk (melee) | STR×2 + floor(STR/10)² + DEX/5 + LUK/3 + weapon.atk |
| atk (ranged weapon) | DEX×2 + floor(DEX/10)² + STR/5 + LUK/3 + weapon.atk |
| matk | INT×2 + floor(INT/10)² + DEX/5 + LUK/3 + weapon.matk |
| hardDef / hardMdef | equipment only |
| softDef | VIT/2 + Lv/4 |
| softMdef | INT/2 + VIT/5 |
| hit | 150 + Lv + DEX |
| flee | 100 + Lv + AGI |
| crit | 0.01 + LUK×0.003 + equipment |
| critShield (crit evasion) | LUK×0.003 |
| aspd (attacks/s) | 1 / (weapon.interval × (1 − AGI×0.004 − DEX×0.001)), min interval = weapon.interval / 2.2 |
| castMul | max(0.5, 1 − DEX×0.005) |
| moveSpeed | 1 + buffs/equipment, ≤ 1.60 |
| weight | 2000 + STR×30 (+300 race human) |
| hpRegen / 5 s | maxHp×0.01 + VIT/5 |
| spRegen / 5 s | maxSp×0.01 + INT/6 |
| statusResist[x] | per status.json formula, ≤ 0.80 |
| elementResist[e] | equipment/cards/race, ≤ 0.50 |

Equipment flat values add first, then % modifiers from cards/buffs multiply. Round display values; keep floats internally.

### classes.json
`novice_knight` (Aerin): hpMul 1.0, spMul 1.0, weapons `["sword1h"]`. Also stub `archer` (hpMul 0.8, spMul 1.1, `["bow"]`) and `mage` (0.7, 1.5, `["staff"]`) for the simulator only.

### races.json
Player races (bonus total +6 each, `element` = body element when no armour element):
| id | name | bonus | passive | element | size |
|---|---|---|---|---|---|
| human | มนุษย์ | +1 all | exp +5 %, weight +300 | neutral | medium |
| yaksha | ยักษ์ | str +3, vit +3 | stun resist +0.20 | earth | large |
| naga | นาคา | int +4, vit +2 | spRegen +30 %, no slow in shallow water | water | medium |
| kinnari | กินรี | agi +4, dex +2 | moveSpeed +0.08 | wind | medium |
| vanara | วานร | dex +3, luk +3 | drop +10 %, critShield +0.05 | neutral | medium |
| preta | เปรตพลัดถิ่น | int +3, luk +3 | dark damage +10 %, heal received −10 % | ghost | medium |

All players have monster-race `demihuman` for card targeting.

Monster races (RO set): `formless undead brute plant insect fish demon demihuman angel dragon`, with Thai names ไร้รูป อันเดด สัตว์ป่า พืช แมลง สัตว์น้ำ ปีศาจ กึ่งมนุษย์ เทพ มังกร.

Thai realms (tag only, not used in damage): `deva manussa asura preta ghost house_spirit naga water_spirit forest_spirit mythic_beast sage naraka` with Thai names เทวภูมิ มนุษยภูมิ อสุรกาย เปรตภูมิ ผีร้าย ผีบ้าน นาคภพ ผีน้ำ นางไม้/ผีป่า สัตว์ในตำนาน ครึ่งเทพ/นักสิทธิ์ นรก.

Size × weapon table (percent):
| weapon | small | medium | large |
|---|---|---|---|
| dagger, mace | 100 | 85 | 75 |
| sword1h | 90 | 100 | 90 |
| sword2h, axe | 75 | 90 | 100 |
| spear | 80 | 90 | 100 |
| bow | 100 | 100 | 85 |
| staff (magic) | 100 | 100 | 100 |
| unarmed | 100 | 90 | 75 |

### elements.json
Elements `neutral fire water wind earth holy dark ghost` (Thai: ไร้ธาตุ ไฟ น้ำ ลม ดิน สายฟ้า มืด ผี — "holy" is displayed as สายฟ้า). Attack row → defender column, percent:
```
          neu fire water wind earth holy dark ghost
neutral   100 100  100   100  100   100  100  50
fire      100  50   50   100  150   100  125  125
water     100 150   50   100   75    50  100  100
wind      100 100  150    50   75   100  100  125
earth     100  75  100   150   50   150  100  100
holy      100 100  150   100   50    50  125  100
dark      100 100  100   100  100   100   50  150
ghost     125 100  100   100  100   100  150   50
```

### status.json
| id | effect | base s | resist |
|---|---|---|---|
| stun | no move/skill | 2 | VIT×0.01 + LUK×0.003 |
| slow | move & aspd −40 % | 5 | AGI×0.01 |
| poison | −2 % maxHp/s, def −25 % | 10 | VIT×0.01 |
| burn | −3 % maxHp/s, fire resist −0.20 | 6 | fire resist |
| freeze | no move, fire taken ×1.5, water ×0.5 | 3 | VIT×0.01 + water resist |
| silence | no skills | 4 | INT×0.01 |
| blind | hit −50 % | 6 | DEX×0.01 |
| sleep | no move, wakes on hit, first hit ×1.5 | 6 | INT×0.005 + LUK×0.005 |
| curse | atk/matk −25 %, critShield 0 | 8 | LUK×0.01 |
| fear | random flee (ghost-only) | 3 | LUK×0.005 + VIT×0.005 |

Apply chance = skill chance × (1 − resist). Same status does not stack; reapply refreshes. Bosses (`boss: true`) are immune to stun/freeze/sleep/fear except scripted stun windows.

### pvp.json
Modes `duel`, `freepk`, `arena`, `gvg`:
- skill PVP multiplier by skill kind: basic 0.8, single 0.7, area 0.6, dot 0.5 (a skill may override)
- global player-vs-player damage reduction: 0.20 (gvg 0.40)
- CC diminishing within 15 s: 1st 100 %, 2nd 50 %, 3rd 25 %, 4th immune
- heal received −30 % if hit by a player in the last 5 s
- potion cooldown ×2; arena: potions disabled
- arena equalizes level to 99 with standard gear
- freepk: players below Lv 30 cannot attack or be attacked
- honor: win +10…+25 by level gap, loss −5, same victim within 10 min → 0
- karma: killing a non-retaliating player in freepk = red name 1 h per kill; red-name death drops 1 item

### skills.json
`basic` 100 % (combo 3rd hit 170 %), neutral (uses weapon element), physical, kind basic.
`whirlwind` (ฟันพายุ) 210 %, wind, physical, area, sp 20, cd 4 s, radius 2.6.
`meteor` (ดาวตก) 320 %, fire, magic, area, sp 30, cd 6 s, cast 0.65 s, radius 2.2.
`dodge`, `potion` (heal 65 + VIT×2 %) as utility. Fields: id, nameTh, percent, element (`"weapon"` allowed), type physical|magic|heal, kind, sp, cooldown, cast, range, radius, status?: {id, chance}, pvpMul?, ignoreSize?, icon index.

### monsters.json
Fields: id, nameTh, level, hp, sp, atk, matk, hardDef, softDef, hardMdef, softMdef, hit, flee, element, race, size, realm, tags[], weakness[], boss, skills[], exp, gold [min,max], drops[]. Current meadow monsters:
| id | name | Lv | hp | atk | hardDef/soft | element | race | size | realm | exp | gold |
|---|---|---|---|---|---|---|---|---|---|---|---|
| jelly_pink | วุ้นจิ๋ว | 1 | 50 | 10 | 2/1 | water | formless | small | mythic_beast | 24 | 7–14 |
| jelly_mint | วุ้นเขียว | 3 | 75 | 14 | 4/2 | earth | formless | small | mythic_beast | 36 | 10–18 |
| jelly_sky | วุ้นฟ้า | 3 | 75 | 14 | 4/2 | wind | formless | small | mythic_beast | 36 | 10–18 |
| jelly_summon | วุ้นจิ๋ว (ถูกเรียก) | 1 | 28 | 10 | 1/0 | water | formless | small | mythic_beast | 4 | 3–3 |
| king_jelly | ราชาวุ้น | 5 | 900 | 22 (phase 2: 28, element dark) | 10/4 | water | formless | large | mythic_beast | 200 | 180–180 |
Give them hit 160 + 2×Lv, flee 100 + Lv, hardMdef = hardDef, softMdef = softDef.

### items.json / cards.json
Items: `training_sword` (sword1h, atk 5, slots 1), `traveler_clothes` (armour, hardDef 3, slots 1). Cards: `card_jelly_pink` (armour, vit +1, hp +50), `card_king_jelly` (weapon, +20 % vs formless). Modifier vocabulary (used by both): `stat`, `flat`, `percent`, `raceBonus`, `elementBonus`, `sizeBonus`, `elementResist`, `raceResist`, `statusResist`, `armourElement`, `weaponElement`, `ignoreSize`.

### Player defaults (Aerin)
human, novice_knight, Lv 1, base stats after race bonus str 6 agi 4 vit 5 int 2 dex 4 luk 2 (i.e. start 1 + race +1 + 3 free points spent as str +4 agi +2 vit +3 int 0 dex +2 luk 0 — make this the default build in the data), training_sword + traveler_clothes.

## 3. Damage (`damage.ts` → `computeDamage(attacker, defender, skill, ctx, data)`)

```
base     = (skill.type==='magic' ? matk : atk) × skill.percent/100
defRed   = hardDef / (hardDef + 100 + 5×attacker.level), ≤ 0.70   (hardMdef for magic)
pre      = max(1, base × (1 − defRed) − softDef)                   (softMdef for magic)
E        = elementTable[atkElement][defElement] × (1 − defender.elementResist[atkElement])
R        = 1 + min(1, Σ raceBonus vs defender.race)  × (1 − defender.raceResist[attacker.race])
S        = magic or ignoreSize ? 1 : sizeTable[weaponType][defender.size] × (1 + min(1, Σ sizeBonus))
C        = crit ? 1.5 : 1        (crit roll: attacker.crit − defender.critShield, ≤ 0.60; magic never crits)
P        = defender is player ? skill.pvpMul ?? pvp.kind[skill.kind] × (1 − pvp.mode.reduction) : 1
V        = random 0.95–1.05 (seeded RNG in ctx)
damage   = round(pre × E × R × S × C × P × V), min 1 unless E = 0
hit roll = physical only: clamp(0.80 + (hit − flee)/100, 0.05, 0.95), PvP floor 0.25; magic and area skills always hit
```
Total damage reduction from all sources (defRed + resists + PVP) is capped so final ≥ 20 % of the pre-reduction value (`maxDamageReductionTotal`). Heal uses `matk × percent/100` with no DEF/E/S, then × (1 − healReduction).

Return `{damage, hit, crit, breakdown: {base, defRed, pre, E, R, S, C, P, V}}` so the simulator and a future combat log can explain every number.

## 4. Tests (`node --test` or vitest, whichever already runs in the repo)

- Schema: every file loads; a broken file fails with file + path in the message.
- No base stat or derived stat exceeds its cap at Lv 99 with 99 in every stat and absurd gear.
- Element table is 8×8 with values in [50, 150]; size table values in [75, 100].
- Point costs: spending all points of Lv 99 lands within the table; cost table monotonic.
- Determinism: same seed → same damage.
- **Golden test (feel must not change):** with Aerin's default build vs the current meadow, all within ±15 % of today's `sim.ts` values: basic hit vs jelly_pink ≈ 16, 3rd combo hit ≈ 28, whirlwind ≈ 39, meteor vs jelly_pink is reduced by fire→water (document the number), jelly_pink hit on Aerin ≈ 9, king slam phase 1 ≈ 20–24, Aerin maxHp ≈ 120, maxSp ≈ 80, jelly_pink dies in 3 basic hits, king_jelly takes 60–120 s of average play (simulator).
  If ±15 % is unreachable with the given formulas, tune only `monsters.json` and the default build, never the formulas, and report what you changed.

## 5. Balance simulator (`npm run sim:balance`)

`shared/sim/balance.ts`, Node, no rendering. Options `--level 1,10,30,50,99 --class novice_knight,archer,mage --monster all --runs 1000 --seed 1 --pvp`.
For each class × level (auto-build: spread points by a per-class preset in `classes.json`, gear = best item for that level or the training set) × monster: mean/p10/p90 of time-to-kill (using aspd, skill cooldowns, a simple rotation: highest-damage available skill, then basic), hits-to-die, EXP per minute including 2 s walk per kill, and win rate. `--pvp` runs every class vs every class at each level in `duel` and `gvg`.
Output a compact console table plus `shared/sim/out/balance-<date>.json` and `.md`. Flag rows red where TTK < 1 s or > 60 s for normal monsters, hits-to-die < 3 at equal level, or PVP TTK < 4 s / > 20 s.

## 6. Scripts and docs

Root scripts: `test:shared`, `sim:balance`; include `test:shared` in `npm test`. `shared/README.md`: how to edit data, how to run the simulator, the caps, and the rule "change JSON → run sim:balance → commit both".

## Verification

`npm test` (all suites), `npm run build`, `npm run sim:balance -- --runs 200`. Save the simulator markdown output to `.codex-run/balance-step1.md` and a report `.codex-run/stats-core-report.json` (files, test counts, golden-test numbers before/after, any data you tuned, any formula that looked wrong). Do not commit. Do not touch `meadow-3d/src`, `server/src`, pages or PNGs.
