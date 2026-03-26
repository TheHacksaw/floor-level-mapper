import { useProjectStore } from '../../store/useProjectStore';
import type { AppMode } from '../../types';

const modes: { key: AppMode; label: string; icon: string }[] = [
  { key: 'draw', label: 'Draw', icon: '✏️' },
  { key: 'measure', label: 'Measure', icon: '📍' },
  { key: 'heatmap', label: 'Heat Map', icon: '🗺️' },
];

export function Toolbar() {
  const mode = useProjectStore((s) => s.mode);
  const setMode = useProjectStore((s) => s.setMode);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);

  return (
    <div className="toolbar">
      {modes.map((m) => (
        <button
          key={m.key}
          className={`toolbar-btn ${mode === m.key ? 'active' : ''}`}
          onClick={() => setMode(m.key)}
          disabled={!activeProjectId && m.key !== 'draw'}
        >
          <span className="toolbar-icon">{m.icon}</span>
          <span className="toolbar-label">{m.label}</span>
        </button>
      ))}
    </div>
  );
}
