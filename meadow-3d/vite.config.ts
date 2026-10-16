import {defineConfig} from 'vite';
import {fileURLToPath} from 'node:url';
const buildId=process.env.VITE_BUILD_ID||process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0,8)||new Date().toISOString().slice(0,10);
export default defineConfig(({command})=>({define:{'import.meta.env.VITE_BUILD_ID':JSON.stringify(command==='build'?buildId:'dev')},server:{proxy:{'/api':{target:'http://127.0.0.1:8787',ws:true},'/healthz':'http://127.0.0.1:8787'},watch:{ignored:['**/art/**','**/public/assets/**']}},build:{target:'es2022',rollupOptions:{input:{
  portal:fileURLToPath(new URL('./index.html',import.meta.url)),
  login:fileURLToPath(new URL('./login.html',import.meta.url)),
  characters:fileURLToPath(new URL('./characters.html',import.meta.url)),
  play:fileURLToPath(new URL('./play.html',import.meta.url)),
  character:fileURLToPath(new URL('./character.html',import.meta.url)),
}}}}));
