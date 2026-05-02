export type TemplateEngine = 'v1' | 'v2';

export type V2TemplateKind = 'body' | 'title';

export type V2Decoration =
  | 'gold-frame'
  | 'halftone-banner'
  | 'marquee-bulbs'
  | 'neon-grid'
  | 'pearl-studs'
  | 'rope-frame'
  | 'script-flourish'
  | 'spotlight'
  | 'sunburst-rays'
  | 'velvet-curtain'
  | 'vinyl-disc';

export type V2PostProcess = 'halftone' | 'scanlines' | 'sepia' | 'spotlight';

export type V2TitleLayout =
  | 'centered-stack'
  | 'edition-number'
  | 'magazine-bleed'
  | 'marquee-frame'
  | 'mosaic-overture'
  | 'poster-stamped'
  | 'radial-burst'
  | 'script-overlay'
  | 'split-half'
  | 'spotlight'
  | 'tape-frame'
  | 'vinyl-disc';

export type V2TitleStyle =
  | 'italic-script'
  | 'mixed-script'
  | 'neon-glow'
  | 'sans-bold'
  | 'serif-display-huge'
  | 'serif-italic'
  | 'serif-italic-display';

export type V2SubtitleStyle = 'allcaps-spaced' | 'mono-spaced';

export type V2SwipePillStyle =
  | 'gold-pill'
  | 'ink-stamp'
  | 'minimal-rule'
  | 'neon-pill'
  | 'rose-tag'
  | 'rope-tag'
  | 'script-tag'
  | 'sepia-pill'
  | 'sunburst-pill'
  | 'tape-label';

export interface V2Palette {
  bg: string;
  accent: string;
  accent2?: string;
  text: string;
  textMuted?: string;
}

export interface V2Fonts {
  display: string;
  body: string;
  mono?: string;
  script?: string;
}

export interface V2TrackRenderData {
  id?: string;
  title?: string;
  artist?: string;
  cover?: string;
}

export interface V2GridCell {
  col: number;
  row: number;
  colSpan: number;
  rowSpan: number;
  type?: 'cover' | 'empty' | 'featured' | 'logo';
}

export interface V2GridConfig {
  id?: string;
  cols: number;
  rows: number;
  cells: V2GridCell[];
}

export interface V2TemplateBase {
  id: string;
  name: string;
  description: string;
  engine: 'v2';
  kind: V2TemplateKind;
  palette: V2Palette;
  fonts: V2Fonts;
  decoration?: V2Decoration;
  postProcess?: V2PostProcess;
  showGrain?: boolean;
  grainOpacity?: number;
}

export interface V2CarouselBodyTemplate extends V2TemplateBase {
  kind: 'body';
  cellPadding: number;
  cellRadius: number;
  cellRotate: number[];
  cellShadow?: string;
  neonGlow?: {
    color: string;
    size: number;
    intensity: number;
  };
  showVinyl?: boolean;
  vinylOpacity?: number;
}

export interface V2TitleSlideTemplate extends V2TemplateBase {
  kind: 'title';
  layout: V2TitleLayout;
  featuredSize: number;
  featuredRadius: number;
  featuredRotate: number;
  showSwipePill: boolean;
  swipePillStyle: V2SwipePillStyle;
  titleStyle: V2TitleStyle;
  subtitleStyle: V2SubtitleStyle;
  showVinyl?: boolean;
  vinylOpacity?: number;
}

export interface V2RenderBaseOptions {
  edition?: string;
  logo?: string;
  tracks?: V2TrackRenderData[];
}

export interface V2RenderBodyOptions extends V2RenderBaseOptions {
  template: V2CarouselBodyTemplate;
  grid: V2GridConfig;
  tracks: V2TrackRenderData[];
}

export interface V2RenderTitleOptions extends V2RenderBaseOptions {
  template: V2TitleSlideTemplate;
  title: string;
  subtitle?: string;
  featured?: V2TrackRenderData;
  count: number;
}

export type V2Template = V2CarouselBodyTemplate | V2TitleSlideTemplate;
