import {defineConfig} from 'vite';
import {fileURLToPath} from 'node:url';
export default defineConfig({server:{watch:{ignored:['**/art/**','**/public/assets/**']}},build:{rollupOptions:{input:{
  game:fileURLToPath(new URL('./index.html',import.meta.url)),
  character:fileURLToPath(new URL('./character.html',import.meta.url)),
}}}});
