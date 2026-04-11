import type { SelectionSlot } from './selection';
import type { CarouselTemplate } from './carousel-templates';
import { getTemplate } from './carousel-templates';
import { getTitleTemplate, type TitleSlideTemplate } from './title-templates';
import { drawCustomElements, type EditorElement } from './editor-elements';
import { type GridConfig, getGridById, getGridsForCount, computeCellRects } from './grid-layouts';

/** Canvas dimensions by aspect ratio */
export type CarouselAspect = '1:1' | '3:4' | '9:16';

export interface CanvasDimensions {
  w: number;
  h: number;
  /** Grid area origin Y — below header text */
  gridY: number;
  /** Grid area height */
  gridH: number;
  /** Header font scale relative to 1080 */
  fontScale: number;
}

export function getDimensions(aspect: CarouselAspect = '1:1'): CanvasDimensions {
  if (aspect === '9:16') {
    // Story: 1080x1920 — tall format for Instagram Stories
    return { w: 1080, h: 1920, gridY: 200, gridH: 1200, fontScale: 1.0 };
  }
  if (aspect === '3:4') {
    // Portrait: PURPOSE-BUILT layout, not stretched square.
    return { w: 1080, h: 1440, gridY: 160, gridH: 900, fontScale: 1.0 };
  }
  return { w: 1080, h: 1080, gridY: 90, gridH: 932, fontScale: 1.0 };
}

// Legacy alias — used by functions that haven't been updated to pass dimensions
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

const IMAGE_CACHE_MAX = 200;
const imageCache = new Map<string, HTMLImageElement>();

function evictIfNeeded() {
  if (imageCache.size <= IMAGE_CACHE_MAX) return;
  // Delete oldest entries (Map iterates in insertion order)
  const toDelete = imageCache.size - IMAGE_CACHE_MAX;
  const iter = imageCache.keys();
  for (let i = 0; i < toDelete; i++) {
    const key = iter.next().value;
    if (key) imageCache.delete(key);
  }
}

async function loadImage(src: string): Promise<HTMLImageElement | null> {
  if (imageCache.has(src)) return imageCache.get(src)!;
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => { imageCache.set(src, img); evictIfNeeded(); resolve(img); };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Shared image loader with LRU cache (exported for cross-platform.ts) */
export const loadImageCached = loadImage;

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

/**
 * Neon text — offscreen canvas + screen blend compositing.
 * Produces crisp core text with luminous bloom, like actual neon photography.
 */
export function neonText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, font: string, t: CarouselTemplate) {
  // Measure text bounds for tight offscreen canvas
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const metrics = ctx.measureText(text);
  const pad = Math.round(t.neon.outerBlur * 2.5);
  const tw = Math.ceil(metrics.width) + pad * 2;
  // Extract px size from font string like "700 48px Helvetica" — parseInt grabs weight, not size
  const pxMatch = font.match(/(\d+(?:\.\d+)?)px/);
  const fontSize = pxMatch ? parseFloat(pxMatch[1]) : 48;
  const th = Math.ceil(fontSize * 1.4) + pad * 2;

  // Guard against 0-dimension canvas (causes drawImage crash)
  if (tw <= 0 || th <= 0 || !text.trim()) return;

  // Draw text to offscreen canvas
  const off = document.createElement('canvas');
  off.width = tw; off.height = th;
  const oc = off.getContext('2d')!;
  oc.font = font;
  oc.textAlign = 'center';
  oc.textBaseline = 'top';
  oc.fillStyle = t.neon.coreColor;
  oc.fillText(text, tw / 2, pad);

  // Destination position
  const dx = x - tw / 2;
  const dy = y - pad;

  // Skip glow passes for templates with no glow
  if (t.neon.outerBlur > 0 && t.neon.outerAlpha > 0) {
    // Glow canvas — tinted for color
    const glow = document.createElement('canvas');
    glow.width = tw; glow.height = th;
    const gc = glow.getContext('2d')!;
    gc.font = font;
    gc.textAlign = 'center';
    gc.textBaseline = 'top';
    gc.fillStyle = t.neon.midGlow;
    gc.fillText(text, tw / 2, pad);

    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    // Pass 1: wide atmospheric glow
    ctx.filter = `blur(${Math.round(t.neon.outerBlur * 1.2)}px)`;
    ctx.globalAlpha = t.neon.outerAlpha * 0.5;
    ctx.drawImage(glow, dx, dy);

    // Pass 2: medium glow
    ctx.filter = `blur(${Math.round(t.neon.midBlur)}px)`;
    ctx.globalAlpha = t.neon.midAlpha * 0.7;
    ctx.drawImage(glow, dx, dy);

    // Pass 3: tight glow
    ctx.filter = `blur(${Math.round(t.neon.coreBlur * 1.5)}px)`;
    ctx.globalAlpha = 0.8;
    ctx.drawImage(glow, dx, dy);

    ctx.filter = 'none';
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
  }

  // Core text — crisp, zero blur, full opacity on top
  ctx.drawImage(off, dx, dy);
}

