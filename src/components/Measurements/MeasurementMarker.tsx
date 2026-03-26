import { Circle, Group, Text } from 'react-konva';
import type { MeasurementPoint } from '../../types';
import { valueToColor } from '../../lib/colorScale';

interface Props {
  point: MeasurementPoint;
  scale: number;
  minValue: number;
  maxValue: number;
  isSelected: boolean;
  isTemporary?: boolean;
  onTapOuter: () => void;
  onTapInner: () => void;
}

export function MeasurementMarker({
  point,
  scale,
  minValue,
  maxValue,
  isSelected,
  isTemporary,
  onTapOuter,
  onTapInner,
}: Props) {
  const outerRadius = Math.max(8, 10 / scale);
  const innerRadius = Math.max(3, 4 / scale);
  const fontSize = Math.max(9, 10 / scale);
  const strokeW = Math.max(0.5, 1 / scale);

  const hasValue = point.value !== null;
  const fillColor = hasValue
    ? valueToColor(point.value!, minValue, maxValue)
    : '#999';

  return (
    <Group x={point.x} y={point.y} opacity={isTemporary ? 0.6 : 1}>
      {/* Outer circle — tap to select */}
      <Circle
        radius={outerRadius}
        fill={fillColor}
        stroke={isSelected ? '#fff' : '#333'}
        strokeWidth={isSelected ? 2 / scale : strokeW}
        opacity={0.8}
        onClick={onTapOuter}
        onTap={onTapOuter}
        hitStrokeWidth={10 / scale}
      />

      {/* Inner circle — tap to enter/edit height value */}
      <Circle
        radius={innerRadius}
        fill="#fff"
        stroke="#333"
        strokeWidth={strokeW}
        onClick={(e) => {
          e.cancelBubble = true;
          onTapInner();
        }}
        onTap={(e) => {
          e.cancelBubble = true;
          onTapInner();
        }}
      />

      {/* Value label */}
      {hasValue && (
        <Text
          x={outerRadius + 3 / scale}
          y={-fontSize / 2}
          text={`${point.value}mm`}
          fontSize={fontSize}
          fill="#333"
          fontStyle="bold"
        />
      )}

      {/* Coordinate label when selected */}
      {isSelected && (
        <Text
          x={outerRadius + 3 / scale}
          y={fontSize / 2 + 1 / scale}
          text={`(${Math.round(point.x)}, ${Math.round(point.y)})`}
          fontSize={fontSize * 0.85}
          fill="#666"
        />
      )}
    </Group>
  );
}
