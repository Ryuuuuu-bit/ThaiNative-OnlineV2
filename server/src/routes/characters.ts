import{Router}from'express';import type{Store}from'../store/types.js';import{requireSession}from'../session.js';import{missing}from'../errors.js';import{characterName}from'../store/progress.js';
export function characterRoutes(store:Store){const r=Router();r.use(requireSession);
 r.param('id',(_req,_res,next,id)=>{if(!/^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i.test(id))return next(missing());next();});
 r.get('/',async(req,res)=>res.json({characters:await store.characters(req.auth!.account.id)}));
 r.post('/',async(req,res)=>{const{name,nameKey}=characterName(req.body?.name);res.status(201).json({character:await store.createCharacter(req.auth!.account.id,name,nameKey)});});
 r.get('/:id',async(req,res)=>{const c=await store.character(req.auth!.account.id,String(req.params.id));if(!c)throw missing();res.json({character:c});});
 r.delete('/:id',async(req,res)=>{await store.deleteCharacter(req.auth!.account.id,String(req.params.id));res.json({ok:true});});
 r.post('/:id/select',async(req,res)=>{const c=await store.character(req.auth!.account.id,String(req.params.id));if(!c)throw missing();await store.select(req.auth!.session.id,c.id);res.json({character:c});});
 r.post('/:id/progress',async(req,res)=>res.json({character:await store.progress(req.auth!.account.id,String(req.params.id),req.body)}));
 return r;
}
