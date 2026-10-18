// Shared by canvas drawing, mouse targeting and world-space UI anchors.
export const project2D=(x:number,z:number,h=0)=>({x:.83205*x-.5547*z,y:.39223*x+.58835*z-h});
export function unproject2D(x:number,y:number){const determinant=.83205*.58835+.5547*.39223;return{x:(.58835*x+.5547*y)/determinant,z:(-.39223*x+.83205*y)/determinant};}
