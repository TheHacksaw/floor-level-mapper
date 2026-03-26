import type { Point2D, FloorPlanShape } from '../types';

export function screenToWorld(
  px: number,
  py: number,
  scale: number,
  offsetX: number,
  offsetY: number
): Point2D {
  return {
    x: (px - offsetX) / scale,
    y: (py - offsetY) / scale,
  };
}

export function worldToScreen(
  mx: number,
  my: number,
  scale: number,
  offsetX: number,
  offsetY: number
): { px: number; py: number } {
  return {
    px: mx * scale + offsetX,
    py: my * scale + offsetY,
  };
}

export function pointInPolygon(point: Point2D, vertices: Point2D[]): boolean {
  let inside = false;
  const n = vertices.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = vertices[i].x, yi = vertices[i].y;
    const xj = vertices[j].x, yj = vertices[j].y;
    if (
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi
    ) {
      inside = !inside;
    }
  }
  return inside;
}

export function pointInShape(point: Point2D, shape: FloorPlanShape): boolean {
  if (shape.type === 'rectangle') {
    return point.x >= 0 && point.x <= shape.width && point.y >= 0 && point.y <= shape.height;
  }
  return pointInPolygon(point, shape.vertices);
}

export function getShapeBounds(shape: FloorPlanShape): {
  xmin: number; xmax: number; ymin: number; ymax: number;
} {
  if (shape.type === 'rectangle') {
    return { xmin: 0, xmax: shape.width, ymin: 0, ymax: shape.height };
  }
  const xs = shape.vertices.map((v) => v.x);
  const ys = shape.vertices.map((v) => v.y);
  return {
    xmin: Math.min(...xs),
    xmax: Math.max(...xs),
    ymin: Math.min(...ys),
    ymax: Math.max(...ys),
  };
}

export function distanceBetween(a: Point2D, b: Point2D): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

export function getShapeVertices(shape: FloorPlanShape): Point2D[] {
  if (shape.type === 'rectangle') {
    return [
      { x: 0, y: 0 },
      { x: shape.width, y: 0 },
      { x: shape.width, y: shape.height },
      { x: 0, y: shape.height },
    ];
  }
  return shape.vertices;
}

export function wallMidpoint(a: Point2D, b: Point2D): Point2D {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}
