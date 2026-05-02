import type {
  V2CarouselBodyTemplate,
  V2GridConfig,
  V2RenderBodyOptions,
  V2RenderTitleOptions,
  V2Template,
  V2TrackRenderData,
} from './template-types-v2';

const imageCache = new Map<string, Promise<HTMLImageElement | null>>();

export function loadImage(src?: string): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null);
  const cached = imageCache.get(src);
  if (cached) return cached;

  const request = new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
  imageCache.set(src, request);
  return request;
}

export function clearV2ImageCache(): void {
  imageCache.clear();
}

export function radians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function normalizeV2TemplateId(id: string): string {
  return id.replace(/-/g, '_');
}

export function isV2Template(template: { engine?: string }): template is V2Template {
  return template.engine === 'v2';
}

export function defaultV2Grid(cols: number, rows: number): V2GridConfig {
  const cells = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      cells.push({ col, row, colSpan: 1, rowSpan: 1, type: 'cover' as const });
    }
  }
  return { id: `${cols}x${rows}`, cols, rows, cells };
}

export function v2GridFromLegacy(config: {
  id?: string;
  columns: number;
  rows: number;
  logoIndex: number;
  cells: Array<{ col: number; row: number; colSpan: number; rowSpan: number }>;
}): V2GridConfig {
  return {
    id: config.id,
    cols: config.columns,
    rows: config.rows,
    cells: config.cells.map((cell, index) => ({
      ...cell,
      type: index === config.logoIndex ? 'logo' : 'cover',
    })),
  };
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  if (r <= 0) {
    ctx.rect(x, y, w, h);
    return;
  }
  if (r >= 999) {
    ctx.arc(x + w / 2, y + h / 2, Math.min(w, h) / 2, 0, Math.PI * 2);
    return;
  }

  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  if (!img) {
    const gradient = ctx.createLinearGradient(x, y, x + w, y + h);
    gradient.addColorStop(0, '#3a4a6a');
    gradient.addColorStop(1, '#1a2238');
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, w, h);
    return;
  }

  const sourceAspect = img.width / img.height;
  const targetAspect = w / h;
  let sw: number;
  let sh: number;
  let sx: number;
  let sy: number;
  if (sourceAspect > targetAspect) {
    sh = img.height;
    sw = sh * targetAspect;
    sx = (img.width - sw) / 2;
    sy = 0;
  } else {
    sw = img.width;
    sh = sw / targetAspect;
    sx = 0;
    sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function drawBackground(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  template: V2Template,
): void {
  const { palette, decoration } = template;
  ctx.fillStyle = palette.bg;
  ctx.fillRect(0, 0, w, h);

  if (decoration === 'neon-grid') {
    ctx.save();
    ctx.strokeStyle = palette.accent;
    ctx.globalAlpha = 0.08;
    ctx.lineWidth = 1;
    const step = w / 24;
    for (let x = 0; x <= w; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y <= h; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  if (decoration === 'spotlight') {
    const cx = w / 2;
    const cy = h * 0.4;
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.7);
    gradient.addColorStop(0, 'rgba(255,210,74,0.18)');
    gradient.addColorStop(0.5, 'rgba(255,210,74,0.05)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
  }

  if (decoration === 'sunburst-rays') {
    ctx.save();
    ctx.translate(w * 0.5, -h * 0.2);
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = '#D97757';
    for (let i = 0; i < 18; i++) {
      ctx.save();
      ctx.rotate((i / 18) * Math.PI * 2);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-w * 0.04, h * 1.5);
      ctx.lineTo(w * 0.04, h * 1.5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  if (decoration === 'velvet-curtain') {
    for (let i = 0; i < 8; i++) {
      const x = (i / 8) * w + w / 16;
      const gradient = ctx.createLinearGradient(x - 30, 0, x + 30, 0);
      gradient.addColorStop(0, 'rgba(255,105,180,0)');
      gradient.addColorStop(0.5, 'rgba(255,105,180,0.04)');
      gradient.addColorStop(1, 'rgba(255,105,180,0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(x - 30, 0, 60, h);
    }
  }
}

function drawDecoration(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  template: V2Template,
): void {
  const { palette, decoration } = template;
  if (decoration === 'gold-frame') {
    ctx.save();
    ctx.strokeStyle = palette.accent2 ?? palette.accent;
    ctx.lineWidth = 2;
    ctx.strokeRect(20, 20, w - 40, h - 40);
    ctx.lineWidth = 0.5;
    ctx.strokeRect(28, 28, w - 56, h - 56);
    ctx.restore();
  }

  if (decoration === 'marquee-bulbs') {
    ctx.save();
    const r = 6;
    const inset = 30;
    ctx.fillStyle = palette.accent;
    ctx.shadowColor = palette.accent;
    ctx.shadowBlur = 12;
    for (let i = 0; i < 16; i++) {
      const x = inset + ((w - inset * 2) / 15) * i;
      ctx.beginPath();
      ctx.arc(x, inset, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, h - inset, r, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let i = 1; i < 7; i++) {
      const y = inset + ((h - inset * 2) / 7) * i;
      ctx.beginPath();
      ctx.arc(inset, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(w - inset, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  if (decoration === 'rope-frame') {
    ctx.save();
    ctx.strokeStyle = palette.accent;
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 4]);
    ctx.strokeRect(24, 24, w - 48, h - 48);
    ctx.restore();
  }
}

function drawVinylDisc(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  opacity = 1,
): void {
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.fillStyle = '#0a0a0a';
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 0.6;
  for (let r = radius * 0.35; r < radius - 2; r += 2) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.04, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawVinylPeek(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  opacity: number,
): void {
  ctx.save();
  ctx.globalAlpha = opacity;
  drawVinylDisc(ctx, x + w * 1.05, y + h * 0.5, h * 0.55, 1);
  ctx.restore();
}

function drawGrain(ctx: CanvasRenderingContext2D, w: number, h: number, opacity = 0.05): void {
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 255 * opacity;
    data[i] = Math.max(0, Math.min(255, data[i] + noise));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
  }
  ctx.putImageData(imageData, 0, 0);
}

function drawScanlines(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = '#000';
  for (let y = 0; y < h; y += 3) {
    ctx.fillRect(0, y, w, 1);
  }
  ctx.restore();
}

function applySepia(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  strength = 0.4,
): void {
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const sepiaR = 0.393 * r + 0.769 * g + 0.189 * b;
    const sepiaG = 0.349 * r + 0.686 * g + 0.168 * b;
    const sepiaB = 0.272 * r + 0.534 * g + 0.131 * b;
    data[i] = r * (1 - strength) + sepiaR * strength;
    data[i + 1] = g * (1 - strength) + sepiaG * strength;
    data[i + 2] = b * (1 - strength) + sepiaB * strength;
  }
  ctx.putImageData(imageData, 0, 0);
}

function drawHalftone(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  color: string,
): void {
  ctx.save();
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.06;
  const step = 6;
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const offset = (Math.floor(y / step) % 2) * (step / 2);
      ctx.beginPath();
      ctx.arc(x + offset, y, 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawVignette(ctx: CanvasRenderingContext2D, w: number, h: number, strength = 0.25): void {
  const gradient = ctx.createRadialGradient(w / 2, h / 2, w * 0.3, w / 2, h / 2, w * 0.75);
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(1, `rgba(0,0,0,${strength})`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);
}

function drawPostProcess(ctx: CanvasRenderingContext2D, w: number, h: number, template: V2Template): void {
  if (template.postProcess === 'scanlines') drawScanlines(ctx, w, h);
  if (template.postProcess === 'sepia') applySepia(ctx, w, h, 0.35);
  if (template.postProcess === 'halftone') drawHalftone(ctx, w, h, template.palette.accent);
  if (template.postProcess === 'spotlight') {
    const gradient = ctx.createRadialGradient(w / 2, h / 2, w * 0.2, w / 2, h / 2, w * 0.7);
    gradient.addColorStop(0, 'rgba(255,210,74,0)');
    gradient.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
  }
  if (template.showGrain) drawGrain(ctx, w, h, template.grainOpacity ?? 0.04);
  drawVignette(ctx, w, h, 0.18);
}

function neonText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  opts: {
    font: string;
    color: string;
    glowColor?: string;
    glowSize?: number;
    intensity?: number;
    align?: CanvasTextAlign;
    baseline?: CanvasTextBaseline;
  },
): void {
  const {
    font,
    color,
    glowColor = color,
    glowSize = 18,
    intensity = 0.85,
    align = 'center',
    baseline = 'middle',
  } = opts;

  ctx.save();
  ctx.font = font;
  const metrics = ctx.measureText(text);
  const textW = metrics.width;
  const pxMatch = font.match(/(\d+(?:\.\d+)?)px/);
  const textH = (pxMatch ? parseFloat(pxMatch[1]) : 40) * 1.4;
  ctx.restore();

  if (!text.trim() || textW <= 0 || textH <= 0) return;

  const offscreen = document.createElement('canvas');
  offscreen.width = Math.ceil(textW + glowSize * 4);
  offscreen.height = Math.ceil(textH + glowSize * 4);
  const offscreenCtx = offscreen.getContext('2d');
  if (!offscreenCtx) return;

  offscreenCtx.font = font;
  offscreenCtx.textAlign = 'center';
  offscreenCtx.textBaseline = 'middle';
  const cx = offscreen.width / 2;
  const cy = offscreen.height / 2;

  offscreenCtx.shadowColor = glowColor;
  offscreenCtx.shadowBlur = glowSize * 2;
  offscreenCtx.fillStyle = glowColor;
  offscreenCtx.globalAlpha = intensity * 0.6;
  offscreenCtx.fillText(text, cx, cy);
  offscreenCtx.shadowBlur = glowSize;
  offscreenCtx.globalAlpha = intensity;
  offscreenCtx.fillText(text, cx, cy);
  offscreenCtx.shadowBlur = glowSize * 0.5;
  offscreenCtx.fillText(text, cx, cy);
  offscreenCtx.shadowBlur = 0;
  offscreenCtx.fillStyle = '#ffffff';
  offscreenCtx.globalAlpha = 1;
  offscreenCtx.fillText(text, cx, cy);

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  let drawX = x;
  if (align === 'center') drawX = x - offscreen.width / 2;
  else if (align === 'right') drawX = x - offscreen.width;
  let drawY = y;
  if (baseline === 'middle') drawY = y - offscreen.height / 2;
  else if (baseline === 'bottom') drawY = y - offscreen.height;
  ctx.drawImage(offscreen, drawX, drawY);
  ctx.restore();
}

function drawCoverCell(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
  rotate: number,
  shadow: boolean,
): void {
  ctx.save();
  if (rotate) {
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate(radians(rotate));
    ctx.translate(-(x + w / 2), -(y + h / 2));
  }
  if (shadow) {
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = w * 0.04;
    ctx.shadowOffsetY = h * 0.015;
  }
  ctx.beginPath();
  roundRect(ctx, x, y, w, h, radius);
  ctx.save();
  ctx.clip();
  drawImageCover(ctx, img, x, y, w, h);
  ctx.restore();
  ctx.restore();
}

function drawLogoCell(
  ctx: CanvasRenderingContext2D,
  logoImg: HTMLImageElement | null,
  x: number,
  y: number,
  w: number,
  h: number,
  template: V2CarouselBodyTemplate,
): void {
  ctx.save();
  ctx.fillStyle = template.palette.accent2 ?? template.palette.accent;
  roundRect(ctx, x, y, w, h, template.cellRadius);
  ctx.fill();
  if (logoImg) {
    const pad = w * 0.18;
    drawImageCover(ctx, logoImg, x + pad, y + pad, w - pad * 2, h - pad * 2);
  } else {
    ctx.fillStyle = template.palette.bg;
    ctx.font = `italic 700 ${w * 0.18}px ${template.fonts.display}, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('NMF', x + w / 2, y + h / 2);
  }
  ctx.restore();
}

function drawSwipePill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  style: string,
  template: V2Template,
): void {
  const { palette, fonts } = template;
  ctx.save();
  let fillColor = palette.accent;
  let textColor = palette.bg;
  let radius = h / 2;
  let outline = false;

  if (style === 'gold-pill') fillColor = palette.accent2 ?? palette.accent;
  if (style === 'rose-tag') {
    fillColor = palette.accent2 ?? palette.accent;
    radius = 4;
  }
  if (style === 'neon-pill') {
    fillColor = 'transparent';
    outline = true;
    textColor = palette.accent;
  }
  if (style === 'ink-stamp') {
    fillColor = 'transparent';
    outline = true;
    textColor = palette.accent;
    radius = 0;
  }
  if (style === 'minimal-rule') {
    fillColor = 'transparent';
    textColor = palette.accent;
  }
  if (style === 'rope-tag' || style === 'tape-label') radius = 2;

  if (style !== 'minimal-rule') {
    if (fillColor !== 'transparent') {
      ctx.fillStyle = fillColor;
      roundRect(ctx, x, y, w, h, radius);
      ctx.fill();
    }
    if (outline) {
      ctx.strokeStyle = textColor;
      ctx.lineWidth = 1.5;
      roundRect(ctx, x, y, w, h, radius);
      ctx.stroke();
    }
  } else {
    ctx.strokeStyle = textColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y);
    ctx.stroke();
  }

  ctx.fillStyle = textColor;
  ctx.font = `600 ${Math.round(h * 0.42)}px ${fonts.mono ?? 'JetBrains Mono'}, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Swipe ->', x + w / 2, y + h / 2 + (style === 'minimal-rule' ? h / 2 + 2 : 0));
  ctx.restore();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawSubtitle(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  template: V2Template,
  w: number,
  align: CanvasTextAlign = 'center',
): void {
  ctx.save();
  ctx.fillStyle = template.palette.textMuted ?? template.palette.text;
  ctx.font = `500 ${w * 0.02}px ${template.fonts.mono ?? 'JetBrains Mono'}, monospace`;
  ctx.textAlign = align;
  ctx.textBaseline = 'top';
  ctx.fillText(text.toUpperCase().split('').join(' '), x, y);
  ctx.restore();
}

function drawTitleText(
  ctx: CanvasRenderingContext2D,
  title: string,
  edition: string | undefined,
  x: number,
  y: number,
  maxW: number,
  template: V2Template,
  opts: { align?: CanvasTextAlign; editionSize?: number; titleSize?: number } = {},
): number {
  const align = opts.align ?? 'center';
  const editionSize = opts.editionSize ?? 22;
  if (edition) {
    ctx.save();
    ctx.fillStyle = template.palette.accent2 ?? template.palette.accent;
    ctx.font = `500 ${editionSize}px ${template.fonts.mono ?? 'JetBrains Mono'}, monospace`;
    ctx.textAlign = align;
    ctx.textBaseline = 'top';
    ctx.fillText(edition.toUpperCase(), x, y);
    ctx.restore();
  }

  const titleY = y + (edition ? editionSize + 16 : 0);
  const titleSize = opts.titleSize ?? 84;
  if (template.kind === 'title' && template.titleStyle === 'neon-glow') {
    neonText(ctx, title, x, titleY + titleSize / 2, {
      font: `700 ${titleSize}px ${template.fonts.display}, sans-serif`,
      color: template.palette.accent,
      glowColor: template.palette.accent,
      glowSize: 22,
      intensity: 1,
      align,
      baseline: 'middle',
    });
    return titleY + titleSize + 12;
  }

  let titleFont = `italic 600 ${titleSize}px ${template.fonts.display}, serif`;
  if (template.kind === 'title' && template.titleStyle === 'sans-bold') {
    titleFont = `800 ${titleSize}px ${template.fonts.display}, sans-serif`;
  }
  if (template.kind === 'title' && template.titleStyle === 'serif-display-huge') {
    titleFont = `700 ${Math.round(titleSize * 1.2)}px ${template.fonts.display}, serif`;
  }

  ctx.save();
  ctx.fillStyle = template.palette.text;
  ctx.font = titleFont;
  ctx.textAlign = align;
  ctx.textBaseline = 'top';
  const lines = wrapText(ctx, title, maxW);
  lines.forEach((line, index) => {
    ctx.fillText(line, x, titleY + index * titleSize * 1.05);
  });
  ctx.restore();
  return titleY + lines.length * titleSize * 1.05 + 12;
}

export async function renderTitleSlide(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  opts: V2RenderTitleOptions,
): Promise<void> {
  const { template, title, edition, subtitle, featured, count } = opts;
  const featuredImg = await loadImage(featured?.cover);

  drawBackground(ctx, w, h, template);
  drawDecoration(ctx, w, h, template);

  const featuredSize = template.featuredSize || 0.45;
  const featW = w * featuredSize;
  const featH = featW;

  if (template.layout === 'vinyl-disc') {
    const cx = w / 2;
    const cy = h * 0.42;
    const vinylR = featW * 0.95;
    drawVinylDisc(ctx, cx, cy, vinylR, 0.95);
    const labelR = featW * 0.5;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, labelR, 0, Math.PI * 2);
    ctx.clip();
    drawImageCover(ctx, featuredImg, cx - labelR, cy - labelR, labelR * 2, labelR * 2);
    ctx.restore();
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(cx, cy, labelR * 0.06, 0, Math.PI * 2);
    ctx.fill();
    const after = drawTitleText(ctx, title, edition, w / 2, cy + vinylR + 24, w * 0.85, template, {
      titleSize: w * 0.07,
      editionSize: w * 0.022,
    });
    drawSubtitle(ctx, subtitle ?? `${count} new tracks`, w / 2, after, template, w);
  } else if (template.layout === 'magazine-bleed') {
    const square = Math.min(w, h * 0.55);
    const fx = (w - square) / 2;
    drawCoverCell(ctx, featuredImg, fx, 0, square, square, 0, 0, false);
    const gradient = ctx.createLinearGradient(0, square * 0.65, 0, square);
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(1, template.palette.bg);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, square * 0.65, w, square * 0.4);
    const after = drawTitleText(ctx, title, edition, w / 2, square + h * 0.04, w * 0.9, template, {
      titleSize: w * 0.1,
      editionSize: w * 0.022,
    });
    drawSubtitle(ctx, subtitle ?? `${count} new tracks`, w / 2, after, template, w);
  } else if (template.layout === 'split-half') {
    const square = Math.min(w * 0.5, h * 0.7);
    const fy = (h - square) / 2;
    drawCoverCell(ctx, featuredImg, 0, fy, square, square, 0, 0, false);
    const tx = square + w * 0.04;
    const ty = h * 0.32;
    ctx.save();
    ctx.fillStyle = template.palette.accent2 ?? template.palette.accent;
    ctx.font = `500 ${w * 0.022}px ${template.fonts.mono ?? 'JetBrains Mono'}, monospace`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText((edition ?? '').toUpperCase(), tx, ty);
    ctx.restore();
    const after = drawTitleText(ctx, title, undefined, tx, ty + 40, w - tx - w * 0.04, template, {
      align: 'left',
      titleSize: w * 0.085,
    });
    drawSubtitle(ctx, subtitle ?? `${count} new tracks`, tx, after + 18, template, w, 'left');
  } else if (template.layout === 'edition-number') {
    ctx.save();
    ctx.fillStyle = template.palette.accent2 ?? template.palette.accent;
    ctx.font = `500 ${w * 0.022}px ${template.fonts.mono ?? 'JetBrains Mono'}, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText((edition ?? '').toUpperCase(), w / 2, h * 0.18);
    ctx.fillStyle = template.palette.accent;
    ctx.font = `italic 700 ${w * 0.5}px ${template.fonts.display}, serif`;
    ctx.textBaseline = 'middle';
    ctx.fillText((edition ?? '').match(/\d+/)?.[0] ?? '01', w / 2, h * 0.5);
    ctx.fillStyle = template.palette.text;
    ctx.font = `italic 600 ${w * 0.06}px ${template.fonts.display}, serif`;
    ctx.textBaseline = 'top';
    ctx.fillText(title, w / 2, h * 0.78);
    ctx.restore();
    drawSubtitle(ctx, subtitle ?? `${count} new tracks`, w / 2, h * 0.78 + w * 0.07, template, w);
  } else {
    const fx = (w - featW) / 2;
    const fy = h * (template.layout === 'poster-stamped' ? 0.16 : 0.2);
    if (template.layout === 'spotlight') {
      const gradient = ctx.createRadialGradient(w / 2, fy + featH / 2, 0, w / 2, fy + featH / 2, featW * 0.9);
      gradient.addColorStop(0, 'rgba(255,210,74,.25)');
      gradient.addColorStop(1, 'rgba(255,210,74,0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);
    }
    drawCoverCell(
      ctx,
      featuredImg,
      fx,
      fy,
      featW,
      featH,
      template.featuredRadius,
      template.featuredRotate,
      true,
    );
    const after = drawTitleText(ctx, title, edition, w / 2, fy + featH + 32, w * 0.85, template, {
      titleSize: w * 0.075,
      editionSize: w * 0.022,
    });
    drawSubtitle(ctx, subtitle ?? `${count} new tracks`, w / 2, after, template, w);
  }

  if (template.showSwipePill) {
    const pillW = w * 0.28;
    const pillH = w * 0.055;
    drawSwipePill(ctx, (w - pillW) / 2, h - pillH - h * 0.04, pillW, pillH, template.swipePillStyle, template);
  }
  drawPostProcess(ctx, w, h, template);
}

export async function renderBodySlide(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  opts: V2RenderBodyOptions,
): Promise<void> {
  const { template, grid, tracks, logo, edition } = opts;
  drawBackground(ctx, w, h, template);
  drawDecoration(ctx, w, h, template);

  const margin = w * 0.06;
  const availableW = w - margin * 2;
  const availableH = h - margin * 2 - h * 0.06;
  const cellSize = Math.min(availableW / grid.cols, availableH / grid.rows);
  const gridPxW = cellSize * grid.cols;
  const gridPxH = cellSize * grid.rows;
  const gridX = margin + (availableW - gridPxW) / 2;
  const gridY = margin + (availableH - gridPxH) / 2;

  const trackImages = await Promise.all(tracks.map((track) => loadImage(track.cover)));
  const logoImg = await loadImage(logo);

  let coverIndex = 0;
  for (let i = 0; i < grid.cells.length; i++) {
    const cell = grid.cells[i];
    const x = gridX + cell.col * cellSize;
    const y = gridY + cell.row * cellSize;
    const cw = cell.colSpan * cellSize;
    const ch = cell.rowSpan * cellSize;
    const inset = template.cellPadding * 0.5;
    const ix = x + inset;
    const iy = y + inset;
    const iw = cw - inset * 2;
    const ih = ch - inset * 2;
    const rotate = template.cellRotate[i % Math.max(template.cellRotate.length, 1)] ?? 0;

    if (cell.type === 'logo') {
      drawLogoCell(ctx, logoImg, ix, iy, iw, ih, template);
      continue;
    }
    if (cell.type === 'empty') continue;

    drawCoverCell(ctx, trackImages[coverIndex] ?? null, ix, iy, iw, ih, template.cellRadius, rotate, true);
    coverIndex++;
  }

  ctx.save();
  ctx.fillStyle = template.palette.textMuted ?? template.palette.accent;
  ctx.font = `500 ${w * 0.02}px ${template.fonts.mono ?? 'JetBrains Mono'}, monospace`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText((edition ?? '').toUpperCase(), margin, h - margin * 0.6);
  ctx.textAlign = 'right';
  ctx.fillText('NEW MUSIC FRIDAY', w - margin, h - margin * 0.6);
  ctx.restore();

  if (template.showVinyl) {
    drawVinylPeek(ctx, w * 0.7, h * 0.65, w * 0.25, w * 0.25, template.vinylOpacity ?? 0.18);
  }
  drawPostProcess(ctx, w, h, template);
}

export async function preloadV2TemplateAssets(
  template: V2Template,
  tracks: V2TrackRenderData[] = [],
  logo?: string,
): Promise<void> {
  const fontLoads = [
    document.fonts.load(`700 56px ${template.fonts.display}`).catch(() => undefined),
    document.fonts.load(`500 26px ${template.fonts.body}`).catch(() => undefined),
  ];
  const imageLoads = tracks.map((track) => loadImage(track.cover));
  if (logo) imageLoads.push(loadImage(logo));
  await Promise.all([...fontLoads, ...imageLoads]);
}
