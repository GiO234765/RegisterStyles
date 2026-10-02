import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    tailwindcss(),
    react({ compiler: true }),
  ],
  // The workspace root also installs react, so without dedupe a pre-bundled
  // dep can bind to a second copy of React and every hook call throws
  // "Invalid hook call", leaving a blank page.
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
})