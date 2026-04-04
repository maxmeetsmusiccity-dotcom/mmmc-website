/**
 * Grid layout system — SEPARATE from visual templates.
 * Any template style works with any grid layout.
 */

export interface CellPosition {
  col: number;      // 0-based column
  row: number;      // 0-based row
  colSpan: number;  // cells wide
  rowSpan: number;  // cells tall
}

export interface GridLayout {
  id: string;
  name: string;
  columns: number;
  rows: number;
  totalSlots: number;   // tracks + logo if applicable
  trackSlots: number;   // just tracks
  hasLogo: boolean;
  logoIndex: number;    // index in cells array, -1 if no logo
  cells: CellPosition[];
  /** Icon representation for selector (e.g. "2x2" grid of dots) */
  icon: string;
}

/**
 * Given a grid layout and canvas dimensions, compute pixel rects for each cell.
 */
export interface CellRect {
  x: number;
  y: number;
  w: number;
  h: number;
  isLogo: boolean;
  cellIndex: number;
}

export function computeCellRects(
  layout: GridLayout,
  originX: number,
  originY: number,
  gridWidth: number,
  gridHeight: number,
  gapPx: number,
): CellRect[] {
  const colUnit = (gridWidth - gapPx * (layout.columns + 1)) / layout.columns;
  const rowUnit = (gridHeight - gapPx * (layout.rows + 1)) / layout.rows;

  return layout.cells.map((cell, i) => ({
    x: originX + gapPx + cell.col * (colUnit + gapPx),
    y: originY + gapPx + cell.row * (rowUnit + gapPx),
    w: cell.colSpan * colUnit + (cell.colSpan - 1) * gapPx,
    h: cell.rowSpan * rowUnit + (cell.rowSpan - 1) * gapPx,
    isLogo: i === layout.logoIndex,
    cellIndex: i,
  }));
}

// ─── Layout definitions ─────────────────────────────────

function grid(cols: number, rows: number): CellPosition[] {
  const cells: CellPosition[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      cells.push({ col: c, row: r, colSpan: 1, rowSpan: 1 });
    }
  }
  return cells;
}

export const GRID_LAYOUTS: GridLayout[] = [
  // 1. 2x2 — 4 tracks, no logo
  {
    id: '2x2',
    name: '2×2',
    columns: 2, rows: 2,
    totalSlots: 4, trackSlots: 4,
    hasLogo: false, logoIndex: -1,
    cells: grid(2, 2),
    icon: '⊞',
  },

  // 2. 2x2 + Logo — 4 tracks + center logo (3x3 grid, corners only)
  {
    id: '2x2_logo',
    name: '2×2 + Logo',
    columns: 3, rows: 3,
    totalSlots: 5, trackSlots: 4,
    hasLogo: true, logoIndex: 4,
    cells: [
      { col: 0, row: 0, colSpan: 1, rowSpan: 1 }, // TL
      { col: 2, row: 0, colSpan: 1, rowSpan: 1 }, // TR
      { col: 0, row: 2, colSpan: 1, rowSpan: 1 }, // BL
      { col: 2, row: 2, colSpan: 1, rowSpan: 1 }, // BR
      { col: 1, row: 1, colSpan: 1, rowSpan: 1 }, // Center = logo
    ],
    icon: '⊡',
  },

  // 3. 3x3 + Logo — 8 tracks + center logo (the classic)
  {
    id: '3x3_logo',
    name: '3×3 + Logo',
    columns: 3, rows: 3,
    totalSlots: 9, trackSlots: 8,
    hasLogo: true, logoIndex: 4,
    cells: [
      { col: 0, row: 0, colSpan: 1, rowSpan: 1 },
      { col: 1, row: 0, colSpan: 1, rowSpan: 1 },
      { col: 2, row: 0, colSpan: 1, rowSpan: 1 },
      { col: 0, row: 1, colSpan: 1, rowSpan: 1 },
      { col: 1, row: 1, colSpan: 1, rowSpan: 1 }, // Center = logo
      { col: 2, row: 1, colSpan: 1, rowSpan: 1 },
      { col: 0, row: 2, colSpan: 1, rowSpan: 1 },
      { col: 1, row: 2, colSpan: 1, rowSpan: 1 },
      { col: 2, row: 2, colSpan: 1, rowSpan: 1 },
    ],
    icon: '▦',
  },

  // 4. 3x3 Full — 9 tracks, no logo
  {
    id: '3x3_full',
    name: '3×3 Full',
    columns: 3, rows: 3,
    totalSlots: 9, trackSlots: 9,
    hasLogo: false, logoIndex: -1,
    cells: grid(3, 3),
    icon: '▩',
  },

  // 5. 4x4 — 16 tracks, no logo
  {
    id: '4x4',
    name: '4×4',
    columns: 4, rows: 4,
    totalSlots: 16, trackSlots: 16,
    hasLogo: false, logoIndex: -1,
    cells: grid(4, 4),
    icon: '▧',
  },

  // 6. 4x4 + Logo — 15 tracks + center logo
  {
    id: '4x4_logo',
    name: '4×4 + Logo',
    columns: 4, rows: 4,
    totalSlots: 16, trackSlots: 15,
    hasLogo: true, logoIndex: 5,
    cells: (() => {
      const c = grid(4, 4);
      // Logo replaces cell at row 1, col 1 (index 5)
      return c;
    })(),
    icon: '▤',
  },

  // 7. Single Feature — 1 large image
  {
    id: 'single',
    name: 'Single Feature',
    columns: 1, rows: 1,
    totalSlots: 1, trackSlots: 1,
    hasLogo: false, logoIndex: -1,
    cells: [{ col: 0, row: 0, colSpan: 1, rowSpan: 1 }],
    icon: '■',
  },

  // 8. 2x3 Vertical — 6 tracks in 2 columns, 3 rows
  {
    id: '2x3',
    name: '2×3 Vertical',
    columns: 2, rows: 3,
    totalSlots: 6, trackSlots: 6,
    hasLogo: false, logoIndex: -1,
    cells: grid(2, 3),
    icon: '▥',
  },

  // 9. 1x4 Strip — 4 tracks in a horizontal strip
  {
    id: '1x4_strip',
    name: '1×4 Strip',
    columns: 4, rows: 1,
    totalSlots: 4, trackSlots: 4,
    hasLogo: false, logoIndex: -1,
    cells: grid(4, 1),
    icon: '▬',
  },

  // 10. Mosaic — 1 large (2x2) + 5 small (1x1)
  {
    id: 'mosaic',
    name: 'Mosaic',
    columns: 3, rows: 3,
    totalSlots: 6, trackSlots: 6,
    hasLogo: false, logoIndex: -1,
    cells: [
      { col: 0, row: 0, colSpan: 2, rowSpan: 2 }, // Large feature cell
      { col: 2, row: 0, colSpan: 1, rowSpan: 1 },
      { col: 2, row: 1, colSpan: 1, rowSpan: 1 },
      { col: 0, row: 2, colSpan: 1, rowSpan: 1 },
      { col: 1, row: 2, colSpan: 1, rowSpan: 1 },
      { col: 2, row: 2, colSpan: 1, rowSpan: 1 },
    ],
    icon: '◫',
  },
];

export function getLayout(id: string): GridLayout {
  return GRID_LAYOUTS.find(l => l.id === id) || GRID_LAYOUTS[2]; // default: 3x3+logo
}

export function getDefaultLayout(): GridLayout {
  return GRID_LAYOUTS[2]; // 3x3+logo
}
