"""Walk the actual client using pointer input on a local memory-only server fixture."""
import json,math,heapq,time,sys
from pathlib import Path
from playwright.sync_api import sync_playwright
OUT=Path(__file__).resolve().parents[2]/'.codex-run'
grids={k:{tuple(p) for p in v} for k,v in json.loads((OUT/'walk-grid.json').read_text()).items()}
city_only='--city-only' in sys.argv
forest_only='--forest-only' in sys.argv
events=json.loads((OUT/'world-art-walk.json').read_text()).get('events',[]) if forest_only and (OUT/'world-art-walk.json').exists() else []
geometry=json.loads((OUT/'walk-layout.json').read_text())
def clear(map_id,a,b):
 l=geometry['layouts'][map_id];n=max(1,int(math.dist(a,b)*8))
 for i in range(n+1):
  x=a[0]+(b[0]-a[0])*i/n;z=a[1]+(b[1]-a[1])*i/n
  if map_id=='city_plaza':
   if any(abs(x-v['x'])<v['w']/2+.8 and abs(z-v['z'])<v['d']/2+.8 for v in geometry['buildings']):return False
   f=geometry['fountain']
   if math.hypot(x-f['x'],z-f['z'])<f['r']+.8 or (abs(x)<2.8 and abs(z)<2.8):return False
  else:
   if any(math.hypot(x-o['x'],z-o['z'])<o['r']+.8 for o in l['obstacles']):return False
   for w in l['water']:
    if 'bridgeZ' in w and abs(z-w['bridgeZ'])<w.get('bridgeHalf',1)-.35:continue
    if ((x-w['x'])/(w['rx']+.3))**2+((z-w['z'])/(w['rz']+.3))**2<1:return False
 return True
