import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    include: ['tests/unit/**/*.test.ts'],
  },
} as any) // eslint-disable-line @typescript-eslint/no-explicit-any
