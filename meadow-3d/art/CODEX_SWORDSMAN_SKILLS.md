# Codex task: jobs (ชาวบ้าน → นักดาบ), skill points, skill window, 10-slot hotbar, swordsman skills

Design source: Claude Doc "ThaiNative Stats Design", tab "อาชีพและสกิล" (summarised below — this file is authoritative for numbers). Read first: `shared/data/{skills,classes,stats,monsters}.json`, `shared/src/{derive,schema,allocation}.ts`, `shared/src/game/{sim,protocol}.ts`, `server/src/realtime/index.ts`, `server/src/store/*`, `server/sql/*`, `meadow-3d/src/{main,keys,stats-window,assets}.ts`, `meadow-3d/play.html`, `meadow-3d/src/style.css`, `meadow-3d/public/texture-manifest.json`. Server-authoritative rules from earlier tasks still apply (client sends intents; server validates, applies, persists).

## 1. Job system (shared data + server)
- New `shared/data/jobs.json`: `villager` (ชาวบ้าน, tier 0, max Job Lv 10) → tier-1 jobs (only `swordsman` นักดาบ implemented now; list the other six as data stubs with `available:false`: archer นักธนู, mage นักเวท, healer หมอยา, shaman หมอผี, boxer นักมวย, rogue นักย่องเบา) → tier-2 stubs (guardian ผู้พิทักษ์ / berserker นักดาบคลั่ง for swordsman; others named in the doc table, all `available:false`).
- Job Lv + Job EXP per character (add `job_id`, `job_level`, `job_exp`, `skill_points`, `skills jsonb`, `hotbar jsonb` via `server/sql/004_jobs.sql`, idempotent). Job EXP from kills: add `jobExp` to each monster (≈ 0.75 × base EXP, round). Job EXP table in `jobs.json` (villager fast: 10 levels ≈ the first ~15 min of play; tier 1 to 50 slower).
- 1 skill point per Job Lv gained (villager 9 total, tier 1 up to 49). Skills learned stay when changing job.
- Job change: villager at Job Lv 10 talks to **Angel (ทูตสวรรค์)** NPC → choose a tier-1 job (unavailable ones shown locked "เร็ว ๆ นี้"). Tier-2 change at Job Lv ≥ 40 (data/logic only now; NPC quest later).
- Migration: existing characters (class `novice_knight`) become `swordsman` Job Lv 1 with 9 + (their base level − 1) unspent skill points capped at 49, and default skills: ฟันพายุ Lv1, ตอกพสุธา Lv1 so their current Q/E still work. New characters start as villager.

## 2. Skills data (`shared/data/skills.json`)
Add `jobId`, `maxLevel`, per-level values (arrays or base+perLevel), `requires` (prereq skill + level), `passive` flag. Element `weapon` = uses the equipped weapon's element (today: neutral).

Villager: โจมตีพื้นฐาน (existing basic combo), พุ่งหลบ (existing dodge), **ปฐมพยาบาล** active Lv3: heal 20/35/50 + VIT×2, SP 5, cd 10 s; **ทักษะเอาตัวรอด** passive Lv6: Max HP +2%/Lv, carry weight +20/Lv.

Swordsman (all element `weapon`, physical):
| key | id | name | type | max | values | SP | cd | requires |
|---|---|---|---|---|---|---|---|---|
| 1 | slash | ฟันเฉือน | single melee | 10 | 180% → 360% | 8 → 12 | 1.2 s | — |
| Q | whirlwind | ฟันพายุ | AoE r2.6 | 10 | 2 hits × 70% → 2 × 135% | 15 → 22 | 4 s | — |
| 2 | dash_strike | พุ่งทะยาน | dash 6 m through enemies | 10 | 150% → 300% + stun 0.6 s | 15 | 8 s | slash 3 |
| E | earth_break | ตอกพสุธา | leap slam AoE r2.2, cast 0.4 s | 10 | 250% → 420% + knock-up 0.8 s | 25 → 32 | 10 s | whirlwind 5 |
| 3 | provoke | คำรามท้าศึก | AoE r6 | 5 | taunt monsters 5 s, enemy DEF −5% → −15% | 10 | 12 s | — |
| 4 | endure | ใจเหล็ก | self buff 8 s | 5 | no flinch/knockback, DEF +6% → +18% | 15 | 25 s | iron_body 3 |
| — | sword_mastery | เชี่ยวชาญดาบ | passive | 10 | ATK +4/Lv with sword | — | — | — |
| — | iron_body | กายเหล็ก | passive | 10 | Max HP +2%/Lv, HP regen +5%/Lv | — | — | — |
| — | sword_rhythm | จังหวะดาบ | passive | 5 | combo hit 3: +5%/Lv damage and −0.1 s/Lv on all other running cooldowns | — | — | sword_mastery 5 |

