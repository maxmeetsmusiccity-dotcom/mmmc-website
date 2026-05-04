import type { TitleSlideTemplate } from './title-templates';
import type { CarouselTemplate } from './carousel-templates';

/* ------------------------------------------------------------------ */
/*  Editor Element — the unit of interaction in the canvas overlay     */
/* ------------------------------------------------------------------ */

export interface EditorElement {
  id: string;
  type: 'text' | 'image' | 'decoration' | 'background' | 'shape';
  label: string;
  visible: boolean;
  locked: boolean;
  /** Whether this element was added by the user (vs derived from template) */
  custom?: boolean;
  /** Horizontal center as fraction of canvas width (0-1) */
  x: number;
  /** Vertical position as fraction of canvas height (0-1) */
  y: number;
  /** Width as fraction of canvas width (0-1), 0 = auto from text */
  width: number;
  /** Height as fraction of canvas height (0-1), 0 = auto */
  height: number;
  rotation: number;
  /** Type-specific properties */
  props: Record<string, unknown>;
}

/* ------------------------------------------------------------------ */
/*  Title Slide → Elements                                             */
/* ------------------------------------------------------------------ */

export function titleTemplateToElements(tt: TitleSlideTemplate): EditorElement[] {
  return [
    {
      id: 'background',
      type: 'background',
      label: 'Background',
      visible: true,
      locked: true,
      x: 0.5, y: 0.5, width: 1, height: 1, rotation: 0,
      props: {
        color: tt.background,
        gradient: tt.backgroundGradient,
      },
    },
    {
      id: 'frame',
      type: 'decoration',
      label: 'Frame Border',
      visible: tt.showFrame,
      locked: false,
      x: 0.5, y: 0.5, width: 1, height: 1, rotation: 0,
      props: {
        color: tt.frameColor,
        width: tt.frameWidth,
      },
    },
    {
      id: 'headline',
      type: 'text',
      label: 'Headline',
      visible: true,
      locked: false,
      x: tt.headlineX ?? 0.5, y: tt.headlineY, width: 0.8, height: 0, rotation: 0,
      props: {
        text: 'New Music Friday',
        font: tt.headlineFont,
        fontSize: tt.headlineSize,
        fontWeight: tt.headlineWeight,
        textCase: tt.headlineCase,
        color: tt.textPrimary,
        glowColor: tt.glow.color,
        glowBlur: tt.glow.blur,
        glowPasses: tt.glow.passes,
      },
    },
    {
      id: 'divider',
      type: 'decoration',
      label: 'Divider Line',
      visible: tt.showDivider,
      locked: false,
      x: 0.5, y: tt.subtitleY - 0.01, width: 0.64, height: 0, rotation: 0,
      props: { color: tt.dividerColor },
    },
    {
      id: 'subtitle',
      type: 'text',
      label: 'Subtitle',
      visible: true,
      locked: false,
      x: tt.subtitleX ?? 0.5, y: tt.subtitleY, width: 0.8, height: 0, rotation: 0,
      props: {
        text: 'Max Meets Music City',
        font: tt.subtitleFont,
        fontSize: tt.subtitleSize,
        fontWeight: 400,
        color: tt.textSecondary,
      },
    },
    {
      id: 'featured_image',
      type: 'image',
      label: 'Featured Image',
      visible: true,
      locked: false,
      x: tt.featuredImageX ?? 0.5, y: tt.featuredImageY, width: tt.featuredImageSize, height: tt.featuredImageSize,
      rotation: tt.featuredRotation,
      props: {
        borderWidth: tt.featuredBorder,
        borderColor: tt.featuredBorderColor,
        shadowBlur: tt.featuredShadowBlur,
      },
    },
    {
      id: 'swipe_pill',
      type: 'decoration',
      label: 'Swipe Pill',
      visible: tt.swipePill,
      locked: false,
      x: 0.5, y: tt.dateY - 0.04, width: 0.4, height: 0.03, rotation: 0,
      props: { text: 'Swipe for all picks →' },
    },
    {
      id: 'date',
      type: 'text',
      label: 'Date',
      visible: true,
      locked: false,
      x: tt.dateX ?? 0.5, y: tt.dateY, width: 0.8, height: 0, rotation: 0,
      props: {
        text: '(date)',
        font: tt.dateFont,
        fontSize: tt.dateSize,
        fontWeight: 700,
        color: tt.textPrimary,
        glowColor: tt.glow.color,
        glowBlur: tt.glow.blur,
      },
    },
  ];
}

/* ------------------------------------------------------------------ */
/*  Elements → Title Template (reconstruct for save/render)            */
/* ------------------------------------------------------------------ */

