import { useRef } from 'react';
import { Line, Rect, Text, Group, Circle } from 'react-konva';
import type { FloorPlanShape as ShapeType, Point2D } from '../../types';
import { getShapeVertices, wallMidpoint, distanceBetween } from '../../lib/geometry';

interface Props {
  shape: ShapeType;
  scale: number;
  editable?: boolean;
  onWallTap?: (wallIndex: number) => void;
  onVertexDrag?: (vertexIndex: number, newPos: Point2D) => void;
  onVertexDragEnd?: (vertexIndex: number, newPos: Point2D) => void;
  onVertexRemove?: (vertexIndex: number) => void;
}

export function FloorPlanShapeRenderer({ shape, scale, editable, onWallTap, onVertexDrag, onVertexDragEnd, onVertexRemove }: Props) {
  const vertices = getShapeVertices(shape);

  if (shape.type === 'rectangle') {
    return (
      <Group>
        <Rect
          x={0}
          y={0}
          width={shape.width}
          height={shape.height}
          fill="#f8f9fa"
          stroke="#333"
          strokeWidth={2 / scale}
        />
        <WallLabels vertices={vertices} scale={scale} onWallTap={onWallTap} />
        {editable && (
          <EditHandles
            vertices={vertices}
            scale={scale}
            onVertexDrag={onVertexDrag}
            onVertexDragEnd={onVertexDragEnd}
            canRemove={false}
          />
        )}
      </Group>
    );
  }

  if (vertices.length < 3) return null;

  const flatPoints = vertices.flatMap((v) => [v.x, v.y]);

  return (
    <Group>
      <Line
        points={flatPoints}
        closed
        fill="#f8f9fa"
        stroke="#333"
        strokeWidth={2 / scale}
      />
      <WallLabels vertices={vertices} scale={scale} onWallTap={onWallTap} />
      {editable && (
        <EditHandles
          vertices={vertices}
          scale={scale}
          onVertexDrag={onVertexDrag}
          onVertexDragEnd={onVertexDragEnd}
          onVertexRemove={onVertexRemove}
          canRemove={vertices.length > 3}
        />
      )}
    </Group>
  );
}

function EditHandles({
  vertices,
  scale,
  onVertexDrag,
  onVertexDragEnd,
  onVertexRemove,
  canRemove,
}: {
  vertices: Point2D[];
  scale: number;
  onVertexDrag?: (vertexIndex: number, newPos: Point2D) => void;
  onVertexDragEnd?: (vertexIndex: number, newPos: Point2D) => void;
  onVertexRemove?: (vertexIndex: number) => void;
  canRemove?: boolean;
}) {
  const handleRadius = Math.max(8, 10 / scale);
  const lastTapRef = useRef<{ time: number; index: number }>({ time: 0, index: -1 });

  const handleTap = (index: number) => {
    const now = Date.now();
    if (
      canRemove &&
      lastTapRef.current.index === index &&
      now - lastTapRef.current.time < 400
    ) {
      onVertexRemove?.(index);
      lastTapRef.current = { time: 0, index: -1 };
    } else {
      lastTapRef.current = { time: now, index };
    }
  };

  return (
    <>
      {vertices.map((v, i) => (
        <Circle
          key={i}
          x={v.x}
          y={v.y}
          radius={handleRadius}
          fill="#4fc3f7"
          stroke="#fff"
          strokeWidth={2 / scale}
          draggable
          onDragMove={(e) => {
            onVertexDrag?.(i, { x: e.target.x(), y: e.target.y() });
          }}
          onDragEnd={(e) => {
            onVertexDragEnd?.(i, { x: e.target.x(), y: e.target.y() });
          }}
          onClick={() => handleTap(i)}
          onTap={() => handleTap(i)}
          hitStrokeWidth={10 / scale}
        />
      ))}
    </>
  );
}

function WallLabels({
  vertices,
  scale,
  onWallTap,
}: {
  vertices: { x: number; y: number }[];
  scale: number;
  onWallTap?: (wallIndex: number) => void;
}) {
  const fontSize = Math.max(12, 14 / scale);

  return (
    <>
      {vertices.map((v, i) => {
        const next = vertices[(i + 1) % vertices.length];
        const mid = wallMidpoint(v, next);
        const length = Math.round(distanceBetween(v, next));

        const angle = Math.atan2(next.y - v.y, next.x - v.x) * (180 / Math.PI);
        const normalAngle = (angle + 90) * (Math.PI / 180);
        const offsetDist = 20 / scale;
        const labelX = mid.x + Math.cos(normalAngle) * offsetDist;
        const labelY = mid.y + Math.sin(normalAngle) * offsetDist;

        return (
          <Text
            key={i}
            x={labelX}
            y={labelY}
            text={`${length}mm`}
            fontSize={fontSize}
            fill="#555"
            align="center"
            offsetX={30 / scale}
            offsetY={fontSize / 2}
            onClick={() => onWallTap?.(i)}
            onTap={() => onWallTap?.(i)}
          />
        );
      })}
    </>
  );
}
