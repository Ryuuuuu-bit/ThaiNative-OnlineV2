// Camera from the approved constellation prototype, with small-viewport fit support.
export function masteryCamera(size = 3600) {
 const state = {x:0,y:0,scale:1};
 const clamp = (n:number,a:number,b:number) => Math.max(a,Math.min(b,n));
 function bound(w:number,h:number) {
  for (const [key,len] of [['x',w],['y',h]] as const)
   state[key] = size*state.scale < len ? (len-size*state.scale)/2 : clamp(state[key],60-size*state.scale,len-60);
 }
 function focus(x:number,y:number,w:number,h:number,scale=1) {
  state.scale=clamp(scale,.04,1.8);
  state.x=w/2-x*state.scale;state.y=h/2-y*state.scale;bound(w,h);
 }
 function fit(w:number,h:number) { focus(size/2,size/2,w,h,Math.min(w,h)/size*.94); }
 function zoom(factor:number,x:number,y:number,w:number,h:number) {
  const wx=(x-state.x)/state.scale,wy=(y-state.y)/state.scale;
  state.scale=clamp(state.scale*factor,.04,1.8);
  state.x=x-wx*state.scale;state.y=y-wy*state.scale;bound(w,h);
 }
 function pan(dx:number,dy:number,w:number,h:number) {state.x+=dx;state.y+=dy;bound(w,h);}
 return {state,focus,fit,zoom,pan,bound};
}
