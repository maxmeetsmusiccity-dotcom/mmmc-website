/**
 * Dynamic grid layout system.
 * Generates ALL valid grid configurations for any track count 1-50.
 * Grouped by: Exact Fit, Close Fit, Mosaic, Logo Variants.
 */

export interface CellPosition {
  col: number;
  row: number;
  colSpan: number;
  rowSpan: number;
}

export interface GridConfig {
  id: string;
  name: string;
  columns: number;
  rows: number;
  trackSlots: number;
  hasLogo: boolean;
  logoIndex: number;       // -1 if no logo
  cells: CellPosition[];
  emptyCount: number;      // 0 for exact fit
  category: 'exact' | 'close' | 'mosaic' | 'logo';
}

export interface CellRect {
  x: number;
  y: number;
  w: number;
  h: number;
  isLogo: boolean;
  isEmpty: boolean;
  cellIndex: number;
}

// ─── Cell rect computation ──────────────────────────────

export function computeCellRects(
  config: GridConfig,
  originX: number,
  originY: number,
  gridWidth: number,
  gridHeight: number,
  gapPx: number,
): CellRect[] {
  const colUnit = (gridWidth - gapPx * (config.columns + 1)) / config.columns;
  const rowUnit = (gridHeight - gapPx * (config.rows + 1)) / config.rows;
  // Force square cells — use the smaller dimension
  const cellSize = Math.min(colUnit, rowUnit);
  // Center the grid if there's leftover space
  const actualGridW = cellSize * config.columns + gapPx * (config.columns + 1);
  const actualGridH = cellSize * config.rows + gapPx * (config.rows + 1);
  const offsetX = originX + (gridWidth - actualGridW) / 2;
  const offsetY = originY + (gridHeight - actualGridH) / 2;

  return config.cells.map((cell, i) => ({
    x: offsetX + gapPx + cell.col * (cellSize + gapPx),
    y: offsetY + gapPx + cell.row * (cellSize + gapPx),
    w: cell.colSpan * cellSize + (cell.colSpan - 1) * gapPx,
    h: cell.rowSpan * cellSize + (cell.rowSpan - 1) * gapPx,
    isLogo: i === config.logoIndex,
    isEmpty: i >= config.trackSlots + (config.hasLogo ? 1 : 0),
    cellIndex: i,
  }));
}

// ─── Grid generation helpers ────────────────────────────

function makeGrid(cols: number, rows: number): CellPosition[] {
  const cells: CellPosition[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      cells.push({ col: c, row: r, colSpan: 1, rowSpan: 1 });
    }
  }
  return cells;
}

function gridId(cols: number, rows: number, suffix = ''): string {
  return `${cols}x${rows}${suffix}`;
}

function gridName(cols: number, rows: number, suffix = ''): string {
  return `${cols}×${rows}${suffix}`;
}

// ─── Dynamic grid generation ────────────────────────────

/** Get ALL valid factorizations of N where both factors are 1-10 */
function factorize(n: number): [number, number][] {
  const pairs: [number, number][] = [];
  for (let c = 1; c <= Math.min(n, 10); c++) {
    if (n % c === 0) {
      const r = n / c;
      if (r >= 1 && r <= 10) {
        pairs.push([c, r]);
      }
    }
  }
  return pairs;
}

/** Generate exact-fit grids for a track count */
function generateExactGrids(trackCount: number): GridConfig[] {
  const grids: GridConfig[] = [];

  // Single feature (always available for count=1)
  if (trackCount === 1) {
    grids.push({
      id: '1x1', name: '1×1 Feature', columns: 1, rows: 1,
      trackSlots: 1, hasLogo: false, logoIndex: -1,
      cells: [{ col: 0, row: 0, colSpan: 1, rowSpan: 1 }],
      emptyCount: 0, category: 'exact',
    });
    return grids;
  }

  const pairs = factorize(trackCount);
  for (const [cols, rows] of pairs) {
    grids.push({
      id: gridId(cols, rows),
      name: gridName(cols, rows),
      columns: cols, rows,
      trackSlots: trackCount,
      hasLogo: false, logoIndex: -1,
      cells: makeGrid(cols, rows),
      emptyCount: 0, category: 'exact',
    });
  }

  return grids;
}