/**
 * Film grain via overlay compositing — preserves color, adds texture.
 * More realistic than additive pixel noise.
 */
function drawNoiseTexture(ctx: CanvasRenderingContext2D, opacity: number) {
  const cw = ctx.canvas.width, ch = ctx.canvas.height;
  const grain = document.createElement('canvas');
  grain.width = cw; grain.height = ch;
  const gc = grain.getContext('2d')!;
  const imageData = gc.createImageData(cw, ch);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const v = Math.round(128 + (Math.random() - 0.5) * 80);
    data[i] = v; data[i + 1] = v; data[i + 2] = v;
    data[i + 3] = 255;
  }
  gc.putImageData(imageData, 0, 0);
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = opacity;
  ctx.drawImage(grain, 0, 0);
  ctx.restore();
}

/**
 * Vignette via multiply compositing — cleaner edge darkening.
 */
function drawVignette(ctx: CanvasRenderingContext2D, strength: number) {
  const cw = ctx.canvas.width, ch = ctx.canvas.height;
  const maxDim = Math.max(cw, ch);
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  const grad = ctx.createRadialGradient(cw / 2, ch / 2, maxDim * 0.28, cw / 2, ch / 2, maxDim * 0.68);
  // Center: white (no darkening via multiply). Edges: dark.
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.5, `rgba(255,255,255,${1 - strength * 0.3})`);
  grad.addColorStop(1, `rgba(${Math.round(40 * (1 - strength))},${Math.round(40 * (1 - strength))},${Math.round(50 * (1 - strength))},1)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, cw, ch);
  ctx.restore();
}

function goldRule(ctx: CanvasRenderingContext2D, y: number, t: CarouselTemplate) {
  const cw = ctx.canvas.width;
  ctx.strokeStyle = `${t.accentGlow}0.5)`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cw / 2 - 190, y);
  ctx.lineTo(cw / 2 + 190, y);
  ctx.stroke();
}

function drawNotes(ctx: CanvasRenderingContext2D, size: number) {
  const n = imageCache;
  const cw = ctx.canvas.width, ch = ctx.canvas.height;
  n.get(ASSETS.noteTL) && ctx.drawImage(n.get(ASSETS.noteTL)!, 52, 52, size * 0.7, size);
  n.get(ASSETS.noteTR) && ctx.drawImage(n.get(ASSETS.noteTR)!, cw - 52 - size * 0.65, 52, size * 0.65, size);
  n.get(ASSETS.noteBL) && ctx.drawImage(n.get(ASSETS.noteBL)!, 52, ch - 52 - size * 0.85, size * 0.85, size);
  n.get(ASSETS.noteBR) && ctx.drawImage(n.get(ASSETS.noteBR)!, cw - 52 - size * 0.85, ch - 52 - size * 0.85, size * 0.85, size);
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
  const cw = ctx.canvas.width, ch = ctx.canvas.height;
  const cx = cw / 2, cy = ch / 2;
  const scale = Math.min(cw, ch) / 1080; // scale relative to 1080 base
  const grad = ctx.createRadialGradient(cx, cy, 80 * scale, cx, cy, 520 * scale);
  grad.addColorStop(0, 'rgba(30, 36, 51, 0.4)');
  grad.addColorStop(1, 'rgba(10, 15, 30, 0.3)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, cw, ch);
  const step = Math.max(4, Math.floor(420 / t.cover.grooveCount));
  for (let r = 80; r <= 520; r += step) {
    ctx.beginPath();
    ctx.arc(cx, cy, r * scale, 0, Math.PI * 2);
    ctx.strokeStyle = r % (step * 2) === 0 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(cx - 60 * scale, cy - 60 * scale, 380 * scale, -0.9, -0.3);
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 40 * scale;
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

// ─── TITLE SLIDE (uses TitleSlideTemplate) ──────────────

/**
 * Renders a title/cover slide using the TitleSlideTemplate system.
 * This is independent of the grid template — title and grid styles
 * are selected separately by the user.
 */
export async function generateTitleSlide(
  coverFeature: SelectionSlot | null,
  weekDate: string,
  templateOrId: string | TitleSlideTemplate = 'nashville_neon',
  aspect: CarouselAspect = '1:1',
  customElements?: EditorElement[],
): Promise<Blob> {
  const tt = typeof templateOrId === 'string'
    ? getTitleTemplate(templateOrId)
    : templateOrId;
  const dim = getDimensions(aspect);
  const W = dim.w, H = dim.h;

  // Pre-load fonts
  await Promise.all([
    document.fonts.load(`${tt.headlineWeight} ${Math.round(W * tt.headlineSize)}px ${tt.headlineFont}`).catch(() => {}),
    document.fonts.load(`400 ${Math.round(W * tt.subtitleSize)}px ${tt.subtitleFont}`).catch(() => {}),
    document.fonts.load(`700 ${Math.round(W * tt.dateSize)}px ${tt.dateFont}`).catch(() => {}),
  ]);

  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // Background
  ctx.fillStyle = tt.background;
  ctx.fillRect(0, 0, W, H);

  // Background image (with optional blur + darken)
  if (tt.backgroundImage) {
    const bgImg = await loadImage(tt.backgroundImage);
    if (bgImg) {
      if (tt.backgroundBlur && tt.backgroundBlur > 0) {
        ctx.filter = `blur(${tt.backgroundBlur}px)`;
        // Draw slightly oversized to cover blur edges
        ctx.drawImage(bgImg, -20, -20, W + 40, H + 40);
        ctx.filter = 'none';
      } else {
        ctx.drawImage(bgImg, 0, 0, W, H);
      }
      if (tt.backgroundDarken && tt.backgroundDarken > 0) {
        ctx.fillStyle = `rgba(0,0,0,${tt.backgroundDarken})`;
        ctx.fillRect(0, 0, W, H);
      }
    }
  }

  // Background gradient
  if (tt.backgroundGradient) {
    const colors = tt.backgroundGradient.match(/#[0-9A-Fa-f]{6}/g);
    if (colors && colors.length >= 2) {
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      colors.forEach((c, i) => grad.addColorStop(i / (colors.length - 1), c));
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    }
  }

  // Frame border
  if (tt.showFrame && tt.frameWidth > 0) {
    ctx.strokeStyle = tt.frameColor;
    ctx.lineWidth = tt.frameWidth;
    const inset = tt.frameWidth / 2;
    ctx.strokeRect(inset, inset, W - tt.frameWidth, H - tt.frameWidth);
  }

  // Helper: text with glow — uses neonText compositing for templates with glow,
  // plain text for templates without (e.g. Editorial, Studio Clean)
  const ttAsCarousel: CarouselTemplate = {
    id: tt.id, name: tt.name, description: tt.description,
    background: tt.background, textPrimary: tt.textPrimary,
    textSecondary: tt.textSecondary, accent: tt.accent,
    accentGlow: `rgba(${tt.accent === '#FFFFFF' ? '255,255,255' : '128,128,128'}, `,
    scriptFont: tt.headlineFont, bodyFont: tt.subtitleFont,
    neon: {
      outerGlow: tt.glow.color, outerBlur: tt.glow.blur, outerAlpha: 0.3,
      midGlow: tt.glow.color, midBlur: Math.round(tt.glow.blur * 0.5), midAlpha: 0.6,
      coreColor: tt.textPrimary, coreBlur: Math.round(tt.glow.blur * 0.15),
    },
    grid: { gap: 0, rotations: [], cellShadow: false, cellBorder: false, cellBorderColor: '' },
    cover: { vinylOverlay: false, vinylOpacity: 0, grooveCount: 0, frameBorder: 0, frameColor: '', frameShadowBlur: 0, showChevrons: false, showArtistName: false, showTrackName: false, subtitleText: '' },
    decorations: { showNotes: false, showSparkles: false, noteSize: 0, sparkleSize: 0 },
  };
  const glowText = (text: string, x: number, y: number, font: string, _color: string) => {
    if (tt.glow.passes > 0 && tt.glow.blur > 0) {
      neonText(ctx, text, x, y, font, ttAsCarousel);
    } else {
      ctx.font = font;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = _color;
      ctx.fillText(text, x, y);
    }
  };

  // Headline + divider — skipped for vinyl_classic (it renders its own header)
  if (!tt.vinylRecord) {
    const rawHeadline = 'New Music Friday';
    const headline = tt.headlineCase === 'uppercase' ? rawHeadline.toUpperCase() : rawHeadline;
    // Portrait: use fixed pixel positions in the top zone, not H fractions
    const hlY = aspect === '3:4' ? Math.min(Math.round(H * tt.headlineY), 80) : Math.round(H * tt.headlineY);
    glowText(
      headline,
      Math.round(W * (tt.headlineX ?? 0.5)),
      hlY,
      `${tt.headlineWeight} ${Math.round(W * tt.headlineSize)}px ${tt.headlineFont}`,
      tt.textPrimary,
    );

    if (tt.showDivider) {
      ctx.strokeStyle = tt.dividerColor;
      ctx.lineWidth = 1;
      const divY = aspect === '3:4' ? hlY + Math.round(W * tt.headlineSize) + 20 : Math.round(H * (tt.subtitleY - 0.01));
      ctx.beginPath();
      ctx.moveTo(W * 0.18, divY);
      ctx.lineTo(W * 0.82, divY);
      ctx.stroke();
    }
  }

  // Vinyl Classic rendering — matches reference image (Image 1)
  // Full-canvas vinyl record, tilted album art, gold neon, sparkles, notes, chevrons
  if (tt.vinylRecord) {
    const t = getTemplate('mmmc_classic');
    await loadAllAssets(t);

    // Vinyl texture image overlay (photographic realism)
    const vinylSrc = t.assets?.vinyl || ASSETS.vinyl;
    const vinyl = await loadImage(vinylSrc);
    if (vinyl) {
      ctx.globalAlpha = 0.6;
      ctx.drawImage(vinyl, 0, 0, W, H);
      ctx.globalAlpha = 1;
    }
    vinylGrooves(ctx, t);

    // Featured image — TILTED ~4 degrees on the record (like a CD case on vinyl)
    if (coverFeature) {
      const featImg = await loadImage(coverFeature.track.cover_art_640);
      const imgSize = Math.round(W * 0.44);
      const border = 8;
      const imgCx = W / 2;
      // In portrait, keep image centered vertically but not stretched by H fraction
      const imgCy = aspect === '3:4' ? 520 : H * 0.42;
      const tiltDeg = -4;

      ctx.save();
      ctx.translate(imgCx, imgCy);
      ctx.rotate((tiltDeg * Math.PI) / 180);
      // Shadow
      ctx.shadowColor = 'rgba(0,0,0,0.7)';
      ctx.shadowBlur = 28;
      ctx.shadowOffsetY = 8;
      // White frame
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(-imgSize / 2 - border, -imgSize / 2 - border, imgSize + border * 2, imgSize + border * 2);
      ctx.shadowColor = 'transparent';
      if (featImg) ctx.drawImage(featImg, -imgSize / 2, -imgSize / 2, imgSize, imgSize);
      ctx.restore();
    }

    // Header — gold neon "New Music Friday" with music note emojis
    const headerY = 32;
    neonText(ctx, 'New Music Friday', W / 2, headerY, `700 56px ${t.scriptFont}`, t);
    // "Max Meets Music City" subtitle in italic
    neonText(ctx, 'Max Meets Music City', W / 2, headerY + 68, `italic 600 28px ${t.bodyFont}`, t);

    // Gold sparkles/stars — use fixed positions in portrait to keep them near content
    const starPositions: [number, number][] = aspect === '3:4' ? [
      [W * 0.12, 140], [W * 0.88, 140],
      [W * 0.08, 820], [W * 0.92, 820],
      [W * 0.18, 1020], [W * 0.82, 1020],
    ] : [
      [W * 0.12, H * 0.14], [W * 0.88, H * 0.14],
      [W * 0.08, H * 0.68], [W * 0.92, H * 0.68],
      [W * 0.18, H * 0.85], [W * 0.82, H * 0.85],
    ];
    if (t.decorations.showSparkles) drawSparkles(ctx, starPositions, t.decorations.sparkleSize);

    // Music notes in corners
    if (t.decorations.showNotes) drawNotes(ctx, t.decorations.noteSize);

    // Double chevrons on the right
    ctx.save();
    ctx.shadowColor = `${t.accentGlow}0.6)`;
    ctx.shadowBlur = 14;
    ctx.fillStyle = t.accent;
    for (let dx = 0; dx < 2; dx++) {
      const bx = W - 120 + dx * 30, by = aspect === '3:4' ? 520 : H * 0.42;
      ctx.beginPath();
      ctx.moveTo(bx, by - 28); ctx.lineTo(bx + 20, by); ctx.lineTo(bx, by + 28);
      ctx.lineTo(bx + 6, by + 28); ctx.lineTo(bx + 26, by); ctx.lineTo(bx + 6, by - 28);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();

    // "Swipe right for all this week's picks" in gold — below sparkles/decorations
    const swipeY = aspect === '3:4' ? 1100 : H * 0.78;
    neonText(ctx, 'Swipe right for all this week\'s picks', W / 2, swipeY, `600 24px ${t.scriptFont}`, t);

    // Date — in portrait, below swipe text with breathing room
    const vinylDateY = aspect === '3:4' ? 1180 : H * 0.88;
    neonText(ctx, formatDate(weekDate), W / 2, vinylDateY, `700 48px ${t.scriptFont}`, t);
  }

  // Featured image (non-vinyl templates)
  if (!tt.vinylRecord && coverFeature) {
    const img = await loadImage(coverFeature.track.cover_art_640);
    // In portrait mode, scale image slightly and center in the canvas middle zone
    const sizeScale = aspect === '3:4' ? 1.10 : 1.0;
    const imgSize = Math.round(W * tt.featuredImageSize * sizeScale);
    const imgX = Math.round(W * (tt.featuredImageX ?? 0.5)) - imgSize / 2;
    // Portrait: center image vertically in the canvas (not pushed to top by H fraction)
    const imgY = aspect === '3:4'
      ? Math.round((H - imgSize) / 2) - 40  // centered, nudged up for date room
      : Math.round(H * tt.featuredImageY);

    ctx.save();
    if (tt.featuredRotation !== 0) {
      const cx = imgX + imgSize / 2, cy = imgY + imgSize / 2;
      ctx.translate(cx, cy);
      ctx.rotate((tt.featuredRotation * Math.PI) / 180);
      ctx.translate(-cx, -cy);
    }

    // Shadow
    if (tt.featuredShadowBlur > 0) {
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = tt.featuredShadowBlur;
      ctx.shadowOffsetY = 8;
    }

    // Border (acts as a frame around the image)
    if (tt.featuredBorder > 0) {
      ctx.fillStyle = tt.featuredBorderColor || '#FFFFFF';
      ctx.fillRect(
        imgX - tt.featuredBorder, imgY - tt.featuredBorder,
        imgSize + tt.featuredBorder * 2, imgSize + tt.featuredBorder * 2,
      );
    }
    ctx.shadowColor = 'transparent';

    if (img) ctx.drawImage(img, imgX, imgY, imgSize, imgSize);
    ctx.restore();

    // Artist name + track name below image
    const labelY = imgY + imgSize + (tt.featuredBorder || 0) + 16;
    const labelCx = Math.round(W * (tt.featuredImageX ?? 0.5));
    glowText(
      coverFeature.track.artist_names,
      labelCx,
      labelY,
      `700 ${Math.round(W * 0.035)}px ${tt.headlineFont}`,
      tt.textPrimary,
    );
    ctx.fillStyle = tt.textSecondary;
    ctx.font = `400 ${Math.round(W * 0.024)}px ${tt.subtitleFont}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(coverFeature.track.track_name, labelCx, labelY + Math.round(W * 0.042));
  }

  // Date + swipe pill — ONLY for non-vinyl templates (vinyl renders its own date above)
  if (!tt.vinylRecord) {
    const squareDateY = Math.round(H * tt.dateY);
    const portraitDateY = coverFeature
      ? Math.round(H * tt.featuredImageY) + Math.round(W * tt.featuredImageSize * 1.15) + 140
      : H - 200;
    const dateY = aspect === '3:4' ? Math.min(portraitDateY, H - 80) : squareDateY;

    if (tt.swipePill) {
      const pillText = 'Swipe for all picks \u2192';
      const pillFontSize = Math.round(W * 0.020);
      ctx.font = `600 ${pillFontSize}px "DM Sans", sans-serif`;
      const pillW = ctx.measureText(pillText).width + 40;
      const pillY = dateY - 48;
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.roundRect((W - pillW) / 2, pillY, pillW, 32, 16);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(pillText, Math.round(W * (tt.dateX ?? 0.5)), pillY + 7);
    }

    glowText(
      formatDate(weekDate),
      Math.round(W * (tt.dateX ?? 0.5)),
      dateY,
      `700 ${Math.round(W * tt.dateSize)}px ${tt.dateFont}`,
      tt.textPrimary,
    );
  }

  // Overlay tint
  if (tt.overlay) {
    ctx.fillStyle = tt.overlay;
    ctx.fillRect(0, 0, W, H);
  }

  // Custom user elements (text banners, images, shapes)
  const titleCustom = [...(tt.customElements || []), ...(customElements || [])];
  if (titleCustom.length > 0) {
    await drawCustomElements(ctx, titleCustom, W, H);
  }

  // Vignette
  if (tt.vignette > 0) drawVignette(ctx, tt.vignette);

  // Grain/noise
  if (tt.grain > 0) drawNoiseTexture(ctx, tt.grain);

  return new Promise(resolve => canvas.toBlob(b => resolve(b!), 'image/png'));
}

