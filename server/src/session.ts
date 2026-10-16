import{createHash,randomBytes,randomUUID}from'node:crypto';import{parse,serialize}from'cookie';import type{Request,Response,NextFunction}from'express';import type{Account,Session,Store}from'./store/types.js';import{AppError}from'./errors.js';
export interface SessionOptions {secret?:string;production?:boolean}
declare global {namespace Express {interface Request {auth?:{account:Account;session:Session;hash:string}}}}
export const hashToken=(token:string,secret='')=>createHash('sha256').update(secret).update('\0').update(token).digest('hex');
export const randomToken=()=>randomBytes(32).toString('base64url');
export function sessions(store:Store,options:SessionOptions){
 const flags=(req:Request)=>({httpOnly:true,sameSite:'lax' as const,secure:options.production||req.secure,path:'/',maxAge:30*86400});
 return{
  async read(req:Request,_res:Response,next:NextFunction){try{const token=parse(req.headers.cookie||'').tn_session;if(token&&/^[\w-]{43}$/.test(token)){const hash=hashToken(token,options.secret),session=await store.session(hash);if(session){const account=await store.account(session.accountId);if(account)req.auth={account,session,hash};}}next();}catch(e){next(e);}},
  async issue(req:Request,res:Response,accountId:string,selectedCharacterId?:string){const token=randomToken();await store.createSession({id:randomUUID(),accountId,tokenHash:hashToken(token,options.secret),createdAt:new Date().toISOString(),expiresAt:new Date(Date.now()+30*86400000).toISOString(),userAgent:(req.get('user-agent')||'').slice(0,512),selectedCharacterId});res.setHeader('Set-Cookie',serialize('tn_session',token,flags(req)));},
  clear(req:Request,res:Response){res.setHeader('Set-Cookie',serialize('tn_session','',{...flags(req),maxAge:0}));}
 };
}
export function requireSession(req:Request,_res:Response,next:NextFunction){if(!req.auth)return next(new AppError(401,'LOGIN_REQUIRED','กรุณาเข้าสู่ระบบก่อน'));next();}
