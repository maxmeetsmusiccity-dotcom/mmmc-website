import type { TitleSlideTemplate } from './title-templates';
import type { CarouselTemplate } from './carousel-templates';

/* ------------------------------------------------------------------ */
/*  Editor Element — the unit of interaction in the canvas overlay     */
/* ------------------------------------------------------------------ */

export interface EditorElement {
  id: string;
  type: 'text' | 'image' | 'decoration' | 'background';
  label: string;
  visible: boolean;
  locked: boolean;
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
      x: 0.5, y: tt.headlineY, width: 0.8, height: 0, rotation: 0,
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
      x: 0.5, y: tt.subtitleY, width: 0.8, height: 0, rotation: 0,
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
      x: 0.5, y: tt.featuredImageY, width: tt.featuredImageSize, height: tt.featuredImageSize,
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
      x: 0.5, y: tt.dateY, width: 0.8, height: 0, rotation: 0,
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
    headlineY: headline?.y ?? base.headlineY,
    subtitleFont: (subtitle?.props.font as string) || base.subtitleFont,
    subtitleSize: (subtitle?.props.fontSize as number) || base.subtitleSize,
    subtitleY: subtitle?.y ?? base.subtitleY,
    dateFont: (date?.props.font as string) || base.dateFont,
    dateSize: (date?.props.fontSize as number) || base.dateSize,
    dateY: date?.y ?? base.dateY,
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
      locked: true,
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