// ─── GRID ────────────────────────────────────────────────

/** Layout-aware grid renderer — works with any GridConfig */
function drawGridWithLayout(
  ctx: CanvasRenderingContext2D, slots: SelectionSlot[],
  images: (HTMLImageElement | null)[], logo: HTMLImageElement | null,
  ox: number, oy: number, gridW: number, gridH: number,
  t: CarouselTemplate, layout: GridConfig,
) {
  const gapPx = Math.max(2, Math.round(Math.min(gridW, gridH) * t.grid.gap));
  const rects = computeCellRects(layout, ox, oy, gridW, gridH, gapPx);

  let trackIdx = 0;
  for (const rect of rects) {
    const cornerR = Math.round(Math.min(rect.w, rect.h) * 0.03); // subtle rounded corners

    if (rect.isLogo) {
      // Draw logo with rounded corners
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(rect.x, rect.y, rect.w, rect.h, cornerR);
      ctx.clip();
      if (logo) {
        ctx.drawImage(logo, rect.x, rect.y, rect.w, rect.h);
      } else {
        ctx.fillStyle = t.background;
        ctx.fill();
        ctx.fillStyle = t.accent;
        const fontSize = Math.round(Math.min(rect.w, rect.h) * 0.15);
        ctx.font = `bold ${fontSize}px ${t.bodyFont}`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('MMMC', rect.x + rect.w / 2, rect.y + rect.h / 2);
      }
      ctx.restore();
      continue;
    }

    if (trackIdx >= slots.length) continue;
    const img = images[trackIdx];
    trackIdx++;
    if (!img) continue;

    const rotDeg = t.grid.rotations[rect.cellIndex % t.grid.rotations.length] || 0;
    const rot = (rotDeg * Math.PI) / 180;

    ctx.save();
    const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2;
    ctx.translate(cx, cy); ctx.rotate(rot); ctx.translate(-cx, -cy);

    // Drop shadow beneath cell
    if (t.grid.cellShadow) {
      ctx.shadowColor = 'rgba(0,0,0,0.45)';
      ctx.shadowBlur = 14;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 4;
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.roundRect(rect.x, rect.y, rect.w, rect.h, cornerR);
      ctx.fill();
      ctx.shadowColor = 'transparent';
    }

    // Clip to rounded rect, draw album art
    ctx.beginPath();
    ctx.roundRect(rect.x, rect.y, rect.w, rect.h, cornerR);
    ctx.clip();
    ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h);

    // Glass highlight — screen blend for additive light
    ctx.globalCompositeOperation = 'screen';
    const hlGrad = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h * 0.35);
    hlGrad.addColorStop(0, 'rgba(255,255,255,0.08)');
    hlGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hlGrad;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h * 0.35);
    ctx.globalCompositeOperation = 'source-over';

    if (t.grid.cellBorder) {
      ctx.strokeStyle = t.grid.cellBorderColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(rect.x + 1, rect.y + 1, rect.w - 2, rect.h - 2, Math.max(0, cornerR - 1));
      ctx.stroke();
    }

    ctx.restore();
  }
}

