import * as T from 'three';

/** World-space stone courses. Atlas samples provide brushwork, never a repeated tile border. */
export function cityPaving(atlas:T.Texture,size:number){
 const material=new T.MeshStandardMaterial({map:atlas,roughness:1,color:'#c1c0ae'});
 material.onBeforeCompile=shader=>{
  shader.uniforms.cityPaint={value:atlas};
  shader.vertexShader='varying vec2 cityGround;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ncityGround=position.xz;');
  shader.fragmentShader=`uniform sampler2D cityPaint;varying vec2 cityGround;
   float cityHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
   float cityNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(cityHash(i),cityHash(i+vec2(1.,0.)),f.x),mix(cityHash(i+vec2(0.,1.)),cityHash(i+1.),f.x),f.y);}
   vec3 cityBrush(vec2 p,vec2 seed){vec2 q=fract(p*.63+seed);q=mix(q,1.-q,step(.5,cityHash(seed)));return texture2D(cityPaint,vec2((1.22+q.x*.55)/4.,(2.21+q.y*.56)/3.)).rgb;}
   vec3 cityStones(vec2 p,vec2 metres){float row=floor(p.y/metres.y);vec2 q=p/metres+vec2(mod(row,2.)*.5,0.);vec2 id=floor(q),f=fract(q);float h=cityHash(id);float edge=min(min(f.x,1.-f.x)*metres.x,min(f.y,1.-f.y)*metres.y);float joint=1.-smoothstep(.006,.018,edge);vec3 stone=mix(vec3(.50,.53,.49),vec3(.72,.69,.60),h);return mix(stone,vec3(.31,.35,.31),joint*.45);}
  `+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
   vec2 p=cityGround;float n=cityNoise(p*.055),wear=cityNoise(p*.17+17.);
   vec3 a=cityBrush(p,vec2(.13,.61)),b=cityBrush(vec2(-p.y,p.x),vec2(.72,.31)),c=cityBrush(p*.91,vec2(.41,.89));
   vec3 brush=mix(mix(a,b,smoothstep(.2,.8,n)),c,smoothstep(.53,.83,cityNoise(p*.07+8.))*.5);
   float luminance=dot(brush,vec3(.299,.587,.114));vec3 pigment=mix(vec3(luminance),brush,.26);
   vec3 plaza=cityStones(p,vec2(.29,.24));vec3 roadStone=cityStones(p.yx,vec2(.48,.34))*vec3(.81,.88,.91);
   float road=1.-smoothstep(2.92,3.,min(abs(p.x),abs(p.y)));
   float lane=1.-smoothstep(.8,1.,min(abs(abs(p.x)-32.),abs(abs(p.y)-34.)));
   float radial=length(p),ring=(1.-smoothstep(.06,.14,abs(mod(radial+1.6,3.2)-1.6)))*(1.-smoothstep(15.,18.,radial));
   vec3 stone=mix(plaza,plaza*.86,lane*.55);stone=mix(stone,roadStone,road);stone=mix(stone,vec3(.72,.67,.51),ring*.65);
   // Large irregular dirt/moss washes; wheel marks flank the middle of the roads.
   float dirt=smoothstep(.52,.78,wear)*(.3+.7*cityNoise(p*.08+3.));
   float moss=smoothstep(.57,.77,cityNoise(p*.12+42.))*(1.-road)*.17;
   float tracks=exp(-pow((abs(p.x)-.85)*7.,2.))+exp(-pow((abs(p.y)-.85)*7.,2.));
   stone=mix(stone,vec3(.44,.39,.29),dirt*.22);stone=mix(stone,vec3(.30,.40,.28),moss);stone*=1.-tracks*.055*road*(.4+.6*wear);
   float puddle=0.;for(int i=0;i<5;i++){float k=float(i);vec2 centre=vec2(-22.+k*10.,sin(k*2.3)*23.);vec2 d=(p-centre)/vec2(2.4,1.2);puddle=max(puddle,(1.-smoothstep(.6,1.,dot(d,d)+cityNoise(p*2.)*.18))*.14);}
   float cornerMoss=smoothstep(35.,47.,min(abs(p.x),abs(p.y)))*(.4+.6*wear);
   stone=mix(stone,vec3(.26,.37,.18),cornerMoss*.65);
   float pool=0.;for(int i=0;i<2;i++){float side=float(i)*9.-4.5;pool+=exp(-dot(p-vec2(side,47.9),p-vec2(side,47.9))/2.);pool+=exp(-dot(p-vec2(47.9,side),p-vec2(47.9,side))/2.);}
   stone+=vec3(.34,.17,.035)*pool;
   stone=mix(stone,vec3(.41,.51,.51),puddle);float exterior=step(${(size/2).toFixed(1)},max(abs(p.x),abs(p.y)));stone=mix(stone,mix(vec3(.30,.40,.24),vec3(.48,.46,.29),wear),exterior*(1.-road));diffuseColor.rgb*=stone*(.87+pigment*.28)*(1.+(n-.5)*.12);
  `);
 };
 material.customProgramCacheKey=()=>`city-world-courses-v1-${size}`;
 return material;
}

/** UVs are cloth metres, not atlas coordinates: every stripe remains 0.8m wide. */
export function cityCanvas(){
 const material=new T.MeshStandardMaterial({roughness:1,side:T.DoubleSide,color:'#fff5dd'});
 material.onBeforeCompile=shader=>{
  shader.vertexShader='varying vec2 cityCloth;\n'+shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\ncityCloth=uv;');
  shader.fragmentShader='varying vec2 cityCloth;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   float stripe=smoothstep(.48,.52,fract(cityCloth.x/.8));
   vec3 canvas=mix(vec3(.78,.66,.43),vec3(.20,.38,.34),stripe);
   float weave=.97+.03*sin(cityCloth.x*260.)*sin(cityCloth.y*230.);
   float seam=1.-smoothstep(.012,.035,min(fract(cityCloth.x/.8),1.-fract(cityCloth.x/.8)));
   diffuseColor.rgb*=canvas*weave*(1.-seam*.12);
  `);
 };
 material.customProgramCacheKey=()=> 'city-canvas-metres-v1';
 return material;
}

export function canopyGeometry(w:number,d:number){
 const g=new T.PlaneGeometry(w,d,16,6);g.rotateX(-Math.PI/2);const p=g.getAttribute('position'),uv=g.getAttribute('uv');
 for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i);p.setY(i,.3*(1-(x/(w/2))**2)+.06*Math.cos(z/d*Math.PI));uv.setXY(i,x+w/2,z+d/2);}
 g.computeVertexNormals();return g;
}
