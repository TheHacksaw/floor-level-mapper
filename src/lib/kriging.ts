import kriging from '@sakitam-gis/kriging';
import type { MeasurementPoint, FloorPlanShape } from '../types';
import { getShapeBounds, pointInShape } from './geometry';
import { valueToRgba } from './colorScale';

export interface KrigingResult {
  imageData: ImageData;
  min: number;
  max: number;
  mean: number;
  bounds: { xmin: number; xmax: number; ymin: number; ymax: number };
  cols: number;
  rows: number;
  cellSize: number;
  grid: (number | null)[][];
}

export function computeKriging(
  measurements: MeasurementPoint[],
  shape: FloorPlanShape,
  gridResolution: number,
  model: 'exponential' | 'gaussian' | 'spherical'
): KrigingResult | null {
  // Filter to measurements that have values
  const validMeasurements = measurements.filter((m) => m.value !== null);
  if (validMeasurements.length < 3) return null;

  const t = validMeasurements.map((m) => m.value as number);
  const x = validMeasurements.map((m) => m.x);
  const y = validMeasurements.map((m) => m.y);

  // Train variogram
  let variogram;
  try {
    variogram = kriging.train(t, x, y, model, 0, 100);
  } catch {
    return null;
  }

  const bounds = getShapeBounds(shape);
  const cols = Math.ceil((bounds.xmax - bounds.xmin) / gridResolution);
  const rows = Math.ceil((bounds.ymax - bounds.ymin) / gridResolution);

  if (cols <= 0 || rows <= 0) return null;

  const grid: (number | null)[][] = [];
  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  let count = 0;

  for (let r = 0; r < rows; r++) {
    grid[r] = [];
    for (let c = 0; c < cols; c++) {
      const px = bounds.xmin + c * gridResolution + gridResolution / 2;
      const py = bounds.ymin + r * gridResolution + gridResolution / 2;

      if (pointInShape({ x: px, y: py }, shape)) {
        try {
          const val = kriging.predict(px, py, variogram);
          grid[r][c] = val;
          min = Math.min(min, val);
          max = Math.max(max, val);
          sum += val;
          count++;
        } catch {
          grid[r][c] = null;
        }
      } else {
        grid[r][c] = null;
      }
    }
  }

  if (count === 0) return null;
  const mean = sum / count;

  // Create ImageData
  const imageData = new ImageData(cols, rows);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = (r * cols + c) * 4;
      const val = grid[r][c];
      if (val !== null) {
        const [rv, gv, bv, av] = valueToRgba(val, min, max, 160);
        imageData.data[idx] = rv;
        imageData.data[idx + 1] = gv;
        imageData.data[idx + 2] = bv;
        imageData.data[idx + 3] = av;
      } else {
        imageData.data[idx + 3] = 0; // transparent
      }
    }
  }

  return { imageData, min, max, mean, bounds, cols, rows, cellSize: gridResolution, grid };
}

export interface SpotInfo {
  x: number;
  y: number;
  value: number;
  type: 'high' | 'low';
}

export function findHighLowSpots(
  result: KrigingResult,
  toleranceMm: number = 5,
  _toleranceOverMm?: number,
  targetHeight?: number | null
): SpotInfo[] {
  const spots: SpotInfo[] = [];
  const { grid, bounds, cellSize, rows, cols, mean } = result;
  const target = targetHeight ?? mean;

  for (let r = 1; r < rows - 1; r++) {
    for (let c = 1; c < cols - 1; c++) {
      const val = grid[r][c];
      if (val === null) continue;

      // Check if this point has a meaningful deviation from target
      const deviation = Math.abs(val - target);
      if (deviation < toleranceMm * 0.5) continue; // skip spots close to target

      let isLocalMax = true;
      let isLocalMin = true;

      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const neighbor = grid[r + dr]?.[c + dc];
          if (neighbor === null || neighbor === undefined) continue;
          if (neighbor >= val) isLocalMax = false;
          if (neighbor <= val) isLocalMin = false;
        }
      }

      if (isLocalMax || isLocalMin) {
        spots.push({
          x: bounds.xmin + c * cellSize + cellSize / 2,
          y: bounds.ymin + r * cellSize + cellSize / 2,
          value: val,
          type: isLocalMax ? 'high' : 'low',
        });
      }
    }
  }

  return spots;
}

export interface ToleranceZone {
  type: 'high' | 'low';
  /** Flat array of [x,y,x,y,...] points forming a closed outline in world coords */
  outline: number[];
  /** Area in mm² (cell count × cellSize²) */
  area: number;
}

/**
 * Find connected regions where the floor gradient exceeds the tolerance.
 * Tolerance is expressed as mm of deviation over a reference distance (e.g. 5mm over 3000mm).
 * The gradient is computed from the kriging grid using finite differences.
 * Cells with steep slopes are classified as needing work:
 *   - "high" (grind) if the cell is above the target height
 *   - "low" (fill) if the cell is below the target height
 */
