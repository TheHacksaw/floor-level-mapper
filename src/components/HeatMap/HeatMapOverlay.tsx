import { Image as KonvaImage, Group, Text, Rect, Label, Tag, Line } from 'react-konva';
import type { KrigingResult, SpotInfo, ToleranceZone } from '../../lib/kriging';
import type { MeasurementPoint } from '../../types';

interface Props {
  image: HTMLImageElement | null;
  result: KrigingResult | null;
  spots: SpotInfo[];
  toleranceZones: ToleranceZone[];
  scale: number;
  measurements?: MeasurementPoint[];
  toleranceMm: number;
  toleranceOverMm: number;
  targetHeight?: number | null;
}

export function HeatMapOverlay({ image, result, spots, toleranceZones = [], scale, measurements = [], toleranceMm, toleranceOverMm, targetHeight }: Props) {
  if (!image || !result) return null;

  const { bounds, cols, rows, cellSize, mean } = result;
  const target = targetHeight ?? mean;
  const width = cols * cellSize;
  const height = rows * cellSize;
  const fontSize = Math.max(10, 12 / scale);

  return (
    <Group>
      {/* Heat map image */}
      <KonvaImage
        image={image}
        x={bounds.xmin}
        y={bounds.ymin}
        width={width}
        height={height}
      />

      {/* Tolerance zone outlines */}
      {toleranceZones.map((zone, i) => (
        <Line
          key={`zone-${i}`}
          points={zone.outline}
          closed
          fill={zone.type === 'high' ? 'rgba(255, 23, 68, 0.15)' : 'rgba(41, 121, 255, 0.15)'}
          stroke={zone.type === 'high' ? '#ff1744' : '#2979ff'}
          strokeWidth={Math.max(2, 3 / scale)}
          dash={[12 / scale, 6 / scale]}
          listening={false}
        />
      ))}

      {/* Tolerance zone labels */}
      {toleranceZones.map((zone, i) => {
        // Find centroid of the outline for label placement
        let cx = 0, cy = 0, n = 0;
        for (let j = 0; j < zone.outline.length; j += 2) {
          cx += zone.outline[j];
          cy += zone.outline[j + 1];
          n++;
        }
        if (n === 0) return null;
        cx /= n;
        cy /= n;
        const areaM2 = (zone.area / 1e6).toFixed(2);
        const label = zone.type === 'high' ? `GRIND (${areaM2}m²)` : `FILL (${areaM2}m²)`;

        return (
          <Group key={`zone-label-${i}`} x={cx} y={cy}>
            <Rect
              x={-40 / scale}
              y={-fontSize / 2 - 3 / scale}
              width={80 / scale}
              height={fontSize + 6 / scale}
              fill={zone.type === 'high' ? 'rgba(255, 23, 68, 0.85)' : 'rgba(41, 121, 255, 0.85)'}
              cornerRadius={4 / scale}
            />
            <Text
              x={-40 / scale}
              y={-fontSize / 2}
              width={80 / scale}
              text={label}
              fontSize={fontSize * 0.85}
              fill="#fff"
              fontStyle="bold"
              align="center"
            />
          </Group>
        );
      })}

      {/* Measurement deviation labels (no markers) */}
      {measurements?.filter((m) => m.value !== null).map((m) => {
        const deviation = m.value! - target;
        const sign = deviation >= 0 ? '+' : '';
        const color = deviation >= 0 ? '#cc0000' : '#0055cc';
        return (
          <Group key={m.id} x={m.x} y={m.y}>
            <Rect
              x={-24 / scale}
              y={-fontSize / 2 - 2 / scale}
              width={48 / scale}
              height={fontSize + 4 / scale}
              fill="rgba(255,255,255,0.85)"
              cornerRadius={3 / scale}
            />
            <Text
              x={-24 / scale}
              y={-fontSize / 2}
              width={48 / scale}
              text={`${sign}${deviation.toFixed(1)}`}
              fontSize={fontSize}
              fill={color}
              fontStyle="bold"
              align="center"
            />
          </Group>
        );
      })}

      {/* High/low spot annotations */}
      {spots.map((spot, i) => {
        const deviation = spot.value - target;
        const sign = deviation >= 0 ? '+' : '';
        return (
          <Group key={`spot-${i}`} x={spot.x} y={spot.y}>
            <Label offsetY={20 / scale}>
              <Tag
                fill={spot.type === 'high' ? '#ff1744' : '#2979ff'}
                cornerRadius={4 / scale}
                pointerDirection="down"
                pointerWidth={8 / scale}
                pointerHeight={6 / scale}
              />
              <Text
                text={`${spot.type === 'high' ? '▲ Grind' : '▼ Fill'} ${sign}${deviation.toFixed(1)}mm`}
                fontSize={fontSize}
                fill="#fff"
                padding={4 / scale}
              />
            </Label>
          </Group>
        );
      })}
    </Group>
  );
}