PVP (data flag, applied when target is a player): stun/knock-up ×0.6 duration; provoke on players = −20% move speed 3 s instead of taunt; endure prevents knockback/flinch but not stun.
- Move **meteor (ดาวตก)** to `jobId: mage` (keep its data; swordsman no longer has it). Keep `fire_bolt` under mage.
- Rebalance check: run `npm run sim:balance` full; Lv1 default swordsman with whirlwind 1 + earth_break 1 should stay close to today's TTK vs jellies and the King target band (Lv1 King 70–90 s). Report numbers; adjust skill % only if far off.

## 3. Sim/server
- Shared sim executes all new skill kinds: single melee, dash-through (path hit, stop at walls/edges, server-validated distance), leap slam with cast time, taunt (monster target override + DEF debuff status), self buff status, passives folded into `deriveStats` / combat (sword_rhythm on combo step 3). Status effects carry durations in the snapshot so the client can draw icons.
- New WS intents: `{t:"skillUp", id, seq}`, `{t:"hotbar", slots:[...10]}`, `{t:"jobChange", job}` (only at the Angel NPC within range); `act` accepts any learned skill id. Validate: points, max level, prereqs, job, SP, cooldown, range. Persist immediately. Level/job-up events include new skill points.

## 4. Client
- **Hotbar 10 slots**: main bar Q, E, 1, 2, 3, 4 (combat), extra bar 5 6 7 8 9 0 (buffs, items, rarely used skills). Drag skills from the skill window (and later items) into any slot. Every key remappable in a small settings panel (store in hotbar/keys on the server, not only localStorage). Update `keys.ts` (+ tests: no conflicts), guide dialog, README, touch layout (6 main buttons + a "more" toggle for slots 5–0).
- **Skill window (K)**: painted panel like the stat window; tree by job tier, icons, level x/max, `+` with confirm/cancel preview, prereq lines, locked skills dimmed with the reason, tooltip with per-level numbers (current → next). Skill points counter; pulse on the K button when points are unspent.
- **Angel (ทูตสวรรค์) NPC** near the camp: original painted sprite (built-in imagegen, same ink-and-gouache style, a gentle winged figure, no religious symbols of real faiths); dialog with Thai text, job cards (นักดาบ selectable; others locked "เร็ว ๆ นี้").
- **VFX/animation**: reuse existing hero motions where they fit (attack → slash, spin → whirlwind, dodge → dash_strike with afterimage trail, cast → provoke/endure) and add painted VFX for each skill (slash arc, dash streak, ground crack + debris for earth_break, roar shockwave ring, endure golden aura). If a new hero motion is clearly needed (leap slam), generate it with built-in imagegen in the Aerin style through the existing texture pipeline (KTX2/WebP, deferred if not needed at first screen). Status icons above monsters (taunted, stunned, DEF down) and on the HUD (endure).
- Skill icons: painted 64×64, one atlas, same style as existing icons.

## 5. Tests & verify
Shared: per-level numbers, prereqs, point budget, job change rules, migration mapping, PVP duration scaling, sword_rhythm cooldown reduction. Server: skillUp over budget/prereq/max rejected; jobChange only villager Lv10 near Angel; hotbar persist across reconnect; act with unlearned skill rejected. Browser: new villager → reach Job Lv 10 (use a UAT/dev-only fast job-EXP flag, off in production) → Angel → นักดาบ → learn skills → use each from hotbar → remap a key → reload → all persisted; old character migrated with Q/E working; mobile 390×844. Screenshots `.codex-run/skills-window.jpg`, `skills-hotbar.jpg`, `skills-angel.jpg`, `skills-vfx-*.jpg`, `skills-mobile.jpg`; report `.codex-run/swordsman-skills-report.json` (files, sim numbers before/after, migration result, anything off). `npm test`, `npm run build`. Do not commit. Never touch the Railway production environment.