export function elementsToTitleTemplate(
  els: EditorElement[],
  base: TitleSlideTemplate,
): TitleSlideTemplate {
  const get = (id: string) => els.find(e => e.id === id);

  const headline = get('headline');
  const subtitle = get('subtitle');
  const date = get('date');
  const featured = get('featured_image');
  const frame = get('frame');
  const divider = get('divider');
  const swipePill = get('swipe_pill');
  const bg = get('background');

  return {
    ...base,
    background: (bg?.props.color as string) || base.background,
    backgroundGradient: (bg?.props.gradient as string) || base.backgroundGradient,
    headlineFont: (headline?.props.font as string) || base.headlineFont,
    headlineWeight: (headline?.props.fontWeight as number) || base.headlineWeight,
    headlineCase: (headline?.props.textCase as 'capitalize' | 'uppercase' | 'none') || base.headlineCase,
    headlineSize: (headline?.props.fontSize as number) || base.headlineSize,
    headlineX: headline?.x ?? base.headlineX,
    headlineY: headline?.y ?? base.headlineY,
    subtitleFont: (subtitle?.props.font as string) || base.subtitleFont,
    subtitleSize: (subtitle?.props.fontSize as number) || base.subtitleSize,
    subtitleX: subtitle?.x ?? base.subtitleX,
    subtitleY: subtitle?.y ?? base.subtitleY,
    dateFont: (date?.props.font as string) || base.dateFont,
    dateSize: (date?.props.fontSize as number) || base.dateSize,
    dateX: date?.x ?? base.dateX,
    dateY: date?.y ?? base.dateY,
    featuredImageX: featured?.x ?? base.featuredImageX,
    featuredImageY: featured?.y ?? base.featuredImageY,
    featuredImageSize: featured?.width ?? base.featuredImageSize,
    featuredRotation: featured?.rotation ?? base.featuredRotation,
    featuredBorder: (featured?.props.borderWidth as number) ?? base.featuredBorder,
    featuredBorderColor: (featured?.props.borderColor as string) || base.featuredBorderColor,
    featuredShadowBlur: (featured?.props.shadowBlur as number) ?? base.featuredShadowBlur,
    textPrimary: (headline?.props.color as string) || base.textPrimary,
    textSecondary: (subtitle?.props.color as string) || base.textSecondary,
    glow: {
      color: (headline?.props.glowColor as string) || base.glow.color,
      blur: (headline?.props.glowBlur as number) ?? base.glow.blur,
      passes: (headline?.props.glowPasses as number) ?? base.glow.passes,
    },
    showFrame: frame?.visible ?? base.showFrame,
    frameColor: (frame?.props.color as string) || base.frameColor,
    frameWidth: (frame?.props.width as number) ?? base.frameWidth,
    showDivider: divider?.visible ?? base.showDivider,
    dividerColor: (divider?.props.color as string) || base.dividerColor,
    swipePill: swipePill?.visible ?? base.swipePill,
  };
}

/* ------------------------------------------------------------------ */
/*  Grid Template → Elements (for overlay hit-testing)                 */
/* ------------------------------------------------------------------ */

export function gridTemplateToElements(gt: CarouselTemplate): EditorElement[] {
  return [
    {
      id: 'background',
      type: 'background',
      label: 'Background',
      visible: true,
      locked: true,
      x: 0.5, y: 0.5, width: 1, height: 1, rotation: 0,
      props: { color: gt.background, gradient: gt.backgroundGradient },
    },
    {
      id: 'header',
      type: 'text',
      label: 'Header Text',
      visible: true,
      locked: false,
      x: 0.5, y: 0.02, width: 0.8, height: 0.10, rotation: 0,
      props: {
        text: 'New Music Friday',
        font: gt.scriptFont,
        fontSize: gt.headerFontSize || 52,
        color: gt.textPrimary,
        glowColor: gt.accent,
        glowBlur: gt.neon.outerBlur,
      },
    },
    {
      id: 'grid',
      type: 'decoration',
      label: 'Track Grid',
      visible: true,
      locked: false,
      x: 0.5, y: 0.55, width: 0.9, height: 0.75, rotation: 0,
      props: {
        gap: gt.grid.gap,
        cellBorder: gt.grid.cellBorder,
        cellShadow: gt.grid.cellShadow,
        cellCornerRadius: gt.cellCornerRadius,
      },
    },
    {
      id: 'notes',
      type: 'decoration',
      label: 'Music Notes',
      visible: gt.decorations.showNotes,
      locked: false,
      x: 0.5, y: 0.5, width: 1, height: 1, rotation: 0,
      props: { size: gt.decorations.noteSize },
    },
    {
      id: 'sparkles',
      type: 'decoration',
      label: 'Sparkles',
      visible: gt.decorations.showSparkles,
      locked: false,
      x: 0.5, y: 0.5, width: 1, height: 1, rotation: 0,
      props: { size: gt.decorations.sparkleSize },
    },
  ];
}

/* ------------------------------------------------------------------ */
/*  Custom Element Factories                                           */
/* ------------------------------------------------------------------ */

