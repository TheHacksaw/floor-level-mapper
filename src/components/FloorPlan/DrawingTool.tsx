import { useState, useCallback, useRef } from 'react';
import { Line, Circle, Group, Text } from 'react-konva';
import type { Point2D } from '../../types';
import { distanceBetween } from '../../lib/geometry';
import { useProjectStore } from '../../store/useProjectStore';

interface Props {
  scale: number;
  onComplete: () => void;
  shiftHeld: boolean;
}

const CLOSE_THRESHOLD_PX = 20;
const SNAP_ANGLE_THRESHOLD_PX = 15; // proximity snap within 15 screen pixels of H/V axis
const DOUBLE_TAP_MS = 400;
const DOUBLE_TAP_DIST_PX = 30;

/** Snap to H/V axis of last point. Forced when shift held, or auto when close enough. */
export function snapToAxis(
  point: Point2D,
  lastPoint: Point2D | null,
  shiftHeld: boolean,
  scale: number
): Point2D {
  if (!lastPoint) return point;
  const dx = Math.abs(point.x - lastPoint.x);
  const dy = Math.abs(point.y - lastPoint.y);
  const dxScreen = dx * scale;
  const dyScreen = dy * scale;

  if (shiftHeld) {
    // Force snap
    return dxScreen > dyScreen
      ? { x: point.x, y: lastPoint.y }
      : { x: lastPoint.x, y: point.y };
  }

  // Proximity snap: if within threshold of being perfectly H or V, snap it
  if (dyScreen < SNAP_ANGLE_THRESHOLD_PX && dxScreen > SNAP_ANGLE_THRESHOLD_PX * 2) {
    return { x: point.x, y: lastPoint.y }; // snap horizontal
  }
  if (dxScreen < SNAP_ANGLE_THRESHOLD_PX && dyScreen > SNAP_ANGLE_THRESHOLD_PX * 2) {
    return { x: lastPoint.x, y: point.y }; // snap vertical
  }

  return point;
}

export function DrawingTool({ scale, onComplete, shiftHeld }: Props) {
  const [vertices, setVertices] = useState<Point2D[]>([]);
  const [cursorPos, setCursorPos] = useState<Point2D | null>(null);
  const updateProjectShape = useProjectStore((s) => s.updateProjectShape);

  // Double-tap tracking
  const lastTapTime = useRef(0);
  const lastTapPos = useRef<Point2D | null>(null);

  const lastVertex = vertices.length > 0 ? vertices[vertices.length - 1] : null;

  const handleCanvasTap = useCallback(
    (worldX: number, worldY: number) => {
      const now = Date.now();
      const tapPos = { x: worldX, y: worldY };

      // Check for double-tap to remove nearest vertex
      if (
        lastTapPos.current &&
        now - lastTapTime.current < DOUBLE_TAP_MS &&
        distanceBetween(tapPos, lastTapPos.current) * scale < DOUBLE_TAP_DIST_PX
      ) {
        // Find nearest vertex within threshold
        let nearestIdx = -1;
        let nearestDist = Infinity;
        for (let i = 0; i < vertices.length; i++) {
          const d = distanceBetween(tapPos, vertices[i]) * scale;
          if (d < DOUBLE_TAP_DIST_PX && d < nearestDist) {
            nearestDist = d;
            nearestIdx = i;
          }
        }
        if (nearestIdx >= 0) {
          setVertices((prev) => prev.filter((_, i) => i !== nearestIdx));
          lastTapTime.current = 0; // reset so triple-tap doesn't trigger
          lastTapPos.current = null;
          return;
        }
      }

      lastTapTime.current = now;
      lastTapPos.current = tapPos;

      let newPoint = snapToAxis(tapPos, lastVertex, shiftHeld, scale);

      // Check if closing the polygon
      if (vertices.length >= 3) {
        const screenDist = distanceBetween(newPoint, vertices[0]) * scale;
        if (screenDist < CLOSE_THRESHOLD_PX) {
          const walls = vertices.map((_, i) => ({
            from: i,
            to: (i + 1) % vertices.length,
            length: Math.round(distanceBetween(vertices[i], vertices[(i + 1) % vertices.length])),
          }));
          updateProjectShape({ type: 'polygon', vertices: [...vertices], walls });
          setVertices([]);
          onComplete();
          return;
        }
      }

      setVertices((prev) => [...prev, newPoint]);
    },
    [vertices, scale, updateProjectShape, onComplete, lastVertex, shiftHeld]
  );

  const handleCursorMove = useCallback((worldX: number, worldY: number) => {
    let pos: Point2D = { x: worldX, y: worldY };
    pos = snapToAxis(pos, lastVertex, shiftHeld, scale);
    setCursorPos(pos);
  }, [lastVertex, shiftHeld, scale]);

  const undoLastPoint = useCallback(() => {
    setVertices((prev) => prev.slice(0, -1));
  }, []);

  const cancel = useCallback(() => {
    setVertices([]);
  }, []);

  const markerRadius = Math.max(6, 8 / scale);
  const closeHighlightRadius = Math.max(10, 14 / scale);
  const strokeW = 2 / scale;
  const fontSize = Math.max(12, 14 / scale);

  const linePoints = vertices.flatMap((v) => [v.x, v.y]);
  if (cursorPos && vertices.length > 0) {
    linePoints.push(cursorPos.x, cursorPos.y);
  }

  const nearClose =
    cursorPos &&
    vertices.length >= 3 &&
    distanceBetween(cursorPos, vertices[0]) * scale < CLOSE_THRESHOLD_PX;

  // Check if cursor is snapped (for visual feedback)
  const isSnapped = cursorPos && lastVertex && (
    cursorPos.x === lastVertex.x || cursorPos.y === lastVertex.y
  );

  return {
    element: (
      <Group>
        {/* Snap guide lines */}
        {isSnapped && cursorPos && lastVertex && (
          <Line
            points={[lastVertex.x, lastVertex.y, cursorPos.x, cursorPos.y]}
            stroke="rgba(76, 175, 80, 0.4)"
            strokeWidth={1 / scale}
          />
        )}

        {linePoints.length >= 4 && (
          <Line
            points={linePoints}
            stroke="#2196F3"
            strokeWidth={strokeW}
            dash={[10 / scale, 5 / scale]}
          />
        )}

        {vertices.map((v, i) => (
          <Circle
            key={i}
            x={v.x}
            y={v.y}
            radius={i === 0 && nearClose ? closeHighlightRadius : markerRadius}
            fill={i === 0 ? '#4CAF50' : '#2196F3'}
            stroke="#fff"
            strokeWidth={strokeW}
          />
        ))}

        {vertices.map((v, i) => {
          if (i === vertices.length - 1) return null;
          const next = vertices[i + 1];
          const mx = (v.x + next.x) / 2;
          const my = (v.y + next.y) / 2;
          const len = Math.round(distanceBetween(v, next));
          return (
            <Text
              key={`label-${i}`}
              x={mx}
              y={my - fontSize - 4 / scale}
              text={`${len}mm`}
              fontSize={fontSize}
              fill="#666"
            />
          );
        })}

        {nearClose && (
          <Text
            x={vertices[0].x + 15 / scale}
            y={vertices[0].y - 15 / scale}
            text="Tap to close"
            fontSize={fontSize}
            fill="#4CAF50"
          />
        )}
      </Group>
    ),
    handleCanvasTap,
    handleCursorMove,
    undoLastPoint,
    cancel,
    isDrawing: vertices.length > 0,
    vertexCount: vertices.length,
  };
}
