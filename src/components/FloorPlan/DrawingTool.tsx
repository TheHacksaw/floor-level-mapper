import { useState, useCallback } from 'react';
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

export function snapToAxis(point: Point2D, lastPoint: Point2D | null, shiftHeld: boolean): Point2D {
  if (!shiftHeld || !lastPoint) return point;
  const dx = Math.abs(point.x - lastPoint.x);
  const dy = Math.abs(point.y - lastPoint.y);
  if (dx > dy) {
    return { x: point.x, y: lastPoint.y }; // snap horizontal
  } else {
    return { x: lastPoint.x, y: point.y }; // snap vertical
  }
}

export function DrawingTool({ scale, onComplete, shiftHeld }: Props) {
  const [vertices, setVertices] = useState<Point2D[]>([]);
  const [cursorPos, setCursorPos] = useState<Point2D | null>(null);
  const updateProjectShape = useProjectStore((s) => s.updateProjectShape);

  const lastVertex = vertices.length > 0 ? vertices[vertices.length - 1] : null;

  const handleCanvasTap = useCallback(
    (worldX: number, worldY: number) => {
      let newPoint: Point2D = { x: worldX, y: worldY };
      newPoint = snapToAxis(newPoint, lastVertex, shiftHeld);

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
    pos = snapToAxis(pos, lastVertex, shiftHeld);
    setCursorPos(pos);
  }, [lastVertex, shiftHeld]);

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

  return {
    element: (
      <Group>
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
