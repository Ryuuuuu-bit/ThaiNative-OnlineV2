import{Router,type Request,type Response}from'express';import type{Store}from'../store/types.js';import{publicAccount}from'../store/types.js';import{sessions,hashToken,randomToken,requireSession,type SessionOptions}from'../session.js';import{AppError}from'../errors.js';import type{GoogleVerifier}from'../google.js';
import{Backoff,LOGIN_FAILED,hashPassword,lockedError,newPassword,passwordInput,username,verifyPassword}from'../password.js';
export function authRoutes(store:Store,session:ReturnType<typeof sessions>,options:SessionOptions&{googleClientId?:string;build:string;verifyGoogle:GoogleVerifier}){
 const r=Router();
 // Failed-password backoff: per username (whether or not it exists) and per IP. In-process; one Railway instance.
 const byName=new Backoff(5,30000,15*60000),byIp=new Backoff(20,60000,15*60000);
 const locked=(res:Response,...waits:number[])=>{const ms=Math.max(...waits);if(ms>0){res.setHeader('Retry-After',String(Math.ceil(ms/1000)));throw lockedError(ms);}};
 /** Rotates: the caller's current session (if any) is revoked and a fresh token is issued. */
 const signIn=async(req:Request,res:Response,accountId:string,selected?:string)=>{if(req.auth)await store.revoke(req.auth.hash);await session.issue(req,res,accountId,selected);};
 r.get('/config',(_req,res)=>res.json({googleClientId:options.googleClientId||null,build:options.build}));
 r.post('/guest',async(req,res)=>{if(req.auth)return res.json({account:publicAccount(req.auth.account)});const guestKey=randomToken(),a=await store.createGuest(hashToken('guest:'+guestKey,options.secret));await session.issue(req,res,a.id);res.status(201).json({account:publicAccount(a),guestKey});});
 r.post('/guest/resume',async(req,res)=>{const key=req.body?.guestKey;if(typeof key!=='string'||! /^[\w-]{43}$/.test(key))throw new AppError(401,'GUEST_KEY_INVALID','ไม่พบข้อมูล Guest ที่กู้คืนได้');const a=await store.resumeGuest(hashToken('guest:'+key,options.secret));if(!a)throw new AppError(401,'GUEST_KEY_INVALID','ไม่พบข้อมูล Guest ที่กู้คืนได้');await signIn(req,res,a.id);res.json({account:publicAccount(a)});});
 r.post('/google',async(req,res)=>{const credential=req.body?.credential;if(typeof credential!=='string'||credential.length>12000)throw new AppError(400,'GOOGLE_INVALID','ข้อมูล Google ไม่ถูกต้อง');const identity=await options.verifyGoogle(credential),guest=req.auth?.account.kind==='guest'?req.auth.account.id:undefined,selected=req.auth?.session.selectedCharacterId;const a=await store.google(identity,guest);await signIn(req,res,a.id,guest?selected:undefined);res.json({account:publicAccount(a)});});
 r.post('/register',async(req,res)=>{
  const body=req.body||{},{username:name,usernameKey}=username(body.username),password=newPassword(body.password,usernameKey);
  if(body.confirmPassword!==password)throw new AppError(400,'PASSWORD_MISMATCH','รหัสผ่านทั้งสองช่องไม่ตรงกัน');
  if(req.auth&&req.auth.account.kind!=='guest')throw new AppError(409,'ALREADY_SIGNED_IN','คุณเข้าสู่ระบบอยู่แล้ว กรุณาออกจากระบบก่อนสมัครบัญชีใหม่');
  // Default: a signed-in guest becomes this account (characters and UID kept), like guest→Google.
  const guest=req.auth&&body.linkGuest!==false?req.auth.account.id:undefined,selected=guest?req.auth!.session.selectedCharacterId:undefined;
  const a=await store.registerPassword({username:name,usernameKey,passwordHash:await hashPassword(password)},guest);
  await signIn(req,res,a.id,selected);res.status(201).json({account:publicAccount(a),linked:!!guest});
 });
 r.post('/login',async(req,res)=>{
  const ip='ip:'+(req.ip||'unknown'),rawName=typeof req.body?.username==='string'?req.body.username.slice(0,64):'',key='u:'+rawName.toLowerCase();
  locked(res,byIp.retryAfter(ip),byName.retryAfter(key));
  const password=passwordInput(req.body?.password),valid=/^[A-Za-z0-9_]{3,20}$/.test(rawName);
  const a=valid?await store.passwordAccount(rawName.toLowerCase()):undefined;
  // verifyPassword runs the KDF even for an unknown name, so timing and the message are the same either way.
  const ok=await verifyPassword(password??'',a?.passwordHash)&&!!password&&!!a;
  if(!ok){byIp.fail(ip);byName.fail(key);throw LOGIN_FAILED();}
  byName.reset(key);await store.loggedIn(a!.id);await signIn(req,res,a!.id);res.json({account:publicAccount(a!)});
 });
 r.post('/password',requireSession,async(req,res)=>{
  const auth=req.auth!,key='pw:'+auth.account.id;if(auth.account.kind!=='password')throw new AppError(409,'NO_PASSWORD','บัญชีนี้ไม่ได้ใช้รหัสผ่าน');locked(res,byName.retryAfter(key));
  if(!await verifyPassword(passwordInput(req.body?.currentPassword)??'',auth.account.passwordHash)){byName.fail(key);throw new AppError(401,'PASSWORD_WRONG','รหัสผ่านปัจจุบันไม่ถูกต้อง');}
  const password=newPassword(req.body?.newPassword,auth.account.usernameKey);if(req.body?.confirmPassword!==password)throw new AppError(400,'PASSWORD_MISMATCH','รหัสผ่านทั้งสองช่องไม่ตรงกัน');
  byName.reset(key);await store.changePassword(auth.account.id,await hashPassword(password));
  // changePassword signed out every device; this one gets a fresh session.
  await session.issue(req,res,auth.account.id,auth.session.selectedCharacterId);res.json({ok:true});
 });
 r.get('/me',requireSession,async(req,res)=>{const a=req.auth!,selected=a.session.selectedCharacterId;res.json({account:publicAccount(a.account),selectedCharacterId:selected&&await store.character(a.account.id,selected)?selected:null});});
 r.post('/logout',async(req,res)=>{if(req.auth)await store.revoke(req.auth.hash);session.clear(req,res);res.json({ok:true});});
 return r;
}
