import { useState, useCallback, useRef } from 'react';
import type { KonvaEventObject } from 'konva/lib/Node';

export interface CanvasTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export function useCanvasTransform(initialScale = 0.1) {
  const [transform, setTransform] = useState<CanvasTransform>({
    scale: initialScale,
    offsetX: 50,
    offsetY: 50,
  });

  const lastPinchDist = useRef<number | null>(null);
  const lastPinchCenter = useRef<{ x: number; y: number } | null>(null);
  const isDragging = useRef(false);
  const lastDragPos = useRef<{ x: number; y: number } | null>(null);

  const handleWheel = useCallback((e: KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = e.target.getStage();
    if (!stage) return;

    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const scaleBy = 1.1;
    const direction = e.evt.deltaY < 0 ? 1 : -1;

    setTransform((prev) => {
      const newScale = direction > 0 ? prev.scale * scaleBy : prev.scale / scaleBy;
      const clampedScale = Math.max(0.01, Math.min(2, newScale));

      // Zoom toward pointer position
      const mouseX = pointer.x;
      const mouseY = pointer.y;
      const newOffsetX = mouseX - ((mouseX - prev.offsetX) / prev.scale) * clampedScale;
      const newOffsetY = mouseY - ((mouseY - prev.offsetY) / prev.scale) * clampedScale;

      return { scale: clampedScale, offsetX: newOffsetX, offsetY: newOffsetY };
    });
  }, []);

  const handleTouchMove = useCallback((e: KonvaEventObject<TouchEvent>) => {
    const touches = e.evt.touches;
    if (touches.length === 2) {
      e.evt.preventDefault();
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const cx = (touches[0].clientX + touches[1].clientX) / 2;
      const cy = (touches[0].clientY + touches[1].clientY) / 2;

      if (lastPinchDist.current !== null && lastPinchCenter.current) {
        const scaleFactor = dist / lastPinchDist.current;
        setTransform((prev) => {
          const newScale = Math.max(0.01, Math.min(2, prev.scale * scaleFactor));
          const newOffsetX = cx - ((cx - prev.offsetX) / prev.scale) * newScale;
          const newOffsetY = cy - ((cy - prev.offsetY) / prev.scale) * newScale;
          return { scale: newScale, offsetX: newOffsetX, offsetY: newOffsetY };
        });
      }

      lastPinchDist.current = dist;
      lastPinchCenter.current = { x: cx, y: cy };
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    lastPinchDist.current = null;
    lastPinchCenter.current = null;
    isDragging.current = false;
    lastDragPos.current = null;
  }, []);

  const handleMouseDown = useCallback((e: KonvaEventObject<MouseEvent>) => {
    // Right-click or middle-click for panning
    if (e.evt.button === 1 || e.evt.button === 2) {
      isDragging.current = true;
      lastDragPos.current = { x: e.evt.clientX, y: e.evt.clientY };
      e.evt.preventDefault();
    }
  }, []);

  const handleMouseMove = useCallback((e: KonvaEventObject<MouseEvent>) => {
    if (isDragging.current && lastDragPos.current) {
      const dx = e.evt.clientX - lastDragPos.current.x;
      const dy = e.evt.clientY - lastDragPos.current.y;
      lastDragPos.current = { x: e.evt.clientX, y: e.evt.clientY };
      setTransform((prev) => ({
        ...prev,
        offsetX: prev.offsetX + dx,
        offsetY: prev.offsetY + dy,
      }));
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
    lastDragPos.current = null;
  }, []);

  // Single-finger pan for non-draw modes
  const startPan = useCallback((x: number, y: number) => {
    isDragging.current = true;
    lastDragPos.current = { x, y };
  }, []);

  const movePan = useCallback((x: number, y: number) => {
    if (isDragging.current && lastDragPos.current) {
      const dx = x - lastDragPos.current.x;
      const dy = y - lastDragPos.current.y;
      lastDragPos.current = { x, y };
      setTransform((prev) => ({
        ...prev,
        offsetX: prev.offsetX + dx,
        offsetY: prev.offsetY + dy,
      }));
    }
  }, []);

  const endPan = useCallback(() => {
    isDragging.current = false;
    lastDragPos.current = null;
  }, []);

  const fitToView = useCallback((shapeWidth: number, shapeHeight: number, canvasWidth: number, canvasHeight: number) => {
    const padding = 60;
    const scaleX = (canvasWidth - padding * 2) / shapeWidth;
    const scaleY = (canvasHeight - padding * 2) / shapeHeight;
    const newScale = Math.min(scaleX, scaleY, 1);
    const offsetX = (canvasWidth - shapeWidth * newScale) / 2;
    const offsetY = (canvasHeight - shapeHeight * newScale) / 2;
    setTransform({ scale: newScale, offsetX, offsetY });
  }, []);

  return {
    transform,
    setTransform,
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
  };
}
