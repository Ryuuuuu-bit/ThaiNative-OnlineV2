import {assetJSON} from './asset-request';
export class CanvasAssets{
 images=new Map<string,HTMLImageElement>();private pending=new Map<string,Promise<HTMLImageElement>>();
 constructor(private manifest:Record<string,{webp:string}>){ }
 url(key:string){return this.manifest[key]?.webp??key;}
 async image(key:string){
  const existing=this.pending.get(key);if(existing)return existing;
  const request=(async()=>{const image=new Image();image.src=this.url(key);await image.decode();this.images.set(key,image);window.tnBoot?.activity?.();return image;})();
  this.pending.set(key,request);try{return await request;}catch(e){this.pending.delete(key);throw e;}
 }
 get(key:string){return this.images.get(key);}
 release(key:string){this.images.delete(key);this.pending.delete(key);}
 json<T>(url:string){return assetJSON<T>(url);}
 snapshot(){return{renderer:'Canvas2D',loaded:this.images.size,pending:this.pending.size-this.images.size};}
}