// ─── PER-TEMPLATE POST-PROCESSING ──────────────────────

function drawScanlines(ctx: CanvasRenderingContext2D, color: string, spacing: number) {
  if (spacing <= 0) return;
  const cw = ctx.canvas.width, ch = ctx.canvas.height;
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  for (let y = 0; y < ch; y += spacing) {
    ctx.fillStyle = color;
    ctx.fillRect(0, y, cw, 1);
  }
  ctx.restore();
}

function drawSpotlight(ctx: CanvasRenderingContext2D) {
  const cw = ctx.canvas.width, ch = ctx.canvas.height;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const grad = ctx.createRadialGradient(cw / 2, 0, 0, cw / 2, ch * 0.3, cw * 0.7);
  grad.addColorStop(0, 'rgba(255,255,255,0.12)');
  grad.addColorStop(0.5, 'rgba(200,220,255,0.04)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, cw, ch);
  ctx.restore();
}

function drawSepiaWash(ctx: CanvasRenderingContext2D, opacity: number) {
  const cw = ctx.canvas.width, ch = ctx.canvas.height;
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = opacity;
  const grad = ctx.createLinearGradient(0, 0, cw, ch);
  grad.addColorStop(0, '#D4A060');
  grad.addColorStop(1, '#8B6914');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, cw, ch);
  ctx.restore();
}

