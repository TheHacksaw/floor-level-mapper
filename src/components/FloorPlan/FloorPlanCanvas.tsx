import { useState, useRef, useEffect, useCallback } from 'react';
import { Stage, Layer, Group, Line } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { useProjectStore } from '../../store/useProjectStore';
import { useCanvasTransform } from '../../hooks/useCanvasTransform';
import { useKriging } from '../../hooks/useKriging';
import { screenToWorld, pointInShape, getShapeBounds, getShapeVertices, distanceBetween } from '../../lib/geometry';
import { FloorPlanShapeRenderer } from './FloorPlanShape';
import { DrawingTool } from './DrawingTool';
import { MeasurementMarker } from '../Measurements/MeasurementMarker';
import { MeasurementInput } from '../Measurements/MeasurementInput';
import { HeatMapOverlay, HeatMapLegend } from '../HeatMap/HeatMapOverlay';
import type { Point2D } from '../../types';

export function FloorPlanCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 800, height: 600 });
  const [selectedMeasurementId, setSelectedMeasurementId] = useState<string | null>(null);
  const [measurementInputOpen, setMeasurementInputOpen] = useState(false);
  const [pendingMeasurementId, setPendingMeasurementId] = useState<string | null>(null);
  const [tentativePointId, setTentativePointId] = useState<string | null>(null);
  const [shiftHeld, setShiftHeld] = useState(false);
  const [cursorWorld, setCursorWorld] = useState<Point2D | null>(null);
  const [wallEditIndex, setWallEditIndex] = useState<number | null>(null);
  const [wallEditValue, setWallEditValue] = useState('');

  const mode = useProjectStore((s) => s.mode);
  const project = useProjectStore((s) => s.getActiveProject());
  const addMeasurement = useProjectStore((s) => s.addMeasurement);
  const updateMeasurement = useProjectStore((s) => s.updateMeasurement);
  const deleteMeasurement = useProjectStore((s) => s.deleteMeasurement);
  const updateProjectShape = useProjectStore((s) => s.updateProjectShape);
  const updateProjectSettings = useProjectStore((s) => s.updateProjectSettings);
  const setMode = useProjectStore((s) => s.setMode);

  const {
    transform,
    handleWheel,
    handleTouchMove,
    handleTouchEnd,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    startPan,
    movePan,
    endPan,
    fitToView,
  } = useCanvasTransform(0.1);

  const { image: heatmapImage, result: krigingResult, spots, toleranceZones } = useKriging(
    project?.measurements ?? [],
    project?.shape,
    project?.settings
  );

  // Track shift key
  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.key === 'Shift') setShiftHeld(true); };
    const up = (e: KeyboardEvent) => { if (e.key === 'Shift') setShiftHeld(false); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Fit to view when project changes
  useEffect(() => {
    if (project?.shape) {
      const { shape } = project;
      if (shape.type === 'rectangle') {
        fitToView(shape.width, shape.height, size.width, size.height);
      } else if (shape.vertices.length >= 3) {
        const xs = shape.vertices.map((v) => v.x);
        const ys = shape.vertices.map((v) => v.y);
        const w = Math.max(...xs) - Math.min(...xs);
        const h = Math.max(...ys) - Math.min(...ys);
        if (w > 0 && h > 0) fitToView(w, h, size.width, size.height);
      }
    }
  }, [project?.id, size.width, size.height]);

  const drawingTool = DrawingTool({
    scale: transform.scale,
    onComplete: () => setMode('measure'),
    shiftHeld,
  });

  const hasShape =
    project?.shape.type === 'rectangle' ||
    (project?.shape.type === 'polygon' && project.shape.vertices.length >= 3);

  // Measurement value range
  const measuredValues = (project?.measurements ?? [])
    .filter((m) => m.value !== null)
    .map((m) => m.value as number);
  const minValue = measuredValues.length > 0 ? Math.min(...measuredValues) : 0;
  const maxValue = measuredValues.length > 0 ? Math.max(...measuredValues) : 1;

  // Get shape bounds for crosshair
  const shapeBounds = project?.shape && hasShape ? getShapeBounds(project.shape) : null;

  // Handle vertex drag for editable shape
  const handleVertexDragEnd = useCallback(
    (vertexIndex: number, newPos: Point2D) => {
      if (!project?.shape) return;

      if (project.shape.type === 'rectangle') {
        // For rectangles, adjust width/height based on which corner was dragged
        const verts = getShapeVertices(project.shape);
        const updated = [...verts];
        updated[vertexIndex] = newPos;
        // Recalculate rect from corners
        const xs = updated.map((v) => v.x);
        const ys = updated.map((v) => v.y);
        const newWidth = Math.max(...xs) - Math.min(...xs);
        const newHeight = Math.max(...ys) - Math.min(...ys);
        if (newWidth > 0 && newHeight > 0) {
          updateProjectShape({ type: 'rectangle', width: Math.round(newWidth), height: Math.round(newHeight) });
        }
      } else if (project.shape.type === 'polygon') {
        const newVerts = [...project.shape.vertices];
        newVerts[vertexIndex] = { x: Math.round(newPos.x), y: Math.round(newPos.y) };
        const walls = newVerts.map((_, i) => ({
          from: i,
          to: (i + 1) % newVerts.length,
          length: Math.round(distanceBetween(newVerts[i], newVerts[(i + 1) % newVerts.length])),
        }));
        updateProjectShape({ type: 'polygon', vertices: newVerts, walls });
      }
    },
    [project?.shape, updateProjectShape]
  );

  // Handle wall tap for editing wall length
  const handleWallTap = useCallback((wallIndex: number) => {
    if (mode !== 'draw') return;
    if (!project?.shape) return;
    const verts = getShapeVertices(project.shape);
    const from = verts[wallIndex];
    const to = verts[(wallIndex + 1) % verts.length];
    setWallEditIndex(wallIndex);
    setWallEditValue(String(Math.round(distanceBetween(from, to))));
  }, [mode, project?.shape]);

  const handleWallLengthSave = useCallback(() => {
    if (wallEditIndex === null || !project?.shape) return;
    const newLength = parseFloat(wallEditValue);
    if (isNaN(newLength) || newLength <= 0) { setWallEditIndex(null); return; }

    const verts = getShapeVertices(project.shape);
    const from = verts[wallEditIndex];
    const to = verts[(wallEditIndex + 1) % verts.length];
    const currentLength = distanceBetween(from, to);
    if (currentLength === 0) { setWallEditIndex(null); return; }

    const ratio = newLength / currentLength;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const newTo = { x: from.x + dx * ratio, y: from.y + dy * ratio };
    const toIndex = (wallEditIndex + 1) % verts.length;

    if (project.shape.type === 'rectangle') {
      // For rectangles, adjust dimensions
      const isHorizontal = Math.abs(dy) < Math.abs(dx);
      if (isHorizontal) {
        updateProjectShape({ type: 'rectangle', width: Math.round(newLength), height: project.shape.height });
      } else {
        updateProjectShape({ type: 'rectangle', width: project.shape.width, height: Math.round(newLength) });
      }
    } else {
      const newVerts = [...project.shape.vertices];
      newVerts[toIndex] = { x: Math.round(newTo.x), y: Math.round(newTo.y) };
      const walls = newVerts.map((_, i) => ({
        from: i,
        to: (i + 1) % newVerts.length,
        length: Math.round(distanceBetween(newVerts[i], newVerts[(i + 1) % newVerts.length])),
      }));
      updateProjectShape({ type: 'polygon', vertices: newVerts, walls });
    }
    setWallEditIndex(null);
  }, [wallEditIndex, wallEditValue, project?.shape, updateProjectShape]);

  const handleStageClick = useCallback(
    (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
      // Don't handle clicks on draggable elements
      if (e.target !== e.target.getStage() && e.target.isDragging?.()) return;

      const stage = e.target.getStage();
      if (!stage) return;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      const world = screenToWorld(
        pointer.x, pointer.y,
        transform.scale, transform.offsetX, transform.offsetY
      );

      if (mode === 'draw' && project?.shape.type === 'polygon' && !hasShape) {
        drawingTool.handleCanvasTap(world.x, world.y);
        return;
      }

      if (mode === 'measure' && project?.shape && hasShape) {
        if (!pointInShape(world, project.shape)) return;

        // If we have a tentative point and user clicks the same point's marker,
        // that's handled by the marker's onTapOuter/onTapInner — don't reach here.
        // If user clicks elsewhere:
        if (tentativePointId) {
          // Remove the old tentative point and place a new one
          deleteMeasurement(tentativePointId);
        }

        // Place a new tentative point
        const id = addMeasurement(world.x, world.y);
        setTentativePointId(id);
        setSelectedMeasurementId(id);
      }
    },
    [mode, project, transform, hasShape, drawingTool, addMeasurement, deleteMeasurement, tentativePointId]
  );

  const handleStageMouseMove = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      handleMouseMove(e);

      const stage = e.target.getStage();
      if (!stage) return;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;
      const world = screenToWorld(
        pointer.x, pointer.y,
        transform.scale, transform.offsetX, transform.offsetY
      );

      // Update cursor for crosshair
      if (mode === 'measure') {
        setCursorWorld(world);
      }

      if (mode === 'draw' && !hasShape) {
        drawingTool.handleCursorMove(world.x, world.y);
      }
    },
    [mode, hasShape, transform, handleMouseMove, drawingTool]
  );

  const handleStageTouchStart = useCallback(
    (e: KonvaEventObject<TouchEvent>) => {
      if (mode !== 'draw' && e.evt.touches.length === 1) {
        const touch = e.evt.touches[0];
        startPan(touch.clientX, touch.clientY);
      }
    },
    [mode, startPan]
  );

  const handleStageTouchMove = useCallback(
    (e: KonvaEventObject<TouchEvent>) => {
      handleTouchMove(e);
      if (mode !== 'draw' && e.evt.touches.length === 1) {
        const touch = e.evt.touches[0];
        movePan(touch.clientX, touch.clientY);
      }
    },
    [mode, handleTouchMove, movePan]
  );

  // Confirm tentative point (user taps it again)
  const handleConfirmTentative = useCallback((id: string) => {
    if (id === tentativePointId) {
      // Confirmed — open the measurement dialog
      setTentativePointId(null);
      setPendingMeasurementId(id);
      setMeasurementInputOpen(true);
    }
  }, [tentativePointId]);

  const selectedMeasurement = project?.measurements.find(
    (m) => m.id === (pendingMeasurementId || selectedMeasurementId)
  );

  return (
    <div
      ref={containerRef}
      className="canvas-container"
      onContextMenu={(e) => e.preventDefault()}
      onMouseLeave={() => setCursorWorld(null)}
    >
      <Stage
        width={size.width}
        height={size.height}
        onWheel={handleWheel}
        onClick={handleStageClick}
        onTap={handleStageClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleStageMouseMove}
        onMouseUp={handleMouseUp}
        onTouchStart={handleStageTouchStart}
        onTouchMove={handleStageTouchMove}
        onTouchEnd={() => { handleTouchEnd(); endPan(); }}
      >
        <Layer
          scaleX={transform.scale}
          scaleY={transform.scale}
          x={transform.offsetX}
          y={transform.offsetY}
        >
          {/* Floor plan shape */}
          {project?.shape && hasShape && (
            <FloorPlanShapeRenderer
              shape={project.shape}
              scale={transform.scale}
              editable={mode === 'draw'}
              onWallTap={handleWallTap}
              onVertexDragEnd={handleVertexDragEnd}
            />
          )}

          {/* Heat map overlay */}
          {mode === 'heatmap' && (
            <HeatMapOverlay
              image={heatmapImage}
              result={krigingResult}
              spots={spots}
              toleranceZones={toleranceZones}
              scale={transform.scale}
              measurements={project?.measurements}
              toleranceMm={project?.settings.toleranceMm ?? 5}
              toleranceOverMm={project?.settings.toleranceOverMm ?? 3000}
              targetHeight={project?.settings.targetHeight}
            />
          )}

          {/* Crosshair in measure mode */}
          {mode === 'measure' && cursorWorld && shapeBounds && (
            <Group listening={false} opacity={0.3}>
              <Line
                points={[shapeBounds.xmin, cursorWorld.y, shapeBounds.xmax, cursorWorld.y]}
                stroke="#4fc3f7"
                strokeWidth={1 / transform.scale}
                dash={[8 / transform.scale, 4 / transform.scale]}
              />
              <Line
                points={[cursorWorld.x, shapeBounds.ymin, cursorWorld.x, shapeBounds.ymax]}
                stroke="#4fc3f7"
                strokeWidth={1 / transform.scale}
                dash={[8 / transform.scale, 4 / transform.scale]}
              />
            </Group>
          )}

          {/* Measurement markers — only in measure mode, hidden in heatmap */}
          {mode === 'measure' &&
            project?.measurements.map((m) => (
              <MeasurementMarker
                key={m.id}
                point={m}
                scale={transform.scale}
                minValue={minValue}
                maxValue={maxValue}
                isSelected={m.id === selectedMeasurementId}
                isTemporary={m.id === tentativePointId}
                onTapOuter={() => {
                  if (m.id === tentativePointId) {
                    handleConfirmTentative(m.id);
                  } else {
                    setSelectedMeasurementId(m.id);
                  }
                }}
                onTapInner={() => {
                  if (m.id === tentativePointId) {
                    handleConfirmTentative(m.id);
                  } else {
                    setPendingMeasurementId(m.id);
                    setMeasurementInputOpen(true);
                  }
                }}
              />
            ))}

          {/* Drawing tool */}
          {mode === 'draw' && !hasShape && drawingTool.element}
        </Layer>

        {/* HUD layer — fixed screen coordinates */}
        {mode === 'heatmap' && krigingResult && (
          <Layer>
            <HeatMapLegend
              min={krigingResult.min}
              max={krigingResult.max}
              mean={krigingResult.mean}
              toleranceMm={project?.settings.toleranceMm ?? 5}
              toleranceOverMm={project?.settings.toleranceOverMm ?? 3000}
              targetHeight={project?.settings.targetHeight}
              canvasWidth={size.width}
            />
          </Layer>
        )}
      </Stage>

      {/* Drawing controls */}
      {mode === 'draw' && !hasShape && drawingTool.isDrawing && (
        <div className="drawing-controls">
          <button className="btn-secondary" onClick={drawingTool.undoLastPoint}>
            Undo Point
          </button>
          <button className="btn-secondary" onClick={drawingTool.cancel}>
            Cancel
          </button>
          <span className="drawing-hint">
            {drawingTool.vertexCount} points · Hold Shift to snap H/V
          </span>
        </div>
      )}

      {/* Edit mode hint */}
      {mode === 'draw' && hasShape && (
        <div className="drawing-controls">
          <span className="drawing-hint">
            Drag vertices to reshape · Tap wall dimensions to edit
          </span>
        </div>
      )}

      {/* Measurement count indicator */}
      {mode === 'measure' && project && (
        <div className="measure-status">
          {project.measurements.length} points ·{' '}
          {project.measurements.filter((m) => m.value !== null).length} with values
          {tentativePointId && ' · Tap point again to set value'}
        </div>
      )}

      {/* Heatmap minimum points warning */}
      {mode === 'heatmap' && !krigingResult && (
        <div className="heatmap-warning">
          Need at least 3 measurement points with values for heat map.
          {project && ` Currently: ${project.measurements.filter((m) => m.value !== null).length}`}
        </div>
      )}

      {/* Tolerance control */}
      {mode === 'heatmap' && project && (
        <div className="tolerance-control">
          <label>
            <span>Target</span>
            <select
              value={project.settings.targetHeight === null ? 'average' : 'custom'}
              onChange={(e) => {
                if (e.target.value === 'average') {
                  updateProjectSettings({ targetHeight: null });
                } else {
                  updateProjectSettings({ targetHeight: krigingResult?.mean ?? 0 });
                }
              }}
            >
              <option value="average">Average ({krigingResult?.mean.toFixed(1) ?? '—'}mm)</option>
              <option value="custom">Custom height</option>
            </select>
          </label>
          {project.settings.targetHeight !== null && (
            <label>
              <span>Height</span>
              <input
                type="number"
                inputMode="decimal"
                step="0.5"
                value={project.settings.targetHeight ?? 0}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val)) updateProjectSettings({ targetHeight: val });
                }}
              />
              <span>mm</span>
            </label>
          )}
          <label>
            <span>Tolerance</span>
            <input
              type="number"
              inputMode="decimal"
              step="0.5"
              min="0.1"
              value={project.settings.toleranceMm ?? 5}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (!isNaN(val) && val > 0) updateProjectSettings({ toleranceMm: val });
              }}
            />
            <span>mm over</span>
            <input
              type="number"
              inputMode="numeric"
              step="500"
              min="100"
              value={project.settings.toleranceOverMm ?? 3000}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (!isNaN(val) && val > 0) updateProjectSettings({ toleranceOverMm: val });
              }}
            />
            <span>mm</span>
          </label>
          {toleranceZones.length > 0 && (
            <div className="tolerance-summary">
              {toleranceZones.filter((z) => z.type === 'high').length > 0 && (
                <span className="zone-badge zone-high">
                  {toleranceZones.filter((z) => z.type === 'high').length} grind
                </span>
              )}
              {toleranceZones.filter((z) => z.type === 'low').length > 0 && (
                <span className="zone-badge zone-low">
                  {toleranceZones.filter((z) => z.type === 'low').length} fill
                </span>
              )}
            </div>
          )}
          {toleranceZones.length === 0 && krigingResult && (
            <span className="zone-badge zone-ok">All within tolerance</span>
          )}
        </div>
      )}

      {/* Measurement input bottom sheet */}
      <MeasurementInput
        open={measurementInputOpen}
        onClose={() => {
          setMeasurementInputOpen(false);
          setPendingMeasurementId(null);
        }}
        onSave={(value) => {
          const id = pendingMeasurementId || selectedMeasurementId;
          if (id) updateMeasurement(id, { value });
        }}
        onDelete={
          pendingMeasurementId
            ? () => {
                deleteMeasurement(pendingMeasurementId);
                setPendingMeasurementId(null);
                setSelectedMeasurementId(null);
              }
            : undefined
        }
        initialValue={selectedMeasurement?.value}
        coordinates={
          selectedMeasurement
            ? { x: selectedMeasurement.x, y: selectedMeasurement.y }
            : undefined
        }
        onUpdateCoordinates={(x, y) => {
          const id = pendingMeasurementId || selectedMeasurementId;
          if (id) updateMeasurement(id, { x, y });
        }}
      />

      {/* Wall length edit dialog */}
      {wallEditIndex !== null && (
        <div className="dialog-overlay" onClick={() => setWallEditIndex(null)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <h2>Edit Wall Length</h2>
            <label className="field">
              <span>Length (mm)</span>
              <input
                type="number"
                inputMode="numeric"
                value={wallEditValue}
                onChange={(e) => setWallEditValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleWallLengthSave()}
                autoFocus
                className="large-input"
              />
            </label>
            <div className="dialog-actions">
              <button className="btn-secondary" onClick={() => setWallEditIndex(null)}>Cancel</button>
              <button className="btn-primary" onClick={handleWallLengthSave}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
