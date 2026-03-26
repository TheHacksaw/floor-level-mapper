import { useProjectStore } from '../../store/useProjectStore';

interface Props {
  onClose: () => void;
}

export function ProjectList({ onClose }: Props) {
  const projects = useProjectStore((s) => s.projects);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const setActiveProject = useProjectStore((s) => s.setActiveProject);
  const deleteProject = useProjectStore((s) => s.deleteProject);

  return (
    <div className="project-list">
      <h3>Saved Floor Plans</h3>
      {projects.length === 0 && (
        <p className="hint">No floor plans yet. Create one to get started.</p>
      )}
      {projects.map((p) => (
        <div
          key={p.id}
          className={`project-item ${p.id === activeProjectId ? 'active' : ''}`}
          onClick={() => {
            setActiveProject(p.id);
            onClose();
          }}
        >
          <div className="project-item-info">
            <strong>{p.name}</strong>
            <span className="project-meta">
              {p.shape.type === 'rectangle'
                ? `${p.shape.width}mm × ${p.shape.height}mm`
                : `${p.shape.vertices.length} vertices`}
              {' · '}
              {p.measurements.length} points
            </span>
          </div>
          <button
            className="btn-danger-sm"
            onClick={(e) => {
              e.stopPropagation();
              if (confirm('Delete this floor plan?')) {
                deleteProject(p.id);
              }
            }}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