let _customCounter = 0;

export function createCustomText(): EditorElement {
  _customCounter++;
  return {
    id: `custom_text_${Date.now()}_${_customCounter}`,
    type: 'text',
    label: `Text ${_customCounter}`,
    visible: true,
    locked: false,
    custom: true,
    x: 0.5, y: 0.5, width: 0.6, height: 0.05, rotation: 0,
    props: {
      text: 'Custom Text',
      font: '"DM Sans", sans-serif',
      fontSize: 0.035,
      fontWeight: 600,
      color: '#FFFFFF',
    },
  };
}

export function createCustomImage(): EditorElement {
  _customCounter++;
  return {
    id: `custom_image_${Date.now()}_${_customCounter}`,
    type: 'image',
    label: `Image ${_customCounter}`,
    visible: true,
    locked: false,
    custom: true,
    x: 0.5, y: 0.5, width: 0.3, height: 0.3, rotation: 0,
    props: {
      src: '',
      borderWidth: 0,
      borderColor: '#FFFFFF',
      shadowBlur: 0,
      opacity: 1,
    },
  };
}

export type ShapeKind = 'rectangle' | 'circle' | 'line';

export function createCustomShape(kind: ShapeKind = 'rectangle'): EditorElement {
  _customCounter++;
  return {
    id: `custom_shape_${Date.now()}_${_customCounter}`,
    type: 'shape',
    label: `${kind.charAt(0).toUpperCase() + kind.slice(1)} ${_customCounter}`,
    visible: true,
    locked: false,
    custom: true,
    x: 0.5, y: 0.5,
    width: kind === 'line' ? 0.4 : 0.2,
    height: kind === 'line' ? 0.005 : 0.2,
    rotation: 0,
    props: {
      kind,
      fill: kind === 'line' ? 'transparent' : 'rgba(212,168,67,0.2)',
      stroke: '#F5C453',
      strokeWidth: 2,
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Render custom elements onto a canvas context                       */
/* ------------------------------------------------------------------ */

export async function drawCustomElements(
  ctx: CanvasRenderingContext2D,
  elements: EditorElement[],
  canvasW: number,
  canvasH: number,
): Promise<void> {
  for (const el of elements) {
    if (!el.custom || !el.visible) continue;

    const px = el.x * canvasW;
    const py = el.y * canvasH;
    const w = el.width * canvasW;
    const h = el.height * canvasH;

    ctx.save();

    if (el.rotation !== 0) {
      ctx.translate(px, py + h / 2);
      ctx.rotate((el.rotation * Math.PI) / 180);
      ctx.translate(-px, -(py + h / 2));
    }

    if (el.type === 'text') {
      const fontSize = Math.round((el.props.fontSize as number) * canvasW);
      const font = `${el.props.fontWeight || 400} ${fontSize}px ${el.props.font || 'system-ui'}`;
      ctx.font = font;
      ctx.fillStyle = (el.props.color as string) || '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText((el.props.text as string) || '', px, py, w);
    }

    if (el.type === 'image' && el.props.src) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      try {
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject();
          img.src = el.props.src as string;
        });
        const opacity = (el.props.opacity as number) ?? 1;
        if (opacity < 1) ctx.globalAlpha = opacity;
        const bw = (el.props.borderWidth as number) || 0;
        if (bw > 0) {
          ctx.fillStyle = (el.props.borderColor as string) || '#FFFFFF';
          ctx.fillRect(px - w / 2 - bw, py - bw, w + bw * 2, h + bw * 2);
        }
        ctx.drawImage(img, px - w / 2, py, w, h);
        ctx.globalAlpha = 1;
      } catch { /* image failed to load */ }
    }

    if (el.type === 'shape') {
      const kind = el.props.kind as ShapeKind;
      const fill = el.props.fill as string;
      const stroke = el.props.stroke as string;
      const sw = (el.props.strokeWidth as number) || 1;

      if (kind === 'rectangle') {
        if (fill && fill !== 'transparent') { ctx.fillStyle = fill; ctx.fillRect(px - w / 2, py, w, h); }
        if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = sw; ctx.strokeRect(px - w / 2, py, w, h); }
      } else if (kind === 'circle') {
        const rx = w / 2, ry = h / 2;
        ctx.beginPath();
        ctx.ellipse(px, py + ry, rx, ry, 0, 0, Math.PI * 2);
        if (fill && fill !== 'transparent') { ctx.fillStyle = fill; ctx.fill(); }
        if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = sw; ctx.stroke(); }
      } else if (kind === 'line') {
        ctx.strokeStyle = stroke || '#FFFFFF';
        ctx.lineWidth = sw;
        ctx.beginPath();
        ctx.moveTo(px - w / 2, py);
        ctx.lineTo(px + w / 2, py);
        ctx.stroke();
      }
    }

    ctx.restore();
  }
}
