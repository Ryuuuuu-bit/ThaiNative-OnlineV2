# Codex task (DRAFT, owner review): inventory + equipment + drops + NPC shop + ledger

Economy & Trading doc step 1. Builds the foundation every later trade/market feature stands on, so correctness (no dupes, no lost gold) matters more than features.

Read first: `shared/data/items.json`, `cards.json`, `monsters.json` (`drops: []`), `stats.json` (`defaultBuild.equipment`), `shared/src/derive.ts` (equipment modifiers), `shared/src/game/sim.ts` (loot events, current gold/potion drops), `server/src/realtime/index.ts`, `server/src/store/*`, `server/sql/00*.sql`, `meadow-3d/src/main.ts` (loot VFX, HUD, hotbar potion), `src/stats-window.ts` (panel style), `src/keys.ts`.

## 1. Data (`shared/data/`)
- `items.json` grows to a first real set (Thai names, original): **weapons** (sword1h ×3 tiers, dagger, staff, bow stub), **armour** (body ×3), **shield**, **garment**, **footgear**, **accessory** ×2 (ring/amulet), **consumables** (ยาแดงเล็ก/กลาง, ยาฟ้า SP, ยาวิ่งเร็ว), **materials** (เมือกวุ้น, เมล็ดพันธุ์ใบ, ผลึกราชาวุ้น), **refine stones** (หินตีบวกอาวุธ/เกราะ — data only, refining is a later task). Each: id, nameTh, type, slot, level req, weight, npcPrice, rarity (`common` ขาว · `fine` เขียว · `rare` ฟ้า · `epic` ม่วง · `legendary` ทอง), stackable/maxStack, modifiers, card slots, `bind: none|equip|account`, icon id.
- `monsters.json` `drops`: `[{item, rate, min, max}]` — วุ้นจิ๋ว common materials + potions + very rare card (0.02 %); King: crystal, chance at a rare/epic weapon, King card (0.5 %). Gold drop stays.
- `economy.json` (new): NPC sell = 50 % of npcPrice, buy price list for the camp merchant, carry limits, inventory size (100 slots, weight limit from STR via existing derive), drop multipliers (incl. AUTO > 2 h ×0.7 on rare drops as in the doc), loot-ownership seconds.
- Icons: painted 64×64 item icons, same ink-and-gouache style (built-in imagegen, one atlas `public/assets/items/items-v1.ktx2/webp` + JSON frames). Prompts in `art/painted-items/PROMPTS.md`.

## 2. Server storage (`server/sql/004_items.sql`, idempotent)
- `tn2_items`: one row per unique item (equipment, cards): id (uuid), template, owner character, location (`bag|equip|storage|mail|escrow|market|auction`), slot index / equip slot, refine, cards jsonb, bound, source (drop/npc/admin…), created_at. Stackables: `tn2_item_stacks` (character, template, qty, location) with unique constraint.
- `tn2_ledger`: append-only; time, kind (`drop|pickup|npc_buy|npc_sell|use|equip|unequip|discard|admin`), character, item id/template, qty, gold delta, room/tick, request id. No UPDATE/DELETE grants used by the app.
- Every change in **one Postgres transaction** with `SELECT … FOR UPDATE` on affected rows + **idempotency key per client request** (`req` uuid) stored in `tn2_requests` (dedupe 24 h).
- Memory store mirrors the same semantics for tests/local.
- Nightly (and on-demand admin) **integrity check**: gold per character = ledger sum; no duplicated unique item ids; stacks ≥ 0. Logs `ECONOMY_ALERT` line to Railway on mismatch.

## 3. Gameplay (server-authoritative, in the shared sim)
- Kill → server rolls drops with the room's seeded RNG → ground drops (already rendered) carry item template + qty. **Loot owner** = top damage for 10 s, then anyone in the room (shared rooms later).
- Pick up: walk over / click / AUTO picks up own drops (AUTO pickup toggle in settings). Full bag or overweight → drop stays, Thai notice.
- Equip/unequip/use/discard/sell/buy as WS intents `{t:"inv", op, req, …}` validated (ownership, level, class weapon types, weight, slot). Equipment changes go through `deriveStats` → live stats update immediately, broadcast to the stat window.
- Overweight ≥ 50 % → no HP/SP regen; ≥ 90 % → no attack (RO rule, from stats.json).
- Potions: hotbar R uses the best owned red potion (from inventory now, not a counter). Migrate existing potion counts to stacks.
- Existing characters: starter sword + clothes become real equipped items (migration).

## 4. UI (painted panel style, Thai labels)
- **I** = กระเป๋า: grid with rarity-coloured frames, stack counts, weight bar, gold; tabs ทั้งหมด / อุปกรณ์ / ของใช้ / วัตถุดิบ; drag or double-click to equip/use; right-click/long-press menu (ใส่, ใช้, ทิ้ง ×n with confirm, ดูข้อมูล).
- **Equipment** panel inside the C window (or tab in I): paper-doll slots with the painted Aerin portrait.
- Tooltip: name in rarity colour, type, req level, ATK/DEF/modifiers, compare vs equipped (green/red diff), weight, sell price, bind status.
- Loot: drop name floats in rarity colour; rare+ gets a soft glow pillar and a chime; pickup toast stack bottom-right.
- **Camp merchant NPC** (painted sprite near the camp fire, original design): buy potions/basic gear, sell tab with multi-select + total, "ขายของขาวทั้งหมด" quick button with confirm.
- Mobile: bag as bottom sheet, tap = tooltip, tap again = action buttons.
- Keys: add `I` (inventory) to `keys.ts`; update the guide dialog, hotbar hint and README.

## 5. Tests
- Shared: drop tables roll within rates over 100k seeded rolls; equip modifiers change derived stats exactly; weight rules.
- Server: 100 concurrent identical sell requests (same `req`) → one sale; 100 different concurrent buys with just enough gold for 3 → exactly 3; pick-up race between two sockets → one owner; equip item not owned / wrong class / too high level → rejected; disconnect mid-transaction → no partial state; integrity check passes after a 10k random-op fuzz; ledger sum = gold.
- Browser: kill jellies until a material + potion drop, pick up, sell at merchant, buy a sword, equip, see ATK and damage rise, reload → everything persisted; mobile 390×844.

## 6. Verify & report
`npm test`, `npm run build`. Screenshots `.codex-run/inv-bag.jpg`, `inv-tooltip.jpg`, `inv-merchant.jpg`, `inv-loot.jpg`, `inv-mobile.jpg`; report `.codex-run/inventory-report.json` (files, schema, drop tables, gold faucet per hour at Lv 1/5/10 with AUTO vs NPC sinks per hour, fuzz results, anything off). Do not commit. Production Railway env must not be touched.
