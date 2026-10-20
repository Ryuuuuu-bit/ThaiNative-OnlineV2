# Working on ThaiNative Online V2

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
