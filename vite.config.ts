import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
const page = (name: string) => new URL(`./${name}/index.html`, import.meta.url).pathname

export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? '/smartsell-management/' : '/',
  build: { sourcemap: true, rollupOptions: { input: {
    main: new URL('./index.html', import.meta.url).pathname,
    solutions: page('solutions'),
    fonctionnement: page('fonctionnement'),
    personnalisation: page('personnalisation'),
    tarifs: page('tarifs'),
    contact: page('contact'),
    parrainage: page('parrainage'),
  } } },
}))
