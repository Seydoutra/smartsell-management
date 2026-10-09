import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
const fixture=fileURLToPath(new URL('./smart-social-preview-services.ts',import.meta.url))
export default defineConfig({plugins:[react()],resolve:{alias:[
  {find:'./services/smartSocialRepository',replacement:fixture},
  {find:'./services/repository',replacement:fixture},
]},optimizeDeps:{entries:['tests/smart-social-preview.html']},server:{host:'127.0.0.1',port:4188,strictPort:true}})