function drawPaperTexture(ctx: CanvasRenderingContext2D, opacity: number) {
  const cw = ctx.canvas.width, ch = ctx.canvas.height;
  const paper = document.createElement('canvas');
  paper.width = cw; paper.height = ch;
  const pc = paper.getContext('2d')!;
  const imageData = pc.createImageData(cw, ch);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const v = Math.round(180 + (Math.random() - 0.5) * 60);
    data[i] = v; data[i + 1] = v; data[i + 2] = v - 10; data[i + 3] = 255;
  }
  pc.putImageData(imageData, 0, 0);
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = opacity;
  ctx.drawImage(paper, 0, 0);
  ctx.restore();
}

function drawGritTexture(ctx: CanvasRenderingContext2D, opacity: number) {
  const cw = ctx.canvas.width, ch = ctx.canvas.height;
  const grit = document.createElement('canvas');
  grit.width = cw; grit.height = ch;
  const gc = grit.getContext('2d')!;
  const imageData = gc.createImageData(cw, ch);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const v = Math.random() > 0.5 ? 200 : 40;
    data[i] = v; data[i + 1] = v; data[i + 2] = v; data[i + 3] = 255;
  }
  gc.putImageData(imageData, 0, 0);
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = opacity;
  ctx.drawImage(grit, 0, 0);
  ctx.restore();
}

