import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      // Capacitor plugins are loaded at runtime via dynamic import() only when
      // running on a native iOS/Android platform. Mark them external so the web
      // build (Vercel) doesn't try to resolve them — they will never be needed
      // on the web. The dynamic import() in App.jsx will fail silently on web,
      // which is the intended behavior.
      external: [
        '@capacitor/status-bar',
        '@capacitor/haptics',
        '@capacitor/splash-screen',
      ],
    },
  },
})
