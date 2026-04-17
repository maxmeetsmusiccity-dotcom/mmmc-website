// Minimal Slack-webhook alert helper.
// If SLACK_WEBHOOK_URL is unset, calls log-only (handler still returns 503 to
// its own caller, so the cron-invoked HTTP status surfaces the failure even
// without Slack).

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL || '';

export async function alertSlack(title: string, details: Record<string, unknown>): Promise<void> {
  const payload = {
    text: `*${title}*`,
    blocks: [
      { type: 'header', text: { type: 'plain_text', text: title } },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '```' + JSON.stringify(details, null, 2).slice(0, 2800) + '```',
        },
      },
    ],
  };
  if (!SLACK_WEBHOOK_URL) {
    console.error(`[ALERT] ${title}`, JSON.stringify(details));
    return;
  }
  try {
    const resp = await fetch(SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) {
      console.error(`[ALERT] Slack webhook returned ${resp.status}:`, await resp.text().catch(() => ''));
    }
  } catch (e) {
    console.error('[ALERT] Slack webhook threw:', e);
  }
}
