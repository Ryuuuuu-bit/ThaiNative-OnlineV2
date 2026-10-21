# Working on The Beginning Online

Rules for everyone pushing to this repository: people, Codex and Claude.

## `main` deploys to UAT

Every push to `main` builds and deploys UAT on Railway. Several people and agents push to `main` on the same day.

## Never rewrite `main`

- **Never `git push --force` (or `--force-with-lease`) to `main`.** On 2026-10-20 a force push rebuilt `main` from an older commit and silently dropped other people's work (player trading, map loot, potion drops, the sword-skill VFX, the canyon rock art). Some of it had to be cherry-picked back by hand.
- If a push is rejected, `git fetch` and then `git rebase origin/main` (or merge it), run the tests, and push again. A rejected push means someone else's work is on `main`: keep it.
- Do not reset `main` to an older commit, and do not squash or "clean up" commits that are already on `main`.

## Before every push

1. `git fetch origin` and put your commits on top of the latest `origin/main`.
2. `npm test` and `npm run build` pass.
3. Push with a plain `git push origin <branch>:main`.
4. After the deploy, check `https://thainative-uat.up.railway.app/build.json` shows your commit.

## Deploying

Deploy only by pushing commits to `main`. Do not run `railway up` from a working tree with uncommitted changes: UAT then runs code that is in no commit, and the next push replaces it.

---

# กติกาการ push (ภาษาไทย)

- `main` deploy ขึ้น UAT อัตโนมัติทุกครั้งที่ push
- **ห้าม `git push --force` / `--force-with-lease` ขึ้น `main` เด็ดขาด** เมื่อ 20 ต.ค. 2026 มีการ force push ที่ทำให้งานของคนอื่นหาย (ระบบแลกของ ของประจำแมพ ยาดรอป VFX สกิลดาบ งานหินหุบเขา)
- ถ้า push ไม่ผ่าน ให้ `git fetch` แล้ว rebase/merge กับ `origin/main` รันเทสต์ แล้ว push ใหม่ ห้ามบังคับทับ
- ห้าม reset `main` ย้อนกลับ และห้าม squash commit ที่อยู่บน `main` แล้ว
- ก่อน push: ต่อจาก `origin/main` ล่าสุด, `npm test` และ `npm run build` ต้องผ่าน
- deploy ด้วยการ push commit เท่านั้น ห้ามใช้ `railway up` จากโฟลเดอร์ที่มีไฟล์ยังไม่ได้ commit

---

## แนวทางแก้โค้ดให้เล็กและครบงาน (ปรับจาก Ponytail)

แนวทางนี้เสริมกฎ push และ deploy ด้านบน กฎเดิมทุกข้อยังมีผลครบถ้วน เป้าหมายคือแก้ปัญหาให้ครบด้วยโค้ดใหม่เท่าที่จำเป็น โดยยังอ่านง่ายและดูแลต่อได้

### ก่อนแก้โค้ด

- อ่านโค้ดที่เกี่ยวข้องและไล่เส้นทางข้อมูลจริงก่อนเลือกวิธีแก้ ตรวจผู้เรียกใช้ จุดเชื่อม client/server, tests, fixtures, config และ exports ที่ได้รับผลกระทบ
- ค้นหา helper, component, service และรูปแบบที่มีอยู่ก่อนสร้างใหม่ ใช้โครงสร้างและขอบเขตความรับผิดชอบเดิมของโปรเจกต์
- เมื่อแก้บั๊ก ให้ค้นหาทุกจุดเรียกใช้และแก้ที่ต้นเหตุ หากเป็น logic ร่วม ให้ตรวจและแก้ใน `shared` ตามความรับผิดชอบเดิม พร้อมตรวจผลต่อทั้ง client และ server

### เลือกวิธีที่เรียบง่ายและแก้ปัญหาได้ครบ

1. ทำสิ่งที่ผู้ใช้ขอให้ครบ โดยไม่เพิ่มฟีเจอร์ ตัวเลือก หรือความยืดหยุ่นเผื่ออนาคตที่ยังไม่มีความจำเป็น
2. ใช้โค้ดและรูปแบบเดิมของโปรเจกต์ก่อน ตามด้วยความสามารถมาตรฐานของภาษา/แพลตฟอร์ม และ dependency ที่ติดตั้งอยู่แล้ว
3. เพิ่ม dependency ใหม่เมื่อมีเหตุผลชัดเจนเท่านั้น ไม่เพิ่มเพื่อแทนโค้ดง่าย ๆ เพียงไม่กี่บรรทัด
4. เขียนโค้ดใหม่เท่าที่จำเป็น หลีกเลี่ยง abstraction, wrapper, config และการ refactor ที่ไม่เกี่ยวกับงาน เลือกโค้ดที่อ่านเข้าใจง่าย ไม่บีบให้สั้นจนอ่านยาก
5. แก้ผู้เรียกใช้ tests และส่วนเชื่อมต่อที่ได้รับผลกระทบให้ครบ รักษา validation และ error handling เมื่อย้ายหรือรวมโค้ด

