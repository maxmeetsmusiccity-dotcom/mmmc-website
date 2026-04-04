import type { SelectionSlot } from './selection';
import type { CarouselTemplate } from './carousel-templates';
import { getTemplate } from './carousel-templates';

const S = 1080;

const ASSETS = {
  logo: '/mmmc-logo.png',
  vinyl: '/assets/vinyl-bg.png',
  sparkle: '/assets/sparkle.png',
  noteTL: '/assets/note-tl.png',
  noteTR: '/assets/note-tr.png',
  noteBL: '/assets/note-bl.png',
  noteBR: '/assets/note-br.png',
};

const imageCache = new Map<string, HTMLImageElement>();

async function loadImage(src: string): Promise<HTMLImageElement | null> {
  if (imageCache.has(src)) return imageCache.get(src)!;
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => { imageCache.set(src, img); resolve(img); };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function loadAllAssets(t: CarouselTemplate): Promise<void> {
  const loads = Object.values(ASSETS).map(loadImage);
  // Check for template-specific assets
  if (t.assets?.background) loads.push(loadImage(t.assets.background));
  if (t.assets?.vinyl) loads.push(loadImage(t.assets.vinyl));
  await Promise.all([
    ...loads,
    document.fonts.load(`700 56px ${t.scriptFont}`).catch(() => {}),
    document.fonts.load(`600 26px ${t.bodyFont}`).catch(() => {}),
  ]);
}

function neonText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, font: string, t: CarouselTemplate) {
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  // Pass 1: ultra-wide atmospheric glow
  ctx.shadowColor = t.neon.outerGlow;
  ctx.shadowBlur = t.neon.outerBlur * 1.5;
  ctx.fillStyle = `${t.accentGlow}${t.neon.outerAlpha * 0.4})`;
  ctx.fillText(text, x, y);
  // Pass 2: wide outer glow
  ctx.shadowColor = t.neon.outerGlow;
  ctx.shadowBlur = t.neon.outerBlur;
  ctx.fillStyle = `${t.accentGlow}${t.neon.outerAlpha})`;
  ctx.fillText(text, x, y);
  // Pass 3: medium glow
  ctx.shadowColor = t.neon.midGlow;
  ctx.shadowBlur = t.neon.midBlur;
  ctx.fillStyle = `${t.accentGlow}${t.neon.midAlpha})`;
  ctx.fillText(text, x, y);
  // Pass 4: tight bright glow
  ctx.shadowColor = `${t.accentGlow}0.9)`;
  ctx.shadowBlur = t.neon.coreBlur * 2;
  ctx.fillStyle = `${t.accentGlow}0.85)`;
  ctx.fillText(text, x, y);
  // Pass 5: crisp core
  ctx.shadowColor = `${t.accentGlow}0.8)`;
  ctx.shadowBlur = t.neon.coreBlur;
  ctx.fillStyle = t.neon.coreColor;
  ctx.fillText(text, x, y);
  ctx.shadowColor = 'transparent';
}

/** Subtle noise texture overlay for depth */
function drawNoiseTexture(ctx: CanvasRenderingContext2D, opacity: number) {
  const imageData = ctx.getImageData(0, 0, S, S);
  const data = imageData.data;
  const strength = opacity * 12;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * strength;
    data[i] += noise;
    data[i + 1] += noise;
    data[i + 2] += noise;
  }
  ctx.putImageData(imageData, 0, 0);
}

