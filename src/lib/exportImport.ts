import type { FloorProject } from '../types';

export function exportProject(project: FloorProject): void {
  const json = JSON.stringify(project, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${project.name.replace(/\s+/g, '_')}_${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importProject(file: File): Promise<FloorProject> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);
        if (!data.id || !data.shape || !data.measurements) {
          throw new Error('Invalid project file: missing required fields');
        }
        resolve(data as FloorProject);
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}
