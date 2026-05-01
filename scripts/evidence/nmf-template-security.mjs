import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const vercelConfig = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8'))
const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const viteConfig = readFileSync(join(root, 'vite.config.ts'), 'utf8')

const failures = []

const findHeaderSet = (source) => vercelConfig.headers.find((entry) => entry.source === source)?.headers ?? []
const getHeader = (headers, key) =>
  headers.find((header) => header.key.toLowerCase() === key.toLowerCase())?.value

const globalHeaders = findHeaderSet('/(.*)')
const apiHeaders = findHeaderSet('/api/(.*)')
const csp = getHeader(globalHeaders, 'Content-Security-Policy') ?? ''

const requireHeader = (headers, key, expected) => {
  const value = getHeader(headers, key)
  if (!value) {
    failures.push(`missing ${key}`)
    return
  }
  if (expected && value !== expected) {
    failures.push(`${key} expected ${expected} but found ${value}`)
  }
}

if (packageJson.name !== 'nmf-curator-studio') {
  failures.push(`package name expected nmf-curator-studio but found ${packageJson.name}`)
}

if (!/sourcemap:\s*false/.test(viteConfig)) {
  failures.push('vite build sourcemap must be explicitly false')
}

for (const directive of [
  "default-src 'self'",
  "script-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
]) {
  if (!csp.includes(directive)) {
    failures.push(`CSP missing directive: ${directive}`)
  }
}

if (csp.includes("'unsafe-eval'")) {
  failures.push('CSP must not allow unsafe-eval')
}

if (/https:\/\/\*(?!\.supabase\.co)/.test(csp)) {
  failures.push('CSP must not allow broad https wildcard hosts')
}

requireHeader(globalHeaders, 'Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')
requireHeader(globalHeaders, 'X-Content-Type-Options', 'nosniff')
requireHeader(globalHeaders, 'X-Frame-Options', 'DENY')
requireHeader(globalHeaders, 'Referrer-Policy', 'strict-origin-when-cross-origin')
requireHeader(globalHeaders, 'Permissions-Policy', 'camera=(), microphone=(), geolocation=()')

requireHeader(apiHeaders, 'Access-Control-Allow-Origin', 'https://newmusicfriday.app')
requireHeader(apiHeaders, 'Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
requireHeader(apiHeaders, 'Vary', 'Origin')

if (failures.length) {
  console.error('[nmf-template-security] FAIL')
  for (const failure of failures) {
    console.error(`- ${failure}`)
  }
  process.exit(1)
}

console.log('[nmf-template-security] PASS')
console.log(`package=${packageJson.name}`)
console.log(`global_headers=${globalHeaders.length}`)
console.log(`api_headers=${apiHeaders.length}`)
console.log('csp=enforced')
console.log('sourcemap=false')
