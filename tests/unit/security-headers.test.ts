import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

type Header = {
  key: string
  value: string
}

type HeaderSet = {
  source: string
  headers: Header[]
}

const root = process.cwd()
const vercelConfig = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8')) as { headers: HeaderSet[] }
const viteConfig = readFileSync(join(root, 'vite.config.ts'), 'utf8')

const headersFor = (source: string) =>
  vercelConfig.headers.find((entry) => entry.source === source)?.headers ?? []

const header = (headers: Header[], key: string) =>
  headers.find((entry) => entry.key.toLowerCase() === key.toLowerCase())?.value

describe('NMF template security posture', () => {
  it('enforces the browser security header baseline', () => {
    const headers = headersFor('/(.*)')
    const csp = header(headers, 'Content-Security-Policy') ?? ''

    expect(csp).toContain("default-src 'self'")
    expect(csp).toContain("script-src 'self'")
    expect(csp).toContain("object-src 'none'")
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).not.toContain("'unsafe-eval'")
    expect(header(headers, 'Strict-Transport-Security')).toBe('max-age=31536000; includeSubDomains; preload')
    expect(header(headers, 'X-Content-Type-Options')).toBe('nosniff')
    expect(header(headers, 'X-Frame-Options')).toBe('DENY')
  })

  it('binds API CORS to the production NMF domain', () => {
    const headers = headersFor('/api/(.*)')

    expect(header(headers, 'Access-Control-Allow-Origin')).toBe('https://newmusicfriday.app')
    expect(header(headers, 'Access-Control-Allow-Methods')).toBe('GET, POST, OPTIONS')
    expect(header(headers, 'Vary')).toBe('Origin')
  })

  it('keeps Vite production sourcemaps disabled', () => {
    expect(viteConfig).toMatch(/sourcemap:\s*false/)
  })
})