/** Apply template-specific visual effects after grid is drawn */
function postProcessGrid(ctx: CanvasRenderingContext2D, t: CarouselTemplate) {
  switch (t.id) {
    case 'neon_city':
      drawScanlines(ctx, 'rgba(0,255,212,0.025)', 3);
      break;
    case 'neon_rose':
      drawScanlines(ctx, 'rgba(255,105,180,0.02)', 4);
      break;
    case 'concrete_jungle':
      drawGritTexture(ctx, 0.08);
      drawScanlines(ctx, 'rgba(255,69,0,0.015)', 4);
      break;
    case 'golden_hour':
      drawSepiaWash(ctx, 0.04);
      break;
    case 'editorial_mono':
      drawPaperTexture(ctx, 0.03);
      break;
    case 'retro_vinyl':
      drawSepiaWash(ctx, 0.05);
      break;
    case 'earthy_acoustic':
      drawPaperTexture(ctx, 0.06);
      break;
    case 'stadium_lights':
      drawSpotlight(ctx);
      break;
  }

  // Generic extended effects from template config
  if (t.scanlineSpacing && t.scanlineSpacing > 0) {
    drawScanlines(ctx, `rgba(${t.accent === '#FFFFFF' ? '255,255,255' : '128,128,128'},0.03)`, t.scanlineSpacing);
  }
  if (t.colorOverlay && t.colorOverlayBlend) {
    ctx.save();
    ctx.globalCompositeOperation = t.colorOverlayBlend;
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = t.colorOverlay;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.restore();
  }
}

