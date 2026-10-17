export function gridPath(start:{x:number;z:number},goal:{x:number;z:number},walk:(x:number,z:number)=>boolean){
 const key=(x:number,z:number)=>`${x},${z}`,sx=Math.round(start.x),sz=Math.round(start.z),gx=Math.round(goal.x),gz=Math.round(goal.z);
 const queue=[{x:sx,z:sz}],seen=new Map<string,string|null>([[key(sx,sz),null]]);let end='';
 for(let i=0;i<queue.length&&i<15000;i++){const p=queue[i];if(Math.hypot(p.x-goal.x,p.z-goal.z)<1){end=key(p.x,p.z);break;}
 for(const [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1]]){const x=p.x+dx,z=p.z+dz,k=key(x,z);if(Math.abs(x)>64||Math.abs(z)>64||seen.has(k)||!walk(x,z)||!walk(p.x+dx*.5,p.z+dz*.5))continue;seen.set(k,key(p.x,p.z));queue.push({x,z});}}
 if(!end)return [];const path=[];for(let k:string|null=end;k; k=seen.get(k)??null){const [x,z]=k.split(',').map(Number);path.unshift({x,z});}path.shift();if(walk(goal.x,goal.z))path.push(goal);return path;
}