/** Generate logo variants: NxM grids where NxM - 1 = trackCount
 * Logo only valid when it can go in the TRUE center:
 * - Odd×odd grids (3×3, 5×5, 7×7): center cell exists
 * - Even×even or mixed: NO logo (no true center)
 */
function generateLogoGrids(trackCount: number): GridConfig[] {
  const grids: GridConfig[] = [];
  const totalNeeded = trackCount + 1; // +1 for logo cell

  const pairs = factorize(totalNeeded);
  for (const [cols, rows] of pairs) {
    // Logo only for odd×odd grids where center cell is unambiguous
    if (cols % 2 === 0 || rows % 2 === 0) continue;
    if (cols < 3 || rows < 3) continue;
    const logoCellIndex = Math.floor(rows / 2) * cols + Math.floor(cols / 2);
    const cells = makeGrid(cols, rows);

    grids.push({
      id: gridId(cols, rows, '_logo'),
      name: gridName(cols, rows, ' + Logo'),
      columns: cols, rows,
      trackSlots: trackCount,
      hasLogo: true,
      logoIndex: logoCellIndex,
      cells,
      emptyCount: 0, category: 'logo',
    });
  }

  return grids;
}

/** Generate close-fit grids: NxM where |NxM - trackCount| is 1-2 */
function generateCloseGrids(trackCount: number): GridConfig[] {
  const grids: GridConfig[] = [];
  const seen = new Set<string>();

  for (let total = trackCount + 1; total <= trackCount + 2; total++) {
    const pairs = factorize(total);
    for (const [cols, rows] of pairs) {
      const key = `${cols}x${rows}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const empty = total - trackCount;
      const cells = makeGrid(cols, rows);

      grids.push({
        id: gridId(cols, rows, `_close${empty}`),
        name: `${gridName(cols, rows)} (${empty} empty)`,
        columns: cols, rows,
        trackSlots: trackCount,
        hasLogo: false, logoIndex: -1,
        cells,
        emptyCount: empty, category: 'close',
      });
    }
  }

  // Also close-fit with logo: NxM - 1 (logo) close to trackCount
  for (let total = trackCount + 2; total <= trackCount + 3; total++) {
    const pairs = factorize(total);
    for (const [cols, rows] of pairs) {
      if (cols < 2 || rows < 2) continue;
      // Logo only centered in odd×odd grids (even grids put it off-center)
      if (cols % 2 === 0 || rows % 2 === 0) continue;
      const key = `${cols}x${rows}_logo_close`;
      if (seen.has(key)) continue;
      seen.add(key);

      const trackSlotsAvailable = total - 1; // minus logo
      const empty = trackSlotsAvailable - trackCount;
      if (empty < 1 || empty > 2) continue;

      const logoCellIndex = Math.floor(rows / 2) * cols + Math.floor(cols / 2);
      const cells = makeGrid(cols, rows);

      grids.push({
        id: gridId(cols, rows, `_logo_close${empty}`),
        name: `${gridName(cols, rows)} + Logo (${empty} empty)`,
        columns: cols, rows,
        trackSlots: trackCount,
        hasLogo: true,
        logoIndex: logoCellIndex,
        cells,
        emptyCount: empty, category: 'close',
      });
    }
  }

  return grids;
}

/** Generate mosaic layouts: 1 large (2x2) + small cells */
function generateMosaicGrids(trackCount: number): GridConfig[] {
  const grids: GridConfig[] = [];

  if (trackCount < 3) return grids;

  // Pattern: 1 featured (2x2) + remaining small (1x1) on a 3-col grid
  // Featured takes 4 cells (2x2), so remaining = total cells - 4 + 1 (featured counts as 1 track)
  // For 3-col grid: try different row counts
  for (let rows = 2; rows <= 6; rows++) {
    const cols = 3;
    const totalCells = cols * rows;
    const smallCells = totalCells - 4; // 2x2 takes 4 cells
    const tracksInLayout = 1 + smallCells; // 1 featured + small cells

    if (tracksInLayout === trackCount) {
      const cells: CellPosition[] = [
        { col: 0, row: 0, colSpan: 2, rowSpan: 2 }, // featured
      ];
      // Fill remaining cells (skip cells occupied by the 2x2)
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (r < 2 && c < 2) continue; // skip featured area
          cells.push({ col: c, row: r, colSpan: 1, rowSpan: 1 });
        }
      }

      grids.push({
        id: `mosaic_3x${rows}`,
        name: `Mosaic 3×${rows}`,
        columns: cols, rows,
        trackSlots: trackCount,
        hasLogo: false, logoIndex: -1,
        cells,
        emptyCount: 0, category: 'mosaic',
      });
    }
  }

  // Pattern: 1 featured (2x2) on 4-col grid
  for (let rows = 2; rows <= 5; rows++) {
    const cols = 4;
    const totalCells = cols * rows;
    const smallCells = totalCells - 4;
    const tracksInLayout = 1 + smallCells;

    if (tracksInLayout === trackCount) {
      const cells: CellPosition[] = [
        { col: 0, row: 0, colSpan: 2, rowSpan: 2 },
      ];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (r < 2 && c < 2) continue;
          cells.push({ col: c, row: r, colSpan: 1, rowSpan: 1 });
        }
      }

      grids.push({
        id: `mosaic_4x${rows}`,
        name: `Mosaic 4×${rows}`,
        columns: cols, rows,
        trackSlots: trackCount,
        hasLogo: false, logoIndex: -1,
        cells,
        emptyCount: 0, category: 'mosaic',
      });
    }
  }

  return grids;
}

// ─── Public API ─────────────────────────────────────────

export interface GridOptions {
  exact: GridConfig[];
  logo: GridConfig[];
  close: GridConfig[];
  mosaic: GridConfig[];
}

/**
 * Generate ALL valid grid configurations for a track count.
 * Returns grouped by category. No cap — all options shown.
 */
export function getGridsForCount(trackCount: number): GridOptions {
  return {
    exact: generateExactGrids(trackCount),
    logo: generateLogoGrids(trackCount),
    close: generateCloseGrids(trackCount),
    mosaic: generateMosaicGrids(trackCount),
  };
}

/** Total number of grid options available for a count */
export function countGridOptions(trackCount: number): number {
  const opts = getGridsForCount(trackCount);
  return opts.exact.length + opts.logo.length + opts.close.length + opts.mosaic.length;
}

/** Get a specific grid by ID (searches all categories for the given count) */
export function getGridById(trackCount: number, gridId: string): GridConfig | null {
  const opts = getGridsForCount(trackCount);
  const all = [...opts.exact, ...opts.logo, ...opts.close, ...opts.mosaic];
  return all.find(g => g.id === gridId) || null;
}

/** Suggest a better track count if current count has few exact-fit options */
export function suggestBetterCounts(trackCount: number): number[] {
  const suggestions: number[] = [];
  for (let delta = 1; delta <= 3; delta++) {
    for (const candidate of [trackCount - delta, trackCount + delta]) {
      if (candidate >= 1 && candidate <= 50) {
        const opts = getGridsForCount(candidate);
        if (opts.exact.length > 1) { // more than just 1xN
          suggestions.push(candidate);
        }
      }
    }
  }
  return [...new Set(suggestions)].sort((a, b) => a - b).slice(0, 4);
}

/**
 * Auto-split tracks across minimum slides for a given grid.
 * Returns array of track index ranges per slide.
 */
export function autoSplit(
  trackCount: number,
  tracksPerSlide: number,
): { start: number; end: number }[] {
  const slides: { start: number; end: number }[] = [];
  for (let i = 0; i < trackCount; i += tracksPerSlide) {
    slides.push({
      start: i,
      end: Math.min(i + tracksPerSlide, trackCount),
    });
  }
  return slides;
}