export function HeatMapLegend({
  min,
  max,
  mean,
  toleranceMm,
  toleranceOverMm,
  targetHeight,
  scale,
  canvasWidth,
}: {
  min: number;
  max: number;
  mean: number;
  toleranceMm: number;
  toleranceOverMm: number;
  targetHeight?: number | null;
  scale: number;
  canvasWidth: number;
}) {
  const target = targetHeight ?? mean;
  const legendWidth = 30;
  const legendHeight = 200;
  const x = canvasWidth - legendWidth - 20;
  const y = 20;
  const fontSize = 11;

  const stops = 20;
  const cellH = legendHeight / stops;

  const tolDistM = (toleranceOverMm / 1000).toFixed(1);
  // Tolerance lines: show ±toleranceMm from target as reference
  const range = max - min;
  const tolHighFrac = range > 0 ? 1 - ((target + toleranceMm - min) / range) : 0.5;
  const tolLowFrac = range > 0 ? 1 - ((target - toleranceMm - min) / range) : 0.5;
  const tolHighY = y + Math.max(0, Math.min(1, tolHighFrac)) * legendHeight;
  const tolLowY = y + Math.max(0, Math.min(1, tolLowFrac)) * legendHeight;

  return (
    <Group listening={false}>
      <Rect
        x={x - 55}
        y={y - 5}
        width={legendWidth + 65}
        height={legendHeight + 90}
        fill="rgba(255,255,255,0.9)"
        cornerRadius={8}
      />

      {Array.from({ length: stops }).map((_, i) => {
        const t = i / (stops - 1);
        const hue = t * 240;
        return (
          <Rect
            key={i}
            x={x}
            y={y + i * cellH}
            width={legendWidth}
            height={cellH + 1}
            fill={`hsl(${hue}, 100%, 50%)`}
          />
        );
      })}

      {/* Tolerance threshold markers on the gradient */}
      {tolHighY >= y && tolHighY <= y + legendHeight && (
        <>
          <Line points={[x - 5, tolHighY, x + legendWidth + 5, tolHighY]} stroke="#ff1744" strokeWidth={2} />
          <Text x={x + legendWidth + 8} y={tolHighY - 5} text="+" fontSize={9} fill="#ff1744" fontStyle="bold" />
        </>
      )}
      {tolLowY >= y && tolLowY <= y + legendHeight && (
        <>
          <Line points={[x - 5, tolLowY, x + legendWidth + 5, tolLowY]} stroke="#2979ff" strokeWidth={2} />
          <Text x={x + legendWidth + 8} y={tolLowY - 5} text="-" fontSize={9} fill="#2979ff" fontStyle="bold" />
        </>
      )}

      <Text x={x - 50} y={y} text={`+${(max - target).toFixed(1)}mm`} fontSize={fontSize} fill="#cc0000" />
      <Text x={x - 50} y={y + legendHeight / 2 - 6} text={`${targetHeight != null ? 'target' : 'avg'} ${target.toFixed(1)}mm`} fontSize={fontSize} fill="#333" />
      <Text x={x - 50} y={y + legendHeight - 12} text={`${(min - target).toFixed(1)}mm`} fontSize={fontSize} fill="#0055cc" />

      <Text x={x - 50} y={y + legendHeight + 10} text="▲ High = Grind" fontSize={fontSize} fill="#ff1744" />
      <Text x={x - 50} y={y + legendHeight + 25} text="▼ Low = Fill" fontSize={fontSize} fill="#2979ff" />
      <Text x={x - 50} y={y + legendHeight + 42} text={`Tol: ${toleranceMm}mm / ${tolDistM}m`} fontSize={10} fill="#333" fontStyle="bold" />
      <Text x={x - 50} y={y + legendHeight + 56} text="Slope-based zones" fontSize={9} fill="#666" />
    </Group>
  );
}