### ความถูกต้องและการตรวจสอบ

- ห้ามลดการตรวจข้อมูลที่รับจาก client, network หรือแหล่งภายนอก การตรวจสิทธิ์ ความปลอดภัย และการจัดการข้อผิดพลาดที่ป้องกันข้อมูลสูญหาย
- รักษาอำนาจตัดสินผลเกมและการบันทึกข้อมูลไว้ฝั่ง server ตามโครงสร้างเดิม โดยเฉพาะ combat, HP, rewards, inventory และ trading ห้ามให้ client กลายเป็นผู้ตัดสินผลเพื่อให้โค้ดสั้นลง
- เพิ่มหรือปรับเทสต์ที่ตรวจพฤติกรรมและความเสี่ยงจริงเมื่อเปลี่ยน logic สำคัญ โดยเฉพาะ combat, inventory, trading, persistence และ security การแก้บั๊กควรมี regression test เมื่อทำได้อย่างเหมาะสม
- การแก้เอกสารหรือการเปลี่ยนแปลงเล็กน้อยที่ไม่มีผลต่อพฤติกรรมไม่ต้องสร้างเทสต์ใหม่ แต่ก่อน push ทุกครั้งยังต้องผ่าน `npm test` และ `npm run build` ตามกฎด้านบน
- หากยอมรับข้อจำกัดชั่วคราว ให้บันทึกเหตุผล ข้อจำกัด และเงื่อนไขที่ต้องกลับมาแก้ใกล้โค้ดนั้น โดยไม่ใช้ข้อจำกัดเป็นเหตุให้ละงานที่ผู้ใช้ขอ
- เมื่อรายงานผล ให้บอกสิ่งที่เปลี่ยน การตรวจสอบที่ทำจริง และสิ่งที่ยังไม่ได้ตรวจหรือความเสี่ยงที่เกี่ยวข้อง ห้ามอ้างว่าเทสต์ผ่านหากไม่ได้รัน

ที่มาแนวคิด: [Ponytail](https://github.com/DietrichGebert/ponytail) — ปรับให้เหมาะกับ The Beginning Online

## Game-development skills

Selected skills from [awesome-gamedev-agent-skills](https://github.com/gamedev-skills/awesome-gamedev-agent-skills) live in `.agents/skills/`; see [the local catalog](.agents/skills/README.md) for the pinned source and license. Read only the relevant `SKILL.md` and any references needed for the task before making changes.

Choose the renderer from the code being edited: this project uses both Three.js and PixiJS. Check `package.json`, the lockfile and existing imports for the actual API version; upstream examples target different releases. Do not upgrade dependencies or switch engines just to follow an example.

| Task | Local skill under `.agents/skills/` |
| --- | --- |
| Three.js scene, render loop, resize, resource disposal | `threejs-scene-setup` |
| Three.js materials, lighting, shadows, transparency | `threejs-materials-lighting` |
| PixiJS scene graph, sprites, textures, events | `pixijs-rendering` |
| Cohesive painted art, sprite families, asset validation | `create-game-assets` |
| FPS, draw calls, memory, asset budgets | `performance-optimization` |
| Combat feedback, hit effects, animation feel | `game-feel` |
| HUD, menus, mobile layout, accessibility | `game-ui-ux` |
| Camera follow, framing, shake | `camera-systems` |
| Enemy decisions, targeting, pathfinding | `game-ai` |
| Persistence, save compatibility, migrations | `save-systems` |
| NPC dialogue and branching conditions | `dialogue-systems` |
| Stats, leveling, inventory, equipment, quests, combat | `rpg` |

These skills supplement the existing architecture and all rules above. Reuse the current `shared` schemas/game data, server stores, renderer helpers, asset manifests and packing tools. Generic RPG formulas and save-slot examples are illustrative, not replacements for our balance data or persistence. Combat, HP, rewards, inventory, trading, quest mutations and persistence remain server-authoritative; client feedback and camera effects must not pause or decide server simulation. Profile performance changes before and after, and verify visual changes in the actual game. Keep Thai text and the established painted art direction.

Use available specialist image/sprite/Blender skills for their tools; the imported asset guide does not authorize paid generation, publishing or deployment. Cross-references to skills outside this selected subset are optional reading, not instructions to install other engines. The generic upstream router is omitted because this table covers our two-renderer project.
