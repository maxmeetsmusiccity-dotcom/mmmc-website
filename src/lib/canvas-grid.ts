import type { SelectionSlot } from './selection';

const S = 1080; // canvas size
const BG_DARK = '#1E2433';
const GOLD = '#D4A843';
const SCRIPT_FONT = '"Dancing Script", cursive';
const BODY_FONT = '"DM Sans", sans-serif';

// Asset paths
const ASSETS = {
  logo: '/mmmc-logo.png',
  vinyl: '/assets/vinyl-bg.png',
  sparkle: '/assets/sparkle.png',
  chevron: '/assets/chevron.png',
  noteTL: '/assets/note-tl.png',
  noteTR: '/assets/note-tr.png',
  noteBL: '/assets/note-bl.png',
  noteBR: '/assets/note-br.png',
};

// Image cache
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
  await Promise.all(Object.values(ASSETS).map(loadImage));
}

function drawGoldText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, font: string, maxWidth?: number) {
  ctx.fillStyle = GOLD;
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  // Glow effect
  ctx.shadowColor = 'rgba(212, 168, 67, 0.4)';
  ctx.shadowBlur = 15;
  ctx.fillText(text, x, y, maxWidth);
  ctx.shadowColor = 'transparent';
}

function drawDecorations(ctx: CanvasRenderingContext2D) {
  const noteTL = imageCache.get(ASSETS.noteTL);
  const noteTR = imageCache.get(ASSETS.noteTR);
  const noteBL = imageCache.get(ASSETS.noteBL);
  const noteBR = imageCache.get(ASSETS.noteBR);
  const sparkle = imageCache.get(ASSETS.sparkle);

  if (noteTL) ctx.drawImage(noteTL, 95, 43, 52, 76);
  if (noteTR) ctx.drawImage(noteTR, 959, 45, 48, 73);
  if (noteBL) ctx.drawImage(noteBL, 86, 961, 60, 72);
  if (noteBR) ctx.drawImage(noteBR, 934, 963, 58, 69);

  if (sparkle) {
    ctx.drawImage(sparkle, 147, 189, 64, 64);
    ctx.drawImage(sparkle, 870, 843, 55, 55);
  }
}

function drawGridDecorations(ctx: CanvasRenderingContext2D) {
  const noteTL = imageCache.get(ASSETS.noteTL);
  const noteTR = imageCache.get(ASSETS.noteTR);
  const noteBL = imageCache.get(ASSETS.noteBL);
  const noteBR = imageCache.get(ASSETS.noteBR);
  const sparkle = imageCache.get(ASSETS.sparkle);

  if (noteTL) ctx.drawImage(noteTL, 95, 15, 42, 61);
  if (noteTR) ctx.drawImage(noteTR, 959, 16, 38, 59);
  if (noteBL) ctx.drawImage(noteBL, 86, 1005, 48, 58);
  if (noteBR) ctx.drawImage(noteBR, 940, 1007, 46, 55);

  if (sparkle) {
    ctx.drawImage(sparkle, 108, 232, 55, 55);
    ctx.drawImage(sparkle, 163, 310, 55, 55);
    ctx.drawImage(sparkle, 849, 853, 55, 55);
  }
}

