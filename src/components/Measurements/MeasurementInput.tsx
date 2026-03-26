import { useState, useEffect, useRef } from 'react';
import { BottomSheet } from '../Layout/BottomSheet';

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (value: number) => void;
  onDelete?: () => void;
  initialValue?: number | null;
  coordinates?: { x: number; y: number };
  onUpdateCoordinates?: (x: number, y: number) => void;
}

export function MeasurementInput({
  open,
  onClose,
  onSave,
  onDelete,
  initialValue,
  coordinates,
  onUpdateCoordinates,
}: Props) {
  const [value, setValue] = useState('');
  const [coordX, setCoordX] = useState('');
  const [coordY, setCoordY] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setValue(initialValue != null ? String(initialValue) : '');
      if (coordinates) {
        setCoordX(String(Math.round(coordinates.x)));
        setCoordY(String(Math.round(coordinates.y)));
      }
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, initialValue, coordinates]);

  const handleSave = () => {
    const num = parseFloat(value);
    if (isNaN(num)) return;

    // Update coordinates if changed
    if (onUpdateCoordinates && coordinates) {
      const nx = parseFloat(coordX);
      const ny = parseFloat(coordY);
      if (!isNaN(nx) && !isNaN(ny) && (nx !== coordinates.x || ny !== coordinates.y)) {
        onUpdateCoordinates(nx, ny);
      }
    }

    onSave(num);
    onClose();
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Height Measurement">
      <div className="measurement-form">
        {coordinates && (
          <div className="coord-fields">
            <label className="field field-inline">
              <span>X (mm)</span>
              <input
                type="number"
                inputMode="numeric"
                value={coordX}
                onChange={(e) => setCoordX(e.target.value)}
              />
            </label>
            <label className="field field-inline">
              <span>Y (mm)</span>
              <input
                type="number"
                inputMode="numeric"
                value={coordY}
                onChange={(e) => setCoordY(e.target.value)}
              />
            </label>
          </div>
        )}

        <label className="field">
          <span>Height reading (mm)</span>
          <input
            ref={inputRef}
            type="number"
            inputMode="decimal"
            step="0.1"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            placeholder="e.g. 3.5"
            className="large-input"
          />
        </label>

        <div className="measurement-actions">
          {onDelete && (
            <button className="btn-danger" onClick={() => { onDelete(); onClose(); }}>
              Delete Point
            </button>
          )}
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={!value}>
            Save
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
