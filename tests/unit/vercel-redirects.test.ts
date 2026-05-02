import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

interface VercelRedirect {
  source: string;
  destination: string;
  statusCode?: number;
  has?: Array<{
    type: string;
    value: string;
  }>;
}

const config = JSON.parse(
  readFileSync(resolve(process.cwd(), 'vercel.json'), 'utf8')
) as { redirects: VercelRedirect[] };

describe('Vercel redirect routing', () => {
  it('redirects the MMMC umbrella host to the canonical NMF domain before SPA rewrites', () => {
    const [umbrellaRedirect] = config.redirects;

    expect(umbrellaRedirect).toEqual({
      source: '/:path*',
      has: [{ type: 'host', value: 'maxmeetsmusiccity.com' }],
      destination: 'https://newmusicfriday.app/:path*',
      statusCode: 308,
    });
  });
});