export function findToleranceZones(
  result: KrigingResult,
  toleranceMm: number,
  toleranceOverMm: number,
  targetHeight?: number | null
): ToleranceZone[] {
  const { grid, bounds, cellSize, rows, cols, mean } = result;
  const target = targetHeight ?? mean;
  const zones: ToleranceZone[] = [];

  // Maximum allowed slope: mm per mm of distance
  const maxSlope = toleranceMm / toleranceOverMm;

  // Build classification grid using gradient magnitude
  // 1 = exceeds tolerance AND above target (grind)
  // -1 = exceeds tolerance AND below target (fill)
  // 0 = within tolerance or null
  const classified: number[][] = [];
  for (let r = 0; r < rows; r++) {
    classified[r] = [];
    for (let c = 0; c < cols; c++) {
      const val = grid[r][c];
      if (val === null) { classified[r][c] = 0; continue; }

      // Compute gradient using central differences where possible
      let dxVal: number | null = null;
      let dyVal: number | null = null;

      if (c > 0 && c < cols - 1 && grid[r][c - 1] !== null && grid[r][c + 1] !== null) {
        dxVal = (grid[r][c + 1]! - grid[r][c - 1]!) / (2 * cellSize);
      } else if (c < cols - 1 && grid[r][c + 1] !== null) {
        dxVal = (grid[r][c + 1]! - val) / cellSize;
      } else if (c > 0 && grid[r][c - 1] !== null) {
        dxVal = (val - grid[r][c - 1]!) / cellSize;
      }

      if (r > 0 && r < rows - 1 && grid[r - 1][c] !== null && grid[r + 1][c] !== null) {
        dyVal = (grid[r + 1][c]! - grid[r - 1][c]!) / (2 * cellSize);
      } else if (r < rows - 1 && grid[r + 1][c] !== null) {
        dyVal = (grid[r + 1][c]! - val) / cellSize;
      } else if (r > 0 && grid[r - 1][c] !== null) {
        dyVal = (val - grid[r - 1][c]!) / cellSize;
      }

      if (dxVal === null && dyVal === null) {
        classified[r][c] = 0;
        continue;
      }

      // Gradient magnitude (slope in mm/mm)
      const gradMag = Math.sqrt((dxVal ?? 0) ** 2 + (dyVal ?? 0) ** 2);

      if (gradMag > maxSlope) {
        // This cell has a slope that's too steep — classify by whether it's a peak or valley
        classified[r][c] = val > target ? 1 : -1;
      } else {
        classified[r][c] = 0;
      }
    }
  }

  // Flood-fill to find connected components
  const visited: boolean[][] = Array.from({ length: rows }, () => Array(cols).fill(false));

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (visited[r][c] || classified[r][c] === 0) continue;

      const zoneType = classified[r][c] === 1 ? 'high' : 'low' as const;
      const targetClass = classified[r][c];
      const cells: [number, number][] = [];

      // BFS flood fill
      const queue: [number, number][] = [[r, c]];
      visited[r][c] = true;
      while (queue.length > 0) {
        const [cr, cc] = queue.shift()!;
        cells.push([cr, cc]);
        for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0]] as const) {
          const nr = cr + dr;
          const nc = cc + dc;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && !visited[nr][nc] && classified[nr][nc] === targetClass) {
            visited[nr][nc] = true;
            queue.push([nr, nc]);
          }
        }
      }

      if (cells.length < 2) continue; // skip tiny zones

      // Build outline: collect boundary edges of the cell group
      const cellSet = new Set(cells.map(([r, c]) => `${r},${c}`));
      const edges: [number, number, number, number][] = []; // [x1,y1,x2,y2] in world coords

      for (const [cr, cc] of cells) {
        const x = bounds.xmin + cc * cellSize;
        const y = bounds.ymin + cr * cellSize;
        // Check each of 4 cell edges — if neighbor is not in zone, it's a boundary edge
        // Top edge
        if (cr === 0 || !cellSet.has(`${cr - 1},${cc}`)) {
          edges.push([x, y, x + cellSize, y]);
        }
        // Bottom edge
        if (cr === rows - 1 || !cellSet.has(`${cr + 1},${cc}`)) {
          edges.push([x, y + cellSize, x + cellSize, y + cellSize]);
        }
        // Left edge
        if (cc === 0 || !cellSet.has(`${cr},${cc - 1}`)) {
          edges.push([x, y, x, y + cellSize]);
        }
        // Right edge
        if (cc === cols - 1 || !cellSet.has(`${cr},${cc + 1}`)) {
          edges.push([x + cellSize, y, x + cellSize, y + cellSize]);
        }
      }

      // Chain edges into an ordered outline
      const outline = chainEdges(edges);

      zones.push({
        type: zoneType,
        outline,
        area: cells.length * cellSize * cellSize,
      });
    }
  }

  return zones;
}

/** Chain boundary edge segments into a single closed polygon outline */
function chainEdges(edges: [number, number, number, number][]): number[] {
  if (edges.length === 0) return [];

  // Build adjacency: endpoint → list of edges that touch it
  const edgeMap = new Map<string, number[]>();
  const key = (x: number, y: number) => `${Math.round(x * 100)},${Math.round(y * 100)}`;

  for (let i = 0; i < edges.length; i++) {
    const [x1, y1, x2, y2] = edges[i];
    const k1 = key(x1, y1);
    const k2 = key(x2, y2);
    if (!edgeMap.has(k1)) edgeMap.set(k1, []);
    if (!edgeMap.has(k2)) edgeMap.set(k2, []);
    edgeMap.get(k1)!.push(i);
    edgeMap.get(k2)!.push(i);
  }

  // Walk the chain starting from the first edge
  const used = new Set<number>();
  const result: number[] = [];
  used.add(0);
  const [sx, sy, ex, ey] = edges[0];
  result.push(sx, sy, ex, ey);
  let currentEnd = key(ex, ey);

  for (let safety = 0; safety < edges.length + 1; safety++) {
    const candidates = edgeMap.get(currentEnd);
    if (!candidates) break;

    let found = false;
    for (const idx of candidates) {
      if (used.has(idx)) continue;
      used.add(idx);
      const [x1, y1, x2, y2] = edges[idx];
      const k1 = key(x1, y1);
      if (k1 === currentEnd) {
        result.push(x2, y2);
        currentEnd = key(x2, y2);
      } else {
        result.push(x1, y1);
        currentEnd = key(x1, y1);
      }
      found = true;
      break;
    }
    if (!found) break;
  }

  return result;
}

