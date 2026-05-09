import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('recharts'))        return 'vendor-charts'
          if (id.includes('@dnd-kit'))        return 'vendor-dnd'
          if (id.includes('supabase'))        return 'vendor-supabase'
          if (id.includes('papaparse'))       return 'vendor-csv'
          if (id.includes('react-hook-form') || id.includes('@hookform') || id.includes('zod'))
            return 'vendor-forms'
          if (id.includes('react-router'))    return 'vendor-react'
          if (id.includes('react-dom') || id.includes('react/'))
            return 'vendor-react'
          if (id.includes('@tanstack') || id.includes('zustand'))
            return 'vendor-query'
          if (id.includes('lucide'))          return 'vendor-ui'
        },
      },
    },
  },
})