function formatDate(weekDate: string): string {
  const d = new Date(weekDate + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
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

  // Background: vinyl record
  ctx.fillStyle = BG_DARK;
  ctx.fillRect(0, 0, S, S);
  const vinyl = imageCache.get(ASSETS.vinyl);
  if (vinyl) {
    ctx.globalAlpha = 0.6;
    ctx.drawImage(vinyl, 0, 0, S, S);
    ctx.globalAlpha = 1;
  }

  // Featured image with white border frame
  const featImg = await loadImage(coverFeature.track.cover_art_640);
  const frameX = 210, frameY = 210, frameSize = 661, border = 15;
  // White frame
  ctx.fillStyle = '#FFFFFF';
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 30;
  ctx.shadowOffsetX = 4;
  ctx.shadowOffsetY = 4;
  ctx.fillRect(frameX - border, frameY - border, frameSize + border * 2, frameSize + border * 2);
  ctx.shadowColor = 'transparent';
  // Image
  if (featImg) {
    ctx.drawImage(featImg, frameX, frameY, frameSize, frameSize);
  }

  // Chevron arrows
  const chevron = imageCache.get(ASSETS.chevron);
  if (chevron) {
    // Rotate 90° to point right
    ctx.save();
    ctx.translate(894 + 78, 471 + 69);
    ctx.rotate(Math.PI / 2);
    ctx.globalAlpha = 0.8;
    ctx.drawImage(chevron, -78, -69, 156, 138);
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // Text
  drawGoldText(ctx, 'New Music Friday', S / 2, 50, `700 58px ${SCRIPT_FONT}`);
  drawGoldText(ctx, 'Max Meets Music City', S / 2, 142, `italic 600 28px ${BODY_FONT}`);
  drawGoldText(ctx, 'Swipe right for all this week\'s picks', S / 2, 898, `600 22px ${BODY_FONT}`);
  drawGoldText(ctx, formatDate(weekDate), S / 2, 960, `700 52px ${SCRIPT_FONT}`);

  // Decorations
  drawDecorations(ctx);

  return new Promise(resolve => canvas.toBlob(b => resolve(b!), 'image/png'));
}

// ─── GRID COMPOSITE (standalone 3x3) ─────────────────────

function drawGrid(ctx: CanvasRenderingContext2D, slots: SelectionSlot[], images: (HTMLImageElement | null)[], logo: HTMLImageElement | null, offsetX: number, offsetY: number, gridSize: number) {
  const gap = Math.round(gridSize * 0.01);
  const cellSize = Math.floor((gridSize - gap * 4) / 3);

  const positions = [
    { x: offsetX + gap, y: offsetY + gap },
    { x: offsetX + gap + cellSize + gap, y: offsetY + gap },
    { x: offsetX + gap + (cellSize + gap) * 2, y: offsetY + gap },
    { x: offsetX + gap, y: offsetY + gap + cellSize + gap },
    // center = logo
    { x: offsetX + gap + (cellSize + gap) * 2, y: offsetY + gap + cellSize + gap },
    { x: offsetX + gap, y: offsetY + gap + (cellSize + gap) * 2 },
    { x: offsetX + gap + cellSize + gap, y: offsetY + gap + (cellSize + gap) * 2 },
    { x: offsetX + gap + (cellSize + gap) * 2, y: offsetY + gap + (cellSize + gap) * 2 },
  ];

  for (let i = 0; i < Math.min(slots.length, 8); i++) {
    const img = images[i];
    if (!img) continue;
    const pos = positions[i];

    ctx.save();
    const cx = pos.x + cellSize / 2;
    const cy = pos.y + cellSize / 2;
    const rad = (2 * Math.PI) / 180 * (i % 2 === 0 ? 1 : -1);
    ctx.translate(cx, cy);
    ctx.rotate(rad);
    ctx.translate(-cx, -cy);

    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    ctx.fillStyle = '#2A3A5C';
    ctx.fillRect(pos.x - 2, pos.y - 2, cellSize + 4, cellSize + 4);
    ctx.shadowColor = 'transparent';
    ctx.drawImage(img, pos.x, pos.y, cellSize, cellSize);
    ctx.restore();
  }

  // Center logo
  const logoX = offsetX + gap + cellSize + gap;
  const logoY = offsetY + gap + cellSize + gap;
  if (logo) {
    ctx.drawImage(logo, logoX, logoY, cellSize, cellSize);
  } else {
    ctx.fillStyle = '#162341';
    ctx.fillRect(logoX, logoY, cellSize, cellSize);
    ctx.fillStyle = GOLD;
    ctx.font = `bold ${Math.round(cellSize * 0.12)}px ${BODY_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('MMMC', logoX + cellSize / 2, logoY + cellSize / 2);
  }
}

// ─── GRID SLIDE (wrapped in carousel frame) ──────────────

export async function generateGridSlide(
  slots: SelectionSlot[],
  weekDate: string,
): Promise<Blob> {
  await loadAllAssets();

  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d')!;

  // Background
  ctx.fillStyle = BG_DARK;
  ctx.fillRect(0, 0, S, S);

  // Header
  drawGoldText(ctx, 'New Music Friday', S / 2, 16, `700 54px ${SCRIPT_FONT}`);

  // Load cover art images
  const imagePromises = slots.map(s => loadImage(s.track.cover_art_640));
  const logoPromise = loadImage(ASSETS.logo);
  const [images, logo] = await Promise.all([
    Promise.all(imagePromises),
    logoPromise,
  ]);

  // Draw 3x3 grid at (74, 85) size 933x933
  drawGrid(ctx, slots, images, logo, 74, 85, 933);

  // Date at bottom
  drawGoldText(ctx, formatDate(weekDate), S / 2, 1012, `700 46px ${SCRIPT_FONT}`);

  // Decorations
  drawGridDecorations(ctx);

  return new Promise(resolve => canvas.toBlob(b => resolve(b!), 'image/png'));
}

// ─── STANDALONE GRID (no frame, for preview) ─────────────

export async function generateGridComposite(
  slots: SelectionSlot[],
  logoUrl: string,
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = BG_DARK;
  ctx.fillRect(0, 0, S, S);

  const imagePromises = slots.map(s => loadImage(s.track.cover_art_640));
  const logoPromise = loadImage(logoUrl);
  const [images, logo] = await Promise.all([
    Promise.all(imagePromises),
    logoPromise,
  ]);

  drawGrid(ctx, slots, images, logo, 0, 0, S);

  return new Promise(resolve => canvas.toBlob(b => resolve(b!), 'image/png'));
}

// ─── FULL CAROUSEL GENERATION ────────────────────────────

export interface CarouselOutput {
  coverSlide: Blob;
  gridSlides: Blob[];
  allSlides: Blob[]; // cover first, then grids in order
}

export async function generateFullCarousel(
  slideGroups: SelectionSlot[][],
  coverFeature: SelectionSlot,
  weekDate: string,
): Promise<CarouselOutput> {
  const coverSlide = await generateCoverSlide(coverFeature, weekDate);
  const gridSlides: Blob[] = [];
  for (const group of slideGroups) {
    gridSlides.push(await generateGridSlide(group, weekDate));
  }
  return {
    coverSlide,
    gridSlides,
    allSlides: [coverSlide, ...gridSlides],
  };
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
