import test from 'node:test';
import assert from 'node:assert/strict';

// The module builds its offscreen layers on construction; a canvas stub is enough for event bookkeeping.
global.document??={createElement:()=>({getContext:()=>({})})};
const {SkillVfx2D,vfxKind,PALETTE_OF,PALS}=await import('../src/skill-vfx-2d.ts');

const SWORD_SKILLS=['slash','whirlwind','dash_strike','earth_break','provoke','endure','shield_bash','bulwark','quake_slam','rally_roar','frenzy_slash','blood_rage','blade_cyclone','leap_strike'];

test('every sword-line skill is owned by the new VFX, other jobs fall through to the old path',()=>{
 for(const id of SWORD_SKILLS)assert.notEqual(vfxKind({type:'skill',skillId:id,x:0,z:0}),null,id);
 assert.equal(vfxKind({type:'slash',x:0,z:0}),'basic');
 assert.equal(vfxKind({type:'hit',x:0,z:0}),'basicHit');
 assert.equal(vfxKind({type:'dashTrail',x:0,z:0,fromX:0,fromZ:0,toX:3,toZ:0}),'dash');
 assert.equal(vfxKind({type:'dashTrail',skillId:'leap_strike',x:0,z:0}),'leapTrail');
 assert.equal(vfxKind({type:'skillImpact',skillId:'earth_break',x:0,z:0}),'earth');
 assert.equal(vfxKind({type:'skillImpact',skillId:'quake_slam',x:0,z:0}),'quake');
 assert.equal(vfxKind({type:'skillImpact',skillId:'leap_strike',x:0,z:0}),'leap');
 for(const e of [{type:'skill',skillId:'meteor',x:0,z:0},{type:'skillImpact',skillId:'meteor',x:0,z:0},{type:'hit',skillId:'fire_bolt',x:0,z:0},{type:'hit',reflect:true,x:0,z:0},{type:'heal',x:0,z:0},{type:'slash',x:NaN,z:0}])
  assert.equal(vfxKind(e),null,JSON.stringify(e));
});

test('each effect kind has a palette from the approved skill colours',()=>{
 for(const kind of Object.values(PALETTE_OF))assert.ok(PALS[kind],kind);
 assert.equal(PALETTE_OF.cyclone,'crimson');assert.equal(PALETTE_OF.quake,'amber');assert.equal(PALETTE_OF.provoke,'sand');
});

test('dash and leap sprites travel the trail instead of teleporting, then hand back to the real position',()=>{
 const vfx=new SkillVfx2D(),frame={ctx:null,width:1,height:1,dpr:1,scale:30,screen:()=>({x:0,y:0}),locate:()=>undefined,highQuality:false};
 vfx.paint=()=>{};
 vfx.event({type:'dashTrail',x:0,z:0,fromX:0,fromZ:0,toX:6,toZ:0,playerId:'p'});
 const start=vfx.heroPose('p',6,0);assert.equal(start.x,0);assert.equal(start.lift,0);
 vfx.pre(frame,.1);const mid=vfx.heroPose('p',6,0);assert.ok(mid.x>2&&mid.x<6);
 assert.equal(vfx.heroPose('p',20,20),null,'a hero that moved elsewhere is drawn where it really is');
 vfx.event({type:'dashTrail',skillId:'leap_strike',x:0,z:0,fromX:0,fromZ:0,toX:4,toZ:0,duration:.4,playerId:'q'});
 // The visual clock caps each frame at 0.1 s, so step in 0.1 s frames.
 vfx.pre(frame,.1);vfx.pre(frame,.1);const air=vfx.heroPose('q',4,0);assert.ok(Math.abs(air.x-2)<1e-9);assert.ok(air.lift>2);
 assert.equal(air.tint,'#ff2030');assert.ok(air.ghosts.length>0&&air.ghosts.every(g=>g.x<air.x),'afterimages trail behind');
 vfx.pre(frame,.1);vfx.pre(frame,.1);const landed=vfx.heroPose('q',4,0);assert.equal(landed.x,4);assert.equal(landed.lift,0);
 vfx.pre(frame,.1);vfx.pre(frame,.1);vfx.pre(frame,.1);assert.equal(vfx.heroPose('q',4,0),null,'afterimages fold away shortly after landing');
});

test('effects are bounded, follow their caster facing and expire on the visual clock',()=>{
 const vfx=new SkillVfx2D();
 for(let i=0;i<300;i++)vfx.event({type:'slash',x:i,z:0,dx:0,dz:2,combo:i,playerId:'p'});
 assert.equal(vfx.effects.length,vfx.max);assert.equal(vfx.effects.at(-1).dz,1);
 vfx.event({type:'skill',skillId:'leap_strike',x:0,z:0,dx:0,dz:-1,playerId:'p'});
 assert.equal(vfx.effects.length,vfx.max,'a skill with no cast visual spawns nothing');
 vfx.event({type:'skillImpact',skillId:'leap_strike',x:4,z:4,playerId:'p'});
 assert.equal(vfx.effects.at(-1).kind,'leap');assert.equal(vfx.effects.at(-1).dz,-1,'impact faces the remembered cast direction');
 const frame={ctx:null,width:1,height:1,dpr:1,scale:30,screen:()=>({x:0,y:0}),locate:()=>undefined,highQuality:false};
 const paint=vfx.paint;vfx.paint=()=>{};
 for(let i=0;i<40;i++)vfx.pre(frame,.1);
 vfx.paint=paint;assert.equal(vfx.effects.length,0);
});
