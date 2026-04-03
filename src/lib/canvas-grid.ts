import type { SelectionSlot } from './selection';

const S = 1080;
const BG = '#0F1B33';
const GOLD = '#D4A843';
const SCRIPT = '"Dancing Script", cursive';
const BODY = '"DM Sans", sans-serif';

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

async function loadAllAssets(): Promise<void> {
  await Promise.all([
    ...Object.values(ASSETS).map(loadImage),
    document.fonts.load(`700 56px ${SCRIPT}`).catch(() => {}),
    document.fonts.load(`600 26px ${BODY}`).catch(() => {}),
  ]);
}

function neonText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, font: string) {
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  // Pass 1: wide soft outer glow
  ctx.shadowColor = 'rgba(212, 168, 67, 0.25)';
  ctx.shadowBlur = 45;
  ctx.fillStyle = 'rgba(212, 168, 67, 0.3)';
  ctx.fillText(text, x, y);
  // Pass 2: medium glow
  ctx.shadowColor = 'rgba(212, 168, 67, 0.5)';
  ctx.shadowBlur = 20;
  ctx.fillStyle = 'rgba(230, 195, 100, 0.7)';
  ctx.fillText(text, x, y);
  // Pass 3: tight bright core
  ctx.shadowColor = 'rgba(255, 225, 140, 0.8)';
  ctx.shadowBlur = 6;
  ctx.fillStyle = '#F5E6B8';
  ctx.fillText(text, x, y);
  ctx.shadowColor = 'transparent';
}

function goldRule(ctx: CanvasRenderingContext2D, y: number) {
  ctx.strokeStyle = 'rgba(212, 168, 67, 0.5)';
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

function vinylGrooves(ctx: CanvasRenderingContext2D) {
  const cx = S / 2, cy = S / 2;
  // Radial gradient: center slightly lighter
  const grad = ctx.createRadialGradient(cx, cy, 80, cx, cy, 520);
  grad.addColorStop(0, 'rgba(30, 36, 51, 0.4)');
  grad.addColorStop(1, 'rgba(10, 15, 30, 0.3)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, S, S);
  // 60+ concentric groove rings
  for (let r = 80; r <= 520; r += 7) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = r % 14 === 0 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }
  // Highlight arc across upper-left for light reflection
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
): Promise<Blob> {
  await loadAllAssets();
  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d')!;

  // Background
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, S, S);

  // Vinyl background
  const vinyl = imageCache.get(ASSETS.vinyl);
  if (vinyl) {
    ctx.globalAlpha = 0.5;
    ctx.drawImage(vinyl, 0, 0, S, S);
    ctx.globalAlpha = 1;
  }
  vinylGrooves(ctx);

  // Featured image (reduced to 560px for text room)
  const featImg = await loadImage(coverFeature.track.cover_art_640);
  const imgSize = 560, border = 14;
  const imgX = (S - imgSize) / 2, imgY = 180;

  // White frame with drop shadow
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 32;
  ctx.shadowOffsetY = 10;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(imgX - border, imgY - border, imgSize + border * 2, imgSize + border * 2);
  ctx.shadowColor = 'transparent';
  if (featImg) {
    ctx.drawImage(featImg, imgX, imgY, imgSize, imgSize);
  }

  // Artist name + song title below image
  const textY = imgY + imgSize + border + 16;
  neonText(ctx, coverFeature.track.artist_names, S / 2, textY, `700 38px ${SCRIPT}`);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `500 26px ${BODY}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(coverFeature.track.track_name, S / 2, textY + 48);

  // Header
  neonText(ctx, 'New Music Friday', S / 2, 42, `700 56px ${SCRIPT}`);
  goldRule(ctx, 108);
  neonText(ctx, 'Max Meets Music City', S / 2, 118, `italic 600 26px ${BODY}`);

  // "Swipe right" pill
  const swipeY = 900;
  const swipeText = 'Swipe right for all this week\'s picks';
  ctx.font = `600 22px ${SCRIPT}`;
  const swipeW = ctx.measureText(swipeText).width + 40;
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  const pillX = (S - swipeW) / 2;
  ctx.beginPath();
  ctx.roundRect(pillX, swipeY - 4, swipeW, 36, 18);
  ctx.fill();
  neonText(ctx, swipeText, S / 2, swipeY, `600 22px ${SCRIPT}`);

  // Date
  neonText(ctx, formatDate(weekDate), S / 2, 960, `700 48px ${SCRIPT}`);

  // Gold chevron arrows (path shapes, not text)
  ctx.save();
  ctx.shadowColor = 'rgba(212,168,67,0.6)';
  ctx.shadowBlur = 14;
  ctx.fillStyle = GOLD;
  for (let dx = 0; dx < 2; dx++) {
    const bx = 940 + dx * 30;
    const by = S / 2;
    ctx.beginPath();
    ctx.moveTo(bx, by - 28);
    ctx.lineTo(bx + 20, by);
    ctx.lineTo(bx, by + 28);
    ctx.lineTo(bx + 6, by + 28);
    ctx.lineTo(bx + 26, by);
    ctx.lineTo(bx + 6, by - 28);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Decorations
  drawNotes(ctx, 52);
  drawSparkles(ctx, [[160, 160], [920, 900]], 48);

  return new Promise(resolve => canvas.toBlob(b => resolve(b!), 'image/png'));
}

// ─── GRID SLIDE ──────────────────────────────────────────

const GRID_ROTATIONS = [-0.6, 0.4, -0.3, 0.5, 0, -0.7, 0.3, -0.5];

function drawGrid(
  ctx: CanvasRenderingContext2D,
  slots: SelectionSlot[],
  images: (HTMLImageElement | null)[],
  logo: HTMLImageElement | null,
  ox: number, oy: number, gridSize: number,
) {
  const gap = Math.round(gridSize * 0.005); // tight 4-6px gaps
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
    const rot = (GRID_ROTATIONS[i] * Math.PI) / 180;

    ctx.save();
    const cx = pos.x + cell / 2;
    const cy = pos.y + cell / 2;
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.translate(-cx, -cy);

    // Shadow
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    ctx.fillStyle = '#2A3A5C';
    ctx.fillRect(pos.x - 2, pos.y - 2, cell + 4, cell + 4);
    ctx.shadowColor = 'transparent';

    // Image
    ctx.drawImage(img, pos.x, pos.y, cell, cell);

    ctx.restore();
  }

  // Center logo
  const logoX = ox + gap + cell + gap;
  const logoY = oy + gap + cell + gap;
  if (logo) {
    ctx.drawImage(logo, logoX, logoY, cell, cell);
  } else {
    ctx.fillStyle = '#162341';
    ctx.fillRect(logoX, logoY, cell, cell);
    ctx.fillStyle = GOLD;
    ctx.font = `bold ${Math.round(cell * 0.12)}px ${BODY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('MMMC', logoX + cell / 2, logoY + cell / 2);
  }
}

