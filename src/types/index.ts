export interface Point2D {
  x: number; // mm
  y: number; // mm
}

export interface MeasurementPoint {
  id: string;
  x: number; // mm, relative to floor plan origin
  y: number; // mm, relative to floor plan origin
  value: number | null; // mm reading from laser level, null if not yet entered
  timestamp: number;
  label?: string;
}

export interface WallSegment {
  from: number; // vertex index
  to: number; // vertex index
  length: number; // mm
}

export type FloorPlanShape =
  | { type: 'rectangle'; width: number; height: number }
  | { type: 'polygon'; vertices: Point2D[]; walls: WallSegment[] };

export interface FloorProject {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  shape: FloorPlanShape;
  measurements: MeasurementPoint[];
  settings: ProjectSettings;
}

export interface ProjectSettings {
  krigingModel: 'exponential' | 'gaussian' | 'spherical';
  gridResolution: number; // mm per grid cell
  referenceHeight?: number; // optional zero datum
  toleranceMm: number; // mm of deviation allowed
  toleranceOverMm: number; // over this distance in mm (e.g. 3000 for 3m)
  targetHeight: number | null; // mm — the height to level the floor to. null = use average
}

export type AppMode = 'draw' | 'measure' | 'heatmap';
