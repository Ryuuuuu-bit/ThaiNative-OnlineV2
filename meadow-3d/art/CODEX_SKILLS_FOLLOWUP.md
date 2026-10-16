# Codex follow-up (run AFTER CODEX_SWORDSMAN_SKILLS.md is finished): owner changes 19:34–19:37

Apply on top of the swordsman-skills work in the same tree. Do not commit.

## 1. Hotbar keys
- Main bar **1 2 3 4 5** (combat), extra bar **6 7 8 9 0**. Q and E are no longer default skill keys (free, remappable). Space/LMB attack, Shift dodge, R potion, F auto unchanged.
- Default swordsman layout: 1 slash · 2 whirlwind · 3 dash_strike · 4 earth_break · 5 endure · 6 provoke; 7–0 empty (items later). Villager default: 1 punch.
- Migrated/existing characters get this layout (overwrite only hotbars that still equal the old default). Update `keys.ts` + tests, labels, guide dialog, README, touch layout (5 main buttons + "more" for 6–0).

## 2. Villager skills
- Remove ปฐมพยาบาล (first_aid) and ทักษะเอาตัวรอด (survival passive) entirely.
- Villager has one skill: **ต่อย (punch)**, active single target, Lv 1–10: 120% → 300% (linear), SP 3, cooldown 1 s, melee.
- After the job change, punch leaves the hotbar/skill list as an active and becomes the passive **พื้นฐานนักสู้ (fighter_basics)** at the same level: ATK +1 and Max HP +1% per level (Lv10 = ATK +10, HP +10%). Folded into `deriveStats`.

## 3. Skill points
- A skill point is granted at Job Lv 1 too (one per Job Lv including the first): villager 10, tier 1 max 50, tier 2 max 70.
- Migration: existing swordsmen get points recomputed under this rule (keep already-learned skills; add the difference as unspent; cap at 50) and fighter_basics Lv 0 (they never were villagers).

## 4. Verify
Tests for punch numbers, punch→fighter_basics conversion on job change, point totals, new default hotbar, migration. `npm test`, `npm run build`. Append results to `.codex-run/swordsman-skills-report.json` under `followup`.