export async function generateGridSlide(
  slots: SelectionSlot[],
  weekDate: string,
): Promise<Blob> {
  await loadAllAssets();
  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, S, S);

  // Header
  neonText(ctx, 'New Music Friday', S / 2, 16, `700 52px ${SCRIPT}`);
  goldRule(ctx, 78);

  // Load images
  const imagePromises = slots.map(s => loadImage(s.track.cover_art_640));
  const logoPromise = loadImage(ASSETS.logo);
  const [images, logo] = await Promise.all([Promise.all(imagePromises), logoPromise]);

  // Grid at (74, 90) size 932x932
  drawGrid(ctx, slots, images, logo, 74, 90, 932);

  // Date
  neonText(ctx, formatDate(weekDate), S / 2, 1028, `700 40px ${SCRIPT}`);

  // Corner sparkles — outside grid bounds
  drawSparkles(ctx, [[28, 28], [1052, 28], [28, 1052], [1052, 1052]], 36);

  // Corner notes
  drawNotes(ctx, 52);

  return new Promise(resolve => canvas.toBlob(b => resolve(b!), 'image/png'));
}

// ─── STANDALONE GRID (for preview only) ──────────────────

export async function generateGridComposite(
  slots: SelectionSlot[],
  logoUrl: string,
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, S, S);

  const imagePromises = slots.map(s => loadImage(s.track.cover_art_640));
  const logoPromise = loadImage(logoUrl);
  const [images, logo] = await Promise.all([Promise.all(imagePromises), logoPromise]);

  drawGrid(ctx, slots, images, logo, 0, 0, S);

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
): Promise<CarouselOutput> {
  const total = 1 + slideGroups.length;
  onProgress?.(0, total);

  const coverSlide = await generateCoverSlide(coverFeature, weekDate);
  onProgress?.(1, total);

  const gridSlides: Blob[] = [];
  for (let i = 0; i < slideGroups.length; i++) {
    gridSlides.push(await generateGridSlide(slideGroups[i], weekDate));
    onProgress?.(2 + i, total);
  }

  return { coverSlide, gridSlides, allSlides: [coverSlide, ...gridSlides] };
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
