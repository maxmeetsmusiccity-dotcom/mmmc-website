import type { VercelRequest } from '@vercel/node';
import { createHash, randomUUID } from 'node:crypto';

const DEFAULT_ND_API_BASE = 'https://nd-api.nd-api.workers.dev';
const AUDIT_TIMEOUT_MS = 1800;

type AuditOutcome = 'success' | 'failure' | 'unauthorized' | 'skipped';

type AuditEvent = {
  action: string;
  outcome: AuditOutcome;
  status?: number;
  actor?: string | null;
  metadata?: Record<string, unknown>;
};

function auditEndpoint(): string {
  const explicit = process.env.Q12_AUDIT_ENDPOINT_URL || process.env.WORKERS_AUDIT_ENDPOINT_URL;
  if (explicit) return explicit.trim();
  const base = (process.env.ND_API_BASE_URL || DEFAULT_ND_API_BASE).replace(/\/$/, '');
  return `${base}/api/admin/audit-log`;
}

function auditToken(): string {
  return (
    process.env.Q12_AUDIT_TOKEN ||
    process.env.ADMIN_TOKEN ||
    process.env.ND_ADMIN_TOKEN ||
    ''
  ).trim();
}

function hashActor(actor: string | null | undefined): string | null {
  if (!actor) return null;
  return createHash('sha256').update(actor).digest('hex').slice(0, 24);
}

function requestPath(req: VercelRequest): string {
  try {
    return new URL(req.url || '/', 'https://nmf.local').pathname;
  } catch {
    return req.url || 'unknown';
  }
}

function clientIp(req: VercelRequest): string | null {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0]?.trim() || null;
  if (Array.isArray(forwarded)) return forwarded[0]?.split(',')[0]?.trim() || null;
  return req.socket?.remoteAddress || null;
}

export async function recordAuditEvent(req: VercelRequest, event: AuditEvent): Promise<void> {
  const token = auditToken();
  if (!token) {
    console.warn(`[audit] skipped ${event.action}: Q12 audit token not configured`);
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AUDIT_TIMEOUT_MS);
  const now = new Date().toISOString();
  const payload = {
    id: randomUUID(),
    product: 'nmf-curator-studio',
    source: 'vercel-function',
    action: event.action,
    outcome: event.outcome,
    status: event.status ?? null,
    route: requestPath(req),
    method: req.method,
    actor_hash: hashActor(event.actor),
    client_ip_hash: hashActor(clientIp(req)),
    user_agent: req.headers['user-agent'] || null,
    metadata: event.metadata || {},
    occurred_at: now,
  };

  try {
    const resp = await fetch(auditEndpoint(), {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!resp.ok) {
      console.warn(`[audit] ${event.action} sink returned ${resp.status}`);
    }
  } catch (e) {
    console.warn(`[audit] ${event.action} sink failed:`, e instanceof Error ? e.message : String(e));
  } finally {
    clearTimeout(timeout);
  }
}
