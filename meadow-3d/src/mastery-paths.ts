type Point={x:number;y:number};
type Skill={id:string;requires:{id:string}[]};

// Follow prerequisite links only; nearby stars and other branches are not prerequisites.
export function masteryAncestors(skills:Skill[],id:string) {
 const found=new Set<string>();
 const visit=(id:string)=>{for(const r of skills.find(s=>s.id===id)?.requires??[])if(!found.has(r.id)){found.add(r.id);visit(r.id);}};
 visit(id);return found;
}

// Keep each connection inside its radial sector instead of drawing a chord across it.
export function masteryCurve(a:Point,b:Point) {
 const angle=(p:Point)=>Math.atan2(p.y-1800,p.x-1800),radius=(p:Point)=>Math.hypot(p.x-1800,p.y-1800);
 const ra=radius(a),rb=radius(b),point=(r:number,t:number)=>({x:1800+Math.cos(t)*r,y:1800+Math.sin(t)*r});
 const c=point(ra+(rb-ra)*.4,angle(a)),d=point(rb-(rb-ra)*.25,angle(b));
 return {path:`M${a.x} ${a.y}C${c.x} ${c.y} ${d.x} ${d.y} ${b.x} ${b.y}`,
  label:{x:(a.x+3*c.x+3*d.x+b.x)/8,y:(a.y+3*c.y+3*d.y+b.y)/8}};
}
