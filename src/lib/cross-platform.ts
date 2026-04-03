import type { SelectionSlot } from './selection';
import { getTemplate } from './carousel-templates';

const PLATFORMS = {
  instagram: { w: 1080, h: 1080, label: 'Instagram' },
  twitter: { w: 1200, h: 675, label: 'Twitter/X Header' },
  tiktok: { w: 1080, h: 1920, label: 'TikTok/Reels' },
  facebook: { w: 1200, h: 630, label: 'Facebook' },
} as const;

export type PlatformId = keyof typeof PLATFORMS;
export const PLATFORM_LIST = Object.entries(PLATFORMS).map(([id, v]) => ({ id: id as PlatformId, ...v }));

const imageCache = new Map<string, HTMLImageElement>();

async function loadImage(src: string): Promise<HTMLImageElement | null> {
  if (imageCache.has(src)) return imageCache.get(src)!;
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => { imageCache.set(src, img); resolve(img); };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function neonText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, font: string, accent: string) {
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.shadowColor = accent.replace(')', ', 0.4)').replace('rgba', 'rgba');
  ctx.shadowBlur = 20;
  ctx.fillStyle = '#F5E6B8';
  ctx.fillText(text, x, y);
  ctx.shadowColor = 'transparent';
}

/** Generate a single-image composite of all selections for a non-Instagram platform */
export async function generatePlatformImage(
  allSlots: SelectionSlot[],
  weekDate: string,
  platform: PlatformId,
  templateId = 'mmmc_classic',
): Promise<Blob> {
  const t = getTemplate(templateId);
  const { w, h } = PLATFORMS[platform];
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  await document.fonts.load(`700 40px ${t.scriptFont}`).catch(() => {});

  // Background
  ctx.fillStyle = t.background;
  ctx.fillRect(0, 0, w, h);

  // Header
  const headerY = platform === 'tiktok' ? 60 : 20;
  neonText(ctx, 'New Music Friday', w / 2, headerY, `700 ${platform === 'tiktok' ? 52 : 36}px ${t.scriptFont}`, t.accent);

  // Date
  const dateStr = new Date(weekDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  ctx.fillStyle = t.accent;
  ctx.font = `600 ${platform === 'tiktok' ? 24 : 16}px ${t.bodyFont}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(dateStr, w / 2, headerY + (platform === 'tiktok' ? 60 : 44));

  // Load images
  const images = await Promise.all(allSlots.slice(0, 32).map(s => loadImage(s.track.cover_art_300)));

  // Layout: pack album art into available space
  const startY = headerY + (platform === 'tiktok' ? 120 : 80);
  const availH = h - startY - 20;
  const availW = w - 40;
  const count = Math.min(allSlots.length, 32);

  let cols: number, rows: number;
  if (platform === 'tiktok') {
    cols = 4; rows = Math.ceil(count / cols);
  } else if (platform === 'twitter') {
    cols = Math.min(count, 8); rows = Math.ceil(count / cols);
  } else {
    cols = Math.min(count, 8); rows = Math.ceil(count / cols);
  }

  const cellW = Math.floor(availW / cols);
  const cellH = Math.min(cellW, Math.floor(availH / rows));
  const cellSize = Math.min(cellW, cellH) - 4;
  const gridW = cols * (cellSize + 4);
  const offsetX = (w - gridW) / 2;

  for (let i = 0; i < count; i++) {
    const img = images[i];
    if (!img) continue;
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = offsetX + col * (cellSize + 4);
    const y = startY + row * (cellSize + 4);

    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 8;
    ctx.drawImage(img, x, y, cellSize, cellSize);
    ctx.shadowColor = 'transparent';
  }

  return new Promise(resolve => canvas.toBlob(b => resolve(b!), 'image/png'));
}

export async function generateAllPlatforms(
  allSlots: SelectionSlot[],
  weekDate: string,
  templateId = 'mmmc_classic',
): Promise<Map<PlatformId, Blob>> {
  const results = new Map<PlatformId, Blob>();
  for (const p of ['twitter', 'tiktok', 'facebook'] as PlatformId[]) {
    results.set(p, await generatePlatformImage(allSlots, weekDate, p, templateId));
  }
  return results;
}
