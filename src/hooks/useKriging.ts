import { useMemo } from 'react';
import type { MeasurementPoint, FloorPlanShape, ProjectSettings } from '../types';
import { computeKriging, findHighLowSpots, findToleranceZones, type KrigingResult, type SpotInfo, type ToleranceZone } from '../lib/kriging';

interface UseKrigingResult {
  image: HTMLImageElement | null;
  result: KrigingResult | null;
  spots: SpotInfo[];
  toleranceZones: ToleranceZone[];
  isReady: boolean;
}

export function useKriging(
  measurements: MeasurementPoint[],
  shape: FloorPlanShape | undefined,
  settings: ProjectSettings | undefined
): UseKrigingResult {
  return useMemo(() => {
    if (!shape || !settings) {
      return { image: null, result: null, spots: [], toleranceZones: [], isReady: false };
    }

    const validCount = measurements.filter((m) => m.value !== null).length;
    if (validCount < 3) {
      return { image: null, result: null, spots: [], toleranceZones: [], isReady: false };
    }

    const result = computeKriging(
      measurements,
      shape,
      settings.gridResolution,
      settings.krigingModel
    );

    if (!result) {
      return { image: null, result: null, spots: [], toleranceZones: [], isReady: false };
    }

    const offscreen = document.createElement('canvas');
    offscreen.width = result.cols;
    offscreen.height = result.rows;
    const ctx = offscreen.getContext('2d');
    if (!ctx) {
      return { image: null, result, spots: [], toleranceZones: [], isReady: false };
    }
    ctx.putImageData(result.imageData, 0, 0);

    const img = new Image();
    img.src = offscreen.toDataURL();

    const spots = findHighLowSpots(result, settings.toleranceMm, settings.toleranceOverMm, settings.targetHeight);
    const toleranceZones = findToleranceZones(result, settings.toleranceMm, settings.toleranceOverMm, settings.targetHeight);

    return { image: img, result, spots, toleranceZones, isReady: true };
  }, [measurements, shape, settings]);
}