/** Vignette effect — darkens edges for premium feel */
function drawVignette(ctx: CanvasRenderingContext2D, strength: number) {
  const grad = ctx.createRadialGradient(S / 2, S / 2, S * 0.3, S / 2, S / 2, S * 0.75);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, `rgba(0,0,0,${strength})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, S, S);
}

function goldRule(ctx: CanvasRenderingContext2D, y: number, t: CarouselTemplate) {
  ctx.strokeStyle = `${t.accentGlow}0.5)`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(S / 2 - 190, y);
  ctx.lineTo(S / 2 + 190, y);
  ctx.stroke();
}

function drawNotes(ctx: CanvasRenderingContext2D, size: number) {
  const n = imageCache;
  n.get(ASSETS.noteTL) && ctx.drawImage(n.get(ASSETS.noteTL)!, 52, 52, size * 0.7, size);
  n.get(ASSETS.noteTR) && ctx.drawImage(n.get(ASSETS.noteTR)!, S - 52 - size * 0.65, 52, size * 0.65, size);
  n.get(ASSETS.noteBL) && ctx.drawImage(n.get(ASSETS.noteBL)!, 52, S - 52 - size * 0.85, size * 0.85, size);
  n.get(ASSETS.noteBR) && ctx.drawImage(n.get(ASSETS.noteBR)!, S - 52 - size * 0.85, S - 52 - size * 0.85, size * 0.85, size);
}

function drawSparkles(ctx: CanvasRenderingContext2D, positions: [number, number][], sz: number) {
  const sparkle = imageCache.get(ASSETS.sparkle);
  if (!sparkle) return;
  for (const [x, y] of positions) {
    ctx.drawImage(sparkle, x - sz / 2, y - sz / 2, sz, sz);
  }
}

function vinylGrooves(ctx: CanvasRenderingContext2D, t: CarouselTemplate) {
  if (!t.cover.vinylOverlay) return;
  const cx = S / 2, cy = S / 2;
  const grad = ctx.createRadialGradient(cx, cy, 80, cx, cy, 520);
  grad.addColorStop(0, 'rgba(30, 36, 51, 0.4)');
  grad.addColorStop(1, 'rgba(10, 15, 30, 0.3)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, S, S);
  const step = Math.max(4, Math.floor(420 / t.cover.grooveCount));
  for (let r = 80; r <= 520; r += step) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = r % (step * 2) === 0 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(cx - 60, cy - 60, 380, -0.9, -0.3);
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 40;
  ctx.stroke();
}

function formatDate(weekDate: string): string {
  return new Date(weekDate + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });
}

// ─── COVER SLIDE ─────────────────────────────────────────

export async function generateCoverSlide(
  coverFeature: SelectionSlot,
  weekDate: string,
  templateId = 'mmmc_classic',
): Promise<Blob> {
  const t = getTemplate(templateId);
  await loadAllAssets(t);
  const canvas = document.createElement('canvas');
  canvas.width = S; canvas.height = S;
  const ctx = canvas.getContext('2d')!;

  // Background
  ctx.fillStyle = t.background;
  ctx.fillRect(0, 0, S, S);

  // Template-specific or default vinyl
  const vinylSrc = t.assets?.vinyl || ASSETS.vinyl;
  const vinyl = await loadImage(vinylSrc);
  if (vinyl && t.cover.vinylOverlay) {
    ctx.globalAlpha = t.cover.vinylOpacity;
    ctx.drawImage(vinyl, 0, 0, S, S);
    ctx.globalAlpha = 1;
  }
  vinylGrooves(ctx, t);

  // Featured image
  const featImg = await loadImage(coverFeature.track.cover_art_640);
  const imgSize = 560, border = t.cover.frameBorder;
  const imgX = (S - imgSize) / 2, imgY = 180;

  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = t.cover.frameShadowBlur;
  ctx.shadowOffsetY = 10;
  ctx.fillStyle = t.cover.frameColor;
  ctx.fillRect(imgX - border, imgY - border, imgSize + border * 2, imgSize + border * 2);
  ctx.shadowColor = 'transparent';
  if (featImg) ctx.drawImage(featImg, imgX, imgY, imgSize, imgSize);

  // Artist name + song title
  if (t.cover.showArtistName) {
    const textY = imgY + imgSize + border + 16;
    neonText(ctx, coverFeature.track.artist_names, S / 2, textY, `700 38px ${t.scriptFont}`, t);
    if (t.cover.showTrackName) {
      ctx.fillStyle = t.textSecondary;
      ctx.font = `500 26px ${t.bodyFont}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText(coverFeature.track.track_name, S / 2, textY + 48);
    }
  }

  // Header
  neonText(ctx, 'New Music Friday', S / 2, 42, `700 56px ${t.scriptFont}`, t);
  goldRule(ctx, 108, t);
  neonText(ctx, t.cover.subtitleText, S / 2, 118, `italic 600 26px ${t.bodyFont}`, t);

  // Swipe pill
  const swipeText = 'Swipe right for all this week\'s picks';
  ctx.font = `600 22px ${t.scriptFont}`;
  const swipeW = ctx.measureText(swipeText).width + 40;
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath(); ctx.roundRect((S - swipeW) / 2, 896, swipeW, 36, 18); ctx.fill();
  neonText(ctx, swipeText, S / 2, 900, `600 22px ${t.scriptFont}`, t);

  // Date
  neonText(ctx, formatDate(weekDate), S / 2, 960, `700 48px ${t.scriptFont}`, t);

  // Chevrons
  if (t.cover.showChevrons) {
    ctx.save();
    ctx.shadowColor = `${t.accentGlow}0.6)`;
    ctx.shadowBlur = 14;
    ctx.fillStyle = t.accent;
    for (let dx = 0; dx < 2; dx++) {
      const bx = 940 + dx * 30, by = S / 2;
      ctx.beginPath();
      ctx.moveTo(bx, by - 28); ctx.lineTo(bx + 20, by); ctx.lineTo(bx, by + 28);
      ctx.lineTo(bx + 6, by + 28); ctx.lineTo(bx + 26, by); ctx.lineTo(bx + 6, by - 28);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  // Decorations
  if (t.decorations.showNotes) drawNotes(ctx, t.decorations.noteSize);
  if (t.decorations.showSparkles) drawSparkles(ctx, [[160, 160], [920, 900]], t.decorations.sparkleSize);

  // Premium finishing: vignette + subtle noise
  drawVignette(ctx, 0.25);
  drawNoiseTexture(ctx, 0.15);

  return new Promise(resolve => canvas.toBlob(b => resolve(b!), 'image/png'));
}

// ─── GRID ────────────────────────────────────────────────

function drawGrid(
  ctx: CanvasRenderingContext2D, slots: SelectionSlot[],
  images: (HTMLImageElement | null)[], logo: HTMLImageElement | null,
  ox: number, oy: number, gridSize: number, t: CarouselTemplate,
) {
  const gap = Math.round(gridSize * t.grid.gap);
  const cell = Math.floor((gridSize - gap * 4) / 3);

  const positions = [
    { x: ox + gap, y: oy + gap },
    { x: ox + gap + cell + gap, y: oy + gap },
    { x: ox + gap + (cell + gap) * 2, y: oy + gap },
    { x: ox + gap, y: oy + gap + cell + gap },
    { x: ox + gap + (cell + gap) * 2, y: oy + gap + cell + gap },
    { x: ox + gap, y: oy + gap + (cell + gap) * 2 },
    { x: ox + gap + cell + gap, y: oy + gap + (cell + gap) * 2 },
    { x: ox + gap + (cell + gap) * 2, y: oy + gap + (cell + gap) * 2 },
  ];

  for (let i = 0; i < Math.min(slots.length, 8); i++) {
    const img = images[i];
    if (!img) continue;
    const pos = positions[i];
    const rot = (t.grid.rotations[i] * Math.PI) / 180;

    ctx.save();
    const cx = pos.x + cell / 2, cy = pos.y + cell / 2;
    ctx.translate(cx, cy); ctx.rotate(rot); ctx.translate(-cx, -cy);

    if (t.grid.cellShadow) {
      // Multi-layer shadow for depth
      ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 16;
      ctx.shadowOffsetX = 3; ctx.shadowOffsetY = 4;
      ctx.fillStyle = t.background;
      ctx.fillRect(pos.x - 2, pos.y - 2, cell + 4, cell + 4);
      ctx.shadowColor = 'transparent';
    }

    // Draw album art
    ctx.drawImage(img, pos.x, pos.y, cell, cell);

    // Subtle inner highlight on top edge for glass effect
    const hlGrad = ctx.createLinearGradient(pos.x, pos.y, pos.x, pos.y + cell * 0.3);
    hlGrad.addColorStop(0, 'rgba(255,255,255,0.06)');
    hlGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hlGrad;
    ctx.fillRect(pos.x, pos.y, cell, cell * 0.3);

    if (t.grid.cellBorder) {
      ctx.strokeStyle = t.grid.cellBorderColor;
      ctx.lineWidth = 2;
      ctx.strokeRect(pos.x + 1, pos.y + 1, cell - 2, cell - 2);
    }

    ctx.restore();
  }

  // Center logo
  const logoX = ox + gap + cell + gap, logoY = oy + gap + cell + gap;
  if (logo) {
    ctx.drawImage(logo, logoX, logoY, cell, cell);
  } else {
    ctx.fillStyle = t.background;
    ctx.fillRect(logoX, logoY, cell, cell);
    ctx.fillStyle = t.accent;
    ctx.font = `bold ${Math.round(cell * 0.12)}px ${t.bodyFont}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('MMMC', logoX + cell / 2, logoY + cell / 2);
  }
}

export async function generateGridSlide(
  slots: SelectionSlot[],
  weekDate: string,
  templateId = 'mmmc_classic',
  logoUrl = '/mmmc-logo.png',
): Promise<Blob> {
  const t = getTemplate(templateId);
  await loadAllAssets(t);
  const canvas = document.createElement('canvas');
  canvas.width = S; canvas.height = S;
  const ctx = canvas.getContext('2d')!;

  // Background (check for template asset)
  ctx.fillStyle = t.background;
  ctx.fillRect(0, 0, S, S);
  if (t.assets?.background) {
    const bg = await loadImage(t.assets.background);
    if (bg) ctx.drawImage(bg, 0, 0, S, S);
  }

  neonText(ctx, 'New Music Friday', S / 2, 16, `700 52px ${t.scriptFont}`, t);
  goldRule(ctx, 78, t);

  const imagePromises = slots.map(s => loadImage(s.track.cover_art_640));
  const logoPromise = loadImage(logoUrl);
  const [images, logo] = await Promise.all([Promise.all(imagePromises), logoPromise]);

  drawGrid(ctx, slots, images, logo, 74, 90, 932, t);

  neonText(ctx, formatDate(weekDate), S / 2, 1028, `700 40px ${t.scriptFont}`, t);

  if (t.decorations.showSparkles) drawSparkles(ctx, [[28, 28], [1052, 28], [28, 1052], [1052, 1052]], t.decorations.sparkleSize);
  if (t.decorations.showNotes) drawNotes(ctx, t.decorations.noteSize);

  // Premium finishing
  drawVignette(ctx, 0.2);
  drawNoiseTexture(ctx, 0.12);

  return new Promise(resolve => canvas.toBlob(b => resolve(b!), 'image/png'));
}

// ─── STANDALONE GRID ─────────────────────────────────────

export async function generateGridComposite(
  slots: SelectionSlot[], logoUrl: string, templateId = 'mmmc_classic',
): Promise<Blob> {
  const t = getTemplate(templateId);
  const canvas = document.createElement('canvas');
  canvas.width = S; canvas.height = S;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = t.background;
  ctx.fillRect(0, 0, S, S);

  const imagePromises = slots.map(s => loadImage(s.track.cover_art_640));
  const logoPromise = loadImage(logoUrl);
  const [images, logo] = await Promise.all([Promise.all(imagePromises), logoPromise]);

  drawGrid(ctx, slots, images, logo, 0, 0, S, t);

  return new Promise(resolve => canvas.toBlob(b => resolve(b!), 'image/png'));
}

// ─── FULL CAROUSEL ───────────────────────────────────────

export interface CarouselOutput {
  coverSlide: Blob;
  gridSlides: Blob[];
  allSlides: Blob[];
}

export async function generateFullCarousel(
  slideGroups: SelectionSlot[][],
  coverFeature: SelectionSlot,
  weekDate: string,
  onProgress?: (current: number, total: number) => void,
  templateId = 'mmmc_classic',
  logoUrl = '/mmmc-logo.png',
): Promise<CarouselOutput> {
  const total = 1 + slideGroups.length;
  onProgress?.(0, total);

  const coverSlide = await generateCoverSlide(coverFeature, weekDate, templateId);
  onProgress?.(1, total);

  const gridSlides: Blob[] = [];
  for (let i = 0; i < slideGroups.length; i++) {
    gridSlides.push(await generateGridSlide(slideGroups[i], weekDate, templateId, logoUrl));
    onProgress?.(2 + i, total);
  }

  return { coverSlide, gridSlides, allSlides: [coverSlide, ...gridSlides] };
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── TEMPLATE PREVIEW THUMBNAILS ────────────────────────

const PREVIEW_COLORS = [
  '#4A90D9', '#D35400', '#8E44AD', '#27AE60',
  '#E74C3C', '#F39C12', '#1ABC9C', '#2C3E50',
];

/**
 * Generate a small thumbnail preview of a template (200x200).
 * Uses colored gradient squares instead of actual album art
 * so it renders instantly with no network requests.
 */
export function generateTemplatePreview(
  templateId: string,
  size = 200,
): string {
  const t = getTemplate(templateId);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Background
  ctx.fillStyle = t.background;
  ctx.fillRect(0, 0, size, size);

  // Header text (simplified neon)
  const headerH = Math.round(size * 0.13);
  ctx.shadowColor = t.neon.outerGlow;
  ctx.shadowBlur = Math.round(t.neon.outerBlur * size / S);
  ctx.fillStyle = t.neon.coreColor;
  ctx.font = `700 ${Math.round(size * 0.07)}px ${t.scriptFont}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('New Music Friday', size / 2, Math.round(size * 0.02));
  ctx.shadowColor = 'transparent';

  // Gold rule
  ctx.strokeStyle = `${t.accentGlow}0.5)`;
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(size * 0.2, headerH);
  ctx.lineTo(size * 0.8, headerH);
  ctx.stroke();

  // 3x3 grid with center logo
  const gridTop = headerH + 2;
  const gridSize = size - gridTop - Math.round(size * 0.08);
  const gap = Math.max(1, Math.round(gridSize * t.grid.gap));
  const cell = Math.floor((gridSize - gap * 4) / 3);
  const ox = Math.round((size - (cell * 3 + gap * 4)) / 2);

  const positions = [
    { x: ox + gap, y: gridTop + gap },
    { x: ox + gap + cell + gap, y: gridTop + gap },
    { x: ox + gap + (cell + gap) * 2, y: gridTop + gap },
    { x: ox + gap, y: gridTop + gap + cell + gap },
    { x: ox + gap + (cell + gap) * 2, y: gridTop + gap + cell + gap },
    { x: ox + gap, y: gridTop + gap + (cell + gap) * 2 },
    { x: ox + gap + cell + gap, y: gridTop + gap + (cell + gap) * 2 },
    { x: ox + gap + (cell + gap) * 2, y: gridTop + gap + (cell + gap) * 2 },
  ];

  // Draw 8 colored cells
  for (let i = 0; i < 8; i++) {
    const pos = positions[i];
    const rot = (t.grid.rotations[i] * Math.PI) / 180;

    ctx.save();
    const cx = pos.x + cell / 2, cy = pos.y + cell / 2;
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.translate(-cx, -cy);

    if (t.grid.cellShadow) {
      ctx.shadowColor = 'rgba(0,0,0,0.3)';
      ctx.shadowBlur = 3;
    }

    // Gradient fill simulating album art
    const grad = ctx.createLinearGradient(pos.x, pos.y, pos.x + cell, pos.y + cell);
    grad.addColorStop(0, PREVIEW_COLORS[i]);
    grad.addColorStop(1, PREVIEW_COLORS[(i + 3) % 8]);
    ctx.fillStyle = grad;
    ctx.fillRect(pos.x, pos.y, cell, cell);
    ctx.shadowColor = 'transparent';

    if (t.grid.cellBorder) {
      ctx.strokeStyle = t.grid.cellBorderColor;
      ctx.lineWidth = 1;
      ctx.strokeRect(pos.x, pos.y, cell, cell);
    }

    ctx.restore();
  }

  // Center cell: logo placeholder
  const logoX = ox + gap + cell + gap;
  const logoY = gridTop + gap + cell + gap;
  ctx.fillStyle = t.background;
  ctx.fillRect(logoX, logoY, cell, cell);
  ctx.fillStyle = t.accent;
  ctx.font = `bold ${Math.round(cell * 0.25)}px ${t.bodyFont}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('M', logoX + cell / 2, logoY + cell / 2);

  // Date footer
  ctx.shadowColor = t.neon.outerGlow;
  ctx.shadowBlur = Math.round(t.neon.outerBlur * size / S * 0.5);
  ctx.fillStyle = t.neon.coreColor;
  ctx.font = `700 ${Math.round(size * 0.055)}px ${t.scriptFont}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('April 4, 2026', size / 2, size - 2);
  ctx.shadowColor = 'transparent';

  return canvas.toDataURL('image/png');
}

const previewCache = new Map<string, string>();

/** Cached version — generates once per template ID */
export function getTemplatePreview(templateId: string, size = 200): string {
  const key = `${templateId}_${size}`;
  if (!previewCache.has(key)) {
    previewCache.set(key, generateTemplatePreview(templateId, size));
  }
  return previewCache.get(key)!;
}
