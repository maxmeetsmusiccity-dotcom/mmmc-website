import type { SelectionSlot } from './selection';

const CANVAS_SIZE = 1080;
const GAP = 10;
const CELL_SIZE = Math.floor((CANVAS_SIZE - GAP * 4) / 3);
const BG_COLOR = '#0F1B33';
const BORDER_COLOR = '#2A3A5C';
const ROTATION_DEG = 2;

function getCellPosition(index: number): { x: number; y: number } {
  // 3x3 grid positions, skipping center (index 4)
  const positions = [
    { x: GAP, y: GAP },                                    // 0: top-left
    { x: GAP + CELL_SIZE + GAP, y: GAP },                  // 1: top-center
    { x: GAP + (CELL_SIZE + GAP) * 2, y: GAP },            // 2: top-right
    { x: GAP, y: GAP + CELL_SIZE + GAP },                  // 3: mid-left
    // center is logo
    { x: GAP + (CELL_SIZE + GAP) * 2, y: GAP + CELL_SIZE + GAP },   // 4: mid-right
    { x: GAP, y: GAP + (CELL_SIZE + GAP) * 2 },            // 5: bottom-left
    { x: GAP + CELL_SIZE + GAP, y: GAP + (CELL_SIZE + GAP) * 2 },   // 6: bottom-center
    { x: GAP + (CELL_SIZE + GAP) * 2, y: GAP + (CELL_SIZE + GAP) * 2 }, // 7: bottom-right
  ];
  return positions[index] || positions[0];
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export async function generateGridComposite(
  slots: SelectionSlot[],
  logoUrl: string,
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_SIZE;
  canvas.height = CANVAS_SIZE;
  const ctx = canvas.getContext('2d')!;

  // Background
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  // Load all images in parallel
  const imagePromises = slots.map(s =>
    loadImage(s.track.cover_art_640).catch(() => null)
  );
  const logoPromise = loadImage(logoUrl).catch(() => null);
  const [images, logo] = await Promise.all([
    Promise.all(imagePromises),
    logoPromise,
  ]);

  // Draw cover art cells
  for (let i = 0; i < Math.min(slots.length, 8); i++) {
    const img = images[i];
    if (!img) continue;
    const pos = getCellPosition(i);

    ctx.save();

    // Slight rotation
    const cx = pos.x + CELL_SIZE / 2;
    const cy = pos.y + CELL_SIZE / 2;
    const rad = (ROTATION_DEG * Math.PI) / 180 * (i % 2 === 0 ? 1 : -1);
    ctx.translate(cx, cy);
    ctx.rotate(rad);
    ctx.translate(-cx, -cy);

    // Shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

    // Border
    ctx.fillStyle = BORDER_COLOR;
    ctx.fillRect(pos.x - 2, pos.y - 2, CELL_SIZE + 4, CELL_SIZE + 4);

    // Image
    ctx.shadowColor = 'transparent';
    ctx.drawImage(img, pos.x, pos.y, CELL_SIZE, CELL_SIZE);

    ctx.restore();
  }

  // Center logo
  const centerX = GAP + CELL_SIZE + GAP;
  const centerY = GAP + CELL_SIZE + GAP;
  if (logo) {
    ctx.drawImage(logo, centerX, centerY, CELL_SIZE, CELL_SIZE);
  } else {
    // Fallback: draw text
    ctx.fillStyle = '#162341';
    ctx.fillRect(centerX, centerY, CELL_SIZE, CELL_SIZE);
    ctx.fillStyle = '#D4A843';
    ctx.font = 'bold 36px "DM Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('MMMC', centerX + CELL_SIZE / 2, centerY + CELL_SIZE / 2);
  }

  return new Promise((resolve) => {
    canvas.toBlob(blob => resolve(blob!), 'image/png');
  });
}

export async function generateAllGridComposites(
  slideGroups: SelectionSlot[][],
  logoUrl: string,
): Promise<Blob[]> {
  const blobs: Blob[] = [];
  for (const group of slideGroups) {
    const blob = await generateGridComposite(group, logoUrl);
    blobs.push(blob);
  }
  return blobs;
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