/** Songwriter credit for carousel rendering */
export interface SlideComposerCredit {
  name: string;
  charting: number;
  publisher?: string | null;
}

export async function generateGridSlide(
  slots: SelectionSlot[],
  weekDate: string,
  templateId = 'mmmc_classic',
  logoUrl = '/mmmc-logo.png',
  layoutId?: string,
  aspect: CarouselAspect = '1:1',
  customElements?: EditorElement[],
  composerCredits?: SlideComposerCredit[],
): Promise<Blob> {
  const t = getTemplate(templateId);
  await loadAllAssets(t);
  // Merge custom elements from template + explicit param
  const allCustom = [...(t.customElements || []), ...(customElements || [])];
  const dim = getDimensions(aspect);
  const canvas = document.createElement('canvas');
  canvas.width = dim.w; canvas.height = dim.h;
  const ctx = canvas.getContext('2d')!;

  // Background (check for template asset)
  ctx.fillStyle = t.background;
  ctx.fillRect(0, 0, dim.w, dim.h);
  if (t.assets?.background) {
    const bg = await loadImage(t.assets.background);
    if (bg) ctx.drawImage(bg, 0, 0, dim.w, dim.h);
  }

  // Header — in portrait, center in the top zone above the grid
  const headerY = aspect === '3:4' ? 40 : 16;
  const ruleY = aspect === '3:4' ? 110 : 78;
  neonText(ctx, 'New Music Friday', dim.w / 2, headerY, `700 52px ${t.scriptFont}`, t);
  goldRule(ctx, ruleY, t);

  const imagePromises = slots.map(s => loadImage(s.track.cover_art_640));
  const logoPromise = loadImage(logoUrl);
  const [images, logo] = await Promise.all([Promise.all(imagePromises), logoPromise]);

  // Always use layout-aware renderer — resolve layout from ID or auto-select
  // Try the exact slot count first, then try larger counts up to 16 so a user-selected
  // layout (e.g. 4×2 for 8) still renders when fewer tracks are actually selected.
  let resolvedLayout: GridConfig | null = null;
  if (layoutId) {
    resolvedLayout = getGridById(slots.length, layoutId);
    if (!resolvedLayout) {
      for (let n = slots.length + 1; n <= 16; n++) {
        resolvedLayout = getGridById(n, layoutId);
        if (resolvedLayout) break;
      }
    }
  }
  const gridX = 74;
  const gridW = dim.w - 74 * 2;

  if (resolvedLayout) {
    drawGridWithLayout(ctx, slots, images, logo, gridX, dim.gridY, gridW, dim.gridH, t, resolvedLayout);
  } else {
    // Auto-select best layout for the track count
    const autoOpts = getGridsForCount(slots.length);
    const autoLayout = autoOpts.logo[0] || autoOpts.exact.find(g => g.columns > 1 && g.rows > 1) || autoOpts.exact[0] || autoOpts.close[0];
    if (autoLayout) {
      drawGridWithLayout(ctx, slots, images, logo, gridX, dim.gridY, gridW, dim.gridH, t, autoLayout);
    } else {
      const cols = Math.ceil(Math.sqrt(slots.length));
      drawGridWithLayout(ctx, slots, images, logo, gridX, dim.gridY, gridW, dim.gridH, t, {
        id: 'auto', name: 'Auto', columns: cols,
        rows: Math.ceil(slots.length / cols),
        trackSlots: slots.length, hasLogo: false, logoIndex: -1,
        cells: Array.from({ length: slots.length }, (_, i) => ({
          col: i % cols, row: Math.floor(i / cols), colSpan: 1, rowSpan: 1,
        })),
        emptyCount: 0, category: 'exact',
      });
    }
  }

  // Songwriter credits — rendered in bottom zone when provided
  const bottomZoneStart = dim.gridY + dim.gridH;
  const bottomZoneH = dim.h - bottomZoneStart;
  let creditBlockH = 0;

  if (composerCredits && composerCredits.length > 0) {
    const topCredits = composerCredits
      .filter(c => c.charting > 0)
      .sort((a, b) => b.charting - a.charting)
      .slice(0, 3);

    if (topCredits.length > 0) {
      const creditY = bottomZoneStart + 14;
      const lineH = 22;

      // "Written by" label
      ctx.textAlign = 'center';
      ctx.fillStyle = '#8899AA';
      ctx.font = `400 14px "DM Sans", sans-serif`;
      ctx.fillText('Written by', dim.w / 2, creditY);

      // Each songwriter: name + publisher + charting count in teal
      topCredits.forEach((c, i) => {
        const y = creditY + 20 + i * lineH;
        const pubName = c.publisher ? c.publisher.split('/')[0].trim() : '';
        const truncPub = pubName.length > 25 ? pubName.slice(0, 24) + '\u2026' : pubName;
        const label = `${c.name}`;
        const pubLabel = truncPub ? ` \u2014 ${truncPub}` : '';
        const stat = ` (${c.charting} charting)`;

        ctx.font = `600 16px "DM Sans", sans-serif`;
        const labelW = ctx.measureText(label).width;
        ctx.font = `400 13px "DM Sans", sans-serif`;
        const pubW = ctx.measureText(pubLabel).width;
        ctx.font = `400 14px "JetBrains Mono", monospace`;
        const statW = ctx.measureText(stat).width;
        const totalW = labelW + pubW + statW;
        const startX = (dim.w - totalW) / 2;

        ctx.font = `600 16px "DM Sans", sans-serif`;
        ctx.fillStyle = t.textPrimary || '#F0EDE8';
        ctx.textAlign = 'left';
        ctx.fillText(label, startX, y);

        if (pubLabel) {
          ctx.font = `400 13px "DM Sans", sans-serif`;
          ctx.fillStyle = '#8899AA';
          ctx.fillText(pubLabel, startX + labelW, y);
        }

        ctx.font = `400 14px "JetBrains Mono", monospace`;
        ctx.fillStyle = '#3EE6C3'; // ND teal
        ctx.fillText(stat, startX + labelW + pubW, y);
        ctx.textAlign = 'center';
      });

      creditBlockH = 20 + topCredits.length * lineH + 8;

      // nashvilledecoder.com watermark
      ctx.fillStyle = '#4A5568';
      ctx.font = `400 11px "DM Sans", sans-serif`;
      ctx.fillText('nashvilledecoder.com', dim.w / 2, creditY + creditBlockH);
      creditBlockH += 16;
    }
  }

  // Date — in portrait, centered in bottom zone below grid (and credits if present).
  const dateFinalY = aspect === '3:4'
    ? bottomZoneStart + creditBlockH + Math.round((bottomZoneH - creditBlockH) * 0.6)
    : dim.h - 52;
  neonText(ctx, formatDate(weekDate), dim.w / 2, dateFinalY, `700 40px ${t.scriptFont}`, t);

  if (t.decorations.showSparkles) {
    const sx = dim.w - 28;
    const sparkleTopY = aspect === '3:4' ? bottomZoneStart + 20 : 28;
    const sparkleBottomY = aspect === '3:4' ? dim.h - 40 : dim.h - 28;
    drawSparkles(ctx, [[28, sparkleTopY], [sx, sparkleTopY], [28, sparkleBottomY], [sx, sparkleBottomY]], t.decorations.sparkleSize);
  }
  if (t.decorations.showNotes) drawNotes(ctx, t.decorations.noteSize);

  // Per-template post-processing (scanlines, textures, spotlight, etc.)
  postProcessGrid(ctx, t);

  // Custom user elements (text banners, images, shapes)
  if (allCustom.length > 0) {
    await drawCustomElements(ctx, allCustom, dim.w, dim.h);
  }

  // Premium finishing
  drawVignette(ctx, t.vignetteIntensity ?? 0.2);
  drawNoiseTexture(ctx, t.grainIntensity ?? 0.12);

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

  const autoOpts = getGridsForCount(slots.length);
  const autoLayout = autoOpts.logo[0] || autoOpts.exact.find(g => g.columns > 1 && g.rows > 1) || autoOpts.exact[0];
  if (autoLayout) {
    drawGridWithLayout(ctx, slots, images, logo, 0, 0, S, S, t, autoLayout);
  }

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
  layoutId?: string,
  titleTemplateId?: string,
  aspect: CarouselAspect = '1:1',
  composerCredits?: SlideComposerCredit[],
): Promise<CarouselOutput> {
  const total = 1 + slideGroups.length;
  onProgress?.(0, total);

  // Use dedicated title slide renderer if a titleTemplateId is provided
  const coverSlide = titleTemplateId
    ? await generateTitleSlide(coverFeature, weekDate, titleTemplateId, aspect)
    : await generateCoverSlide(coverFeature, weekDate, templateId);
  onProgress?.(1, total);

  const gridSlides: Blob[] = [];
  for (let i = 0; i < slideGroups.length; i++) {
    gridSlides.push(await generateGridSlide(slideGroups[i], weekDate, templateId, logoUrl, layoutId, aspect, undefined, composerCredits));
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
  templateIdOrTemplate: string | CarouselTemplate,
  size = 200,
): string {
  const t = typeof templateIdOrTemplate === 'string'
    ? getTemplate(templateIdOrTemplate)
    : templateIdOrTemplate;
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
