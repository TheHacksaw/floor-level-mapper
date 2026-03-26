import { useState } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import type { FloorPlanShape } from '../../types';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function NewProjectDialog({ open, onClose }: Props) {
  const [name, setName] = useState('');
  const [shapeType, setShapeType] = useState<'rectangle' | 'polygon'>('rectangle');
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const createProject = useProjectStore((s) => s.createProject);
  const setMode = useProjectStore((s) => s.setMode);

  if (!open) return null;

  const handleCreate = () => {
    const projectName = name.trim() || 'Untitled Room';
    let shape: FloorPlanShape;

    if (shapeType === 'rectangle') {
      const w = parseFloat(width);
      const h = parseFloat(height);
      if (!w || !h || w <= 0 || h <= 0) return;
      shape = { type: 'rectangle', width: w, height: h };
    } else {
      shape = { type: 'polygon', vertices: [], walls: [] };
    }

    createProject(projectName, shape);
    setMode(shapeType === 'polygon' ? 'draw' : 'measure');
    setName('');
    setWidth('');
    setHeight('');
    onClose();
  };

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h2>New Floor Plan</h2>

        <label className="field">
          <span>Room Name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Kitchen"
          />
        </label>

        <div className="field">
          <span>Shape</span>
          <div className="shape-toggle">
            <button
              className={shapeType === 'rectangle' ? 'active' : ''}
              onClick={() => setShapeType('rectangle')}
            >
              Rectangle
            </button>
            <button
              className={shapeType === 'polygon' ? 'active' : ''}
              onClick={() => setShapeType('polygon')}
            >
              Custom Shape
            </button>
          </div>
        </div>

        {shapeType === 'rectangle' && (
          <div className="dimension-inputs">
            <label className="field">
              <span>Width (mm)</span>
              <input
                type="number"
                inputMode="numeric"
                value={width}
                onChange={(e) => setWidth(e.target.value)}
                placeholder="e.g. 4000"
              />
            </label>
            <label className="field">
              <span>Height (mm)</span>
              <input
                type="number"
                inputMode="numeric"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                placeholder="e.g. 3000"
              />
            </label>
          </div>
        )}

        {shapeType === 'polygon' && (
          <p className="hint">
            You'll draw the floor plan shape by tapping points on the canvas.
          </p>
        )}

        <div className="dialog-actions">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary"
            onClick={handleCreate}
            disabled={shapeType === 'rectangle' && (!width || !height)}
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