def route(map_id,start,goal):
 cells=grids[map_id];a=tuple(round(v) for v in start);b=tuple(round(v) for v in goal)
 if b not in cells:b=min(cells,key=lambda p:math.dist(p,goal))
 if a not in cells or not clear(map_id,a,a):a=min((p for p in cells if clear(map_id,p,p)),key=lambda p:math.dist(p,start))
 queue=[(0,0,a)];cost={a:0};parents={a:None}
 while queue:
  _,g,p=heapq.heappop(queue)
  if p==b:break
  for dx,dz in [(1,0),(-1,0),(0,1),(0,-1),(1,1),(1,-1),(-1,1),(-1,-1)]:
   n=(p[0]+dx,p[1]+dz)
   if n not in cells or not clear(map_id,p,n) or (dx and dz and ((p[0]+dx,p[1]) not in cells or (p[0],p[1]+dz) not in cells)):continue
   ng=g+math.hypot(dx,dz)
   if ng<cost.get(n,1e9):cost[n]=ng;parents[n]=p;heapq.heappush(queue,(ng+math.dist(n,b),ng,n))
 if b not in parents:raise RuntimeError('Unreachable '+str(goal))
 path=[];p=b
 while p is not None:path.append(p);p=parents[p]
 path.reverse();path.append(goal);return path
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='C:/Program Files/Google/Chrome/Application/chrome.exe',headless=True,args=['--enable-webgl','--ignore-gpu-blocklist'])
 page=browser.new_page(viewport={'width':1600,'height':1000},bypass_csp=True)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 api='http://127.0.0.1:8787/api'
 assert page.request.post(api+'/guest',data={}).ok
 response=page.request.post(api+'/characters',data={'name':'WorldArt'+str(int(time.time()))[-4:],'jobId':'swordsman'});assert response.ok,response.text()
 char=response.json()['character'];assert page.request.post(api+'/characters/'+char['id']+'/select',data={}).ok
 page.goto('http://127.0.0.1:8787/play.html');page.wait_for_function('window.__FIELDS__ && __FIELDS__.snapshot().network.connected',timeout=60000);page.locator('#play').click(timeout=60000);page.wait_for_timeout(1000);page.add_style_tag(content='#ui{pointer-events:none!important}')
 def snap():return page.evaluate('__FIELDS__.snapshot()')
 def goto(map_id,goal,name,next_map=None):
  state=snap();assert state['mapId']==map_id,(name,state['mapId'])
  path=route(map_id,(state['p']['x'],state['p']['z']),goal)
  # Every waypoint uses real pointer movement; no position writes or teleport hooks.
  i=1
  while i<len(path):
   j=i
   while j+1<len(path) and math.dist(path[i],path[j+1])<3:
    ax,az=path[i-1];bx,bz=path[j+1];length=math.dist((ax,az),(bx,bz));samples=max(1,int(length*5))
    if not clear(map_id,(ax,az),(bx,bz)):break
    j+=1
   target=path[j];end=time.monotonic()+20
   while time.monotonic()<end:
    state=snap()
    if state['mapId']!=map_id:break
    if state['p']['dead']:raise RuntimeError('Died during '+name)
    dx=target[0]-state['p']['x'];dz=target[1]-state['p']['z']
    if math.hypot(dx,dz)<.55:break
    rx=13*dx-9*dz;up=-9*dx-13*dz;threshold=max(abs(rx),abs(up))*.414
    keys=[]
    if rx>threshold:keys.append('d')
    if rx<-threshold:keys.append('a')
    if up>threshold:keys.append('w')
    if up<-threshold:keys.append('s')
    for k in keys:page.keyboard.down(k)
    page.wait_for_timeout(90)
    for k in keys:page.keyboard.up(k)
   else:raise RuntimeError('Movement stalled '+name+' '+str(target)+' '+str(state['p']))
   if state['mapId']!=map_id:break
   i=j+1
  if next_map:page.wait_for_function('(m)=>__FIELDS__.snapshot().mapId===m&&!__FIELDS__.snapshot().transitioning',arg=next_map,timeout=15000)
  state=snap();events.append({'stop':name,'map':state['mapId'],'x':state['p']['x'],'z':state['p']['z'],'hp':state['p']['hp'],'network':state['network']['connected']});print(name,state['mapId'],flush=True)
  page.wait_for_timeout(300);page.screenshot(path=str(OUT/('walk-'+name+'.jpg')),type='jpeg',quality=88)
 try:
  if city_only:
   for goal,name in [((-8,9),'city-plaza-ring'),((0,-25),'city-storage'),((-26.5,0),'city-forge'),((26.5,0),'city-market'),((-28,-31),'city-houses'),((-14,10),'city-healer'),((5,40),'city-captain')]:goto('city_plaza',goal,name)
   goto('city_plaza',(0,46.5),'city-south-gate','meadow')
   goto('meadow',(0,-40.5),'city-south-return','city_plaza')
   goto('city_plaza',(46.5,0),'city-east-gate','forest')
  else:
   if not forest_only:
    goto('city_plaza',(0,46.5),'city-south-gate','meadow')
    for goal,name in [((-14,-31),'meadow-camp-north'),((22,-24),'meadow-camp-east'),((20,-3),'meadow-lake-west'),((36,-3),'meadow-lake-east'),((0,28),'meadow-arena'),((-12,26),'meadow-camp-west'),((-25,16),'meadow-west-pond'),((24,30),'meadow-south-pond')]:goto('meadow',goal,name)
    goto('meadow',(0,-40.5),'meadow-return','city_plaza')
    goto('city_plaza',(44,0),'city-east-approach');goto('city_plaza',(46.5,0),'city-east-gate','forest')
   for goal,name in [((-50,7),'forest-camp-west'),((-24,29),'forest-west-pool'),((4,18),'forest-camp-east'),((14,-24),'forest-pool'),((50,-30),'forest-east-trail'),((40,18),'forest-warden'),((50,28),'forest-east-pool')]:goto('forest',goal,name)

 except Exception as e:
  errors.append(str(e));page.screenshot(path=str(OUT/'walk-failure.jpg'),type='jpeg',quality=90);raise
 finally:
  (OUT/('city-polish-walk.json' if city_only else 'world-art-walk.json')).write_text(json.dumps({'scope':('actual city client, local MemoryStore level99 survival fixture; keyboard movement, NPC approaches, south gate/return and east gate transfers' if city_only else 'actual client, two local MemoryStore level99 survival scenarios (city-to-meadow-to-forest, forest tour); normal keyboard movement, no position writes'),'events':events,'errors':errors},indent=2));browser.close()


