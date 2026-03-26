import { useState, useRef } from 'react';
import { useProjectStore } from './store/useProjectStore';
import { Toolbar } from './components/Layout/Toolbar';
import { FloorPlanCanvas } from './components/FloorPlan/FloorPlanCanvas';
import { NewProjectDialog } from './components/Projects/NewProjectDialog';
import { ProjectList } from './components/Projects/ProjectList';
import { exportProject, importProject } from './lib/exportImport';
import './App.css';

function App() {
  const [showNewProject, setShowNewProject] = useState(false);
  const [showProjectList, setShowProjectList] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const project = useProjectStore((s) => s.getActiveProject());
  const projects = useProjectStore((s) => s.projects);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const imported = await importProject(file);
      const store = useProjectStore.getState();
      const exists = store.projects.find((p) => p.id === imported.id);
      if (exists) {
        imported.id = crypto.randomUUID?.() ?? `${Date.now()}`;
      }
      useProjectStore.setState((state) => ({
        projects: [...state.projects, imported],
        activeProjectId: imported.id,
      }));
    } catch (err) {
      alert('Failed to import: ' + (err as Error).message);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <button className="btn-icon" onClick={() => setShowProjectList(true)} title="Projects">
            ☰
          </button>
          <h1 className="app-title">
            {project ? project.name : 'Floor Level Mapper'}
          </h1>
        </div>
        <div className="header-right">
          {project && (
            <button
              className="btn-sm"
              onClick={() => exportProject(project)}
              title="Export JSON"
            >
              Export
            </button>
          )}
          <button
            className="btn-sm"
            onClick={() => fileInputRef.current?.click()}
            title="Import JSON"
          >
            Import
          </button>
          <button className="btn-primary-sm" onClick={() => setShowNewProject(true)}>
            + New
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          style={{ display: 'none' }}
          onChange={handleImport}
        />
      </header>

      {activeProjectId && <Toolbar />}

      <main className="app-main">
        {activeProjectId ? (
          <FloorPlanCanvas />
        ) : (
          <div className="empty-state">
            <h2>Floor Level Mapper</h2>
            <p>Map your floor's surface level to find high and low spots.</p>
            <div className="empty-actions">
              <button className="btn-primary" onClick={() => setShowNewProject(true)}>
                Create Floor Plan
              </button>
              {projects.length > 0 && (
                <button className="btn-secondary" onClick={() => setShowProjectList(true)}>
                  Open Existing ({projects.length})
                </button>
              )}
            </div>
          </div>
        )}
      </main>

      <NewProjectDialog open={showNewProject} onClose={() => setShowNewProject(false)} />

      {showProjectList && (
        <div className="dialog-overlay" onClick={() => setShowProjectList(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <ProjectList onClose={() => setShowProjectList(false)} />
            <div className="dialog-actions">
              <button className="btn-secondary" onClick={() => setShowProjectList(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
