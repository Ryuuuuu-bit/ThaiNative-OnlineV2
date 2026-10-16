# Codex task: remove villager, pick job at character creation

Owner decision 2026-10-16: no villager (ชาวบ้าน) stage. Players pick a tier-1 job on the character-creation screen. Design doc: "นครที่ถูกลืมเลือน — ออกแบบเมือง", section "การสร้างตัวละครและเลือกอาชีพ". Server-authoritative rules from earlier tasks still apply.

Read first: `shared/data/{jobs,skills}.json`, `shared/src/{jobs,derive}.ts`, `shared/src/game/{sim,protocol}.ts`, `server/src/realtime/index.ts`, `server/src/store/*`, `server/sql/004_jobs.sql`, `005_skills_followup.sql`, `meadow-3d/src/{skills-ui,main,keys}.ts`, `meadow-3d/src/web/*` (character create page), `meadow-3d/character.html`.

## 1. Data / shared
- `jobs.json`: remove `villager` as a playable stage (keep the id only if needed for migration mapping). Tier-1 jobs start at Job Lv 1. Re-tune the tier-1 Job EXP table so Job 1–10 is about as fast as the old villager curve was (~15 min), then the existing slower curve to 50.
- Skill points: 1 per Job Lv including Lv 1 → tier 1 max 50, tier 2 max 70 (unchanged rule, just no villager points).
- `skills.json`: remove `punch` and `fighter_basics`; drop them from `derive.ts`, tooltips, tests.
- Angel NPC no longer does the tier-1 change; keep the NPC and its dialog, text says it will guide the tier-2 change at Job 40 (logic already in data; show "ยังไม่ถึงเวลา" for now).

## 2. Character creation (web)
- Create screen: name → job cards for all 7 tier-1 jobs (painted panel style, Thai). Only นักดาบ selectable; others dimmed "เร็ว ๆ นี้". Server validates the job on create (only `available:true` jobs).
- New character spawns with the default swordsman hotbar (1 slash · 2 whirlwind · 3 dash_strike · 4 earth_break · 5 endure · 6 provoke), 1 unspent skill point, Job Lv 1.

## 3. Migration `server/sql/007_no_villager.sql` (idempotent)
- Characters still `villager`: become "needs job" — on next login the client shows the job picker before entering the world (server rejects world join until a job is chosen). Base level/EXP kept; Job Lv resets to 1 in the chosen job; skill points = 1.
- Swordsmen: refund any points in `fighter_basics` as unspent; remove punch/fighter_basics from skills and hotbars.

## 4. Tests & verify
Shared: point totals, job EXP curve (Job 10 reachable ~15 min in sim), removed skills absent. Server: create with locked job rejected; villager → must pick job before join; migration refunds. `npm test`, `npm run build`. No browser screenshots (save tokens); one headless smoke that create page and play page load without console errors. Report `.codex-run/no-villager-report.json`. Do not commit. Never touch the Railway production environment.
