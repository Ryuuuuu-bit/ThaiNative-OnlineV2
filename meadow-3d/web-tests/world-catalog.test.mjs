import test from 'node:test';import assert from 'node:assert/strict';import {existsSync,readFileSync} from 'node:fs';
import {REGIONS,WORLD_MAX_LEVEL,regionsForLevel,regionDrops,regionMonsters,cityRoute,dropOwners} from '../src/web/world-catalog.ts';

test('public hunting guide covers every level and keeps parallel biome choices',()=>{
 assert.equal(WORLD_MAX_LEVEL,100);assert.equal(REGIONS.length,18);
 for(let level=1;level<=100;level++)assert.ok(regionsForLevel(level,level).length,'missing level '+level);
 assert.deepEqual(regionsForLevel(50,59).map(r=>r.id).sort(),['frost']);
 assert.deepEqual(regionsForLevel(70,79).map(r=>r.id).sort(),['dragon','volcano']);
 assert.deepEqual(regionsForLevel(100,100).map(r=>r.id),['confluence']);
 assert.deepEqual(regionsForLevel(101,110),[]);
});

test('guide destinations have a real route, hunting encounters and actual owned rewards',()=>{
 for(const region of REGIONS){const route=cityRoute(region.id);assert.ok(route.length>=2,region.id);assert.equal(route[0],'นครที่ถูกลืมเลือน');
  const monsters=regionMonsters(region.id);assert.ok(monsters.some(m=>m.boss),region.id);
  assert.ok(regionDrops(region.id).some(i=>i.id.startsWith('card_')),region.id);
 }
 assert.deepEqual(cityRoute('missing'),[]);assert.deepEqual(regionDrops('missing'),[]);
 assert.ok(regionDrops('confluence').some(i=>i.id==='unique_confluence_relic'));
 assert.ok(!regionDrops('meadow').some(i=>i.id==='unique_confluence_relic'));
 assert.ok(dropOwners('card_jelly_pink').some(m=>m.id==='jelly_pink'));
 assert.ok(!dropOwners('card_jelly_pink').some(m=>m.id==='jelly_summon'));
 assert.deepEqual(dropOwners('missing'),[]);
});

test('public pages expose working world and collection destinations and retire dead policy links',()=>{
 const home=readFileSync('meadow-3d/index.html','utf8'),config=readFileSync('meadow-3d/vite.config.ts','utf8');
 for(const page of ['world.html','items.html']){assert.ok(existsSync('meadow-3d/'+page));assert.ok(config.includes('./'+page));assert.ok(home.includes('/'+page));}
 assert.doesNotMatch(home,/href="#(?:terms|privacy)"|data-placeholder/);
 const news=JSON.parse(readFileSync('meadow-3d/public/changelog.json'));assert.ok(news.some(entry=>/Lv\.100/.test(entry.description)));assert.ok(news[0].date>=news[1].date);
});
