import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuid } from 'uuid';
import type { FloorProject, FloorPlanShape, MeasurementPoint, AppMode, ProjectSettings } from '../types';

interface ProjectStore {
  projects: FloorProject[];
  activeProjectId: string | null;
  mode: AppMode;

  // Project actions
  createProject: (name: string, shape: FloorPlanShape) => string;
  deleteProject: (id: string) => void;
  setActiveProject: (id: string | null) => void;
  updateProjectShape: (shape: FloorPlanShape) => void;
  updateProjectSettings: (settings: Partial<ProjectSettings>) => void;

  // Mode
  setMode: (mode: AppMode) => void;

  // Measurement actions
  addMeasurement: (x: number, y: number) => string;
  updateMeasurement: (id: string, updates: Partial<MeasurementPoint>) => void;
  deleteMeasurement: (id: string) => void;

  // Helpers
  getActiveProject: () => FloorProject | undefined;
}

export const useProjectStore = create<ProjectStore>()(
  persist(
    (set, get) => ({
      projects: [],
      activeProjectId: null,
      mode: 'draw',

      createProject: (name, shape) => {
        const id = uuid();
        const project: FloorProject = {
          id,
          name,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          shape,
          measurements: [],
          settings: {
            krigingModel: 'exponential',
            gridResolution: 50,
            toleranceMm: 5,
            toleranceOverMm: 3000,
            targetHeight: null,
          },
        };
        set((state) => ({
          projects: [...state.projects, project],
          activeProjectId: id,
        }));
        return id;
      },

      deleteProject: (id) => {
        set((state) => ({
          projects: state.projects.filter((p) => p.id !== id),
          activeProjectId: state.activeProjectId === id ? null : state.activeProjectId,
        }));
      },

      setActiveProject: (id) => set({ activeProjectId: id }),

      updateProjectShape: (shape) => {
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === state.activeProjectId
              ? { ...p, shape, updatedAt: Date.now() }
              : p
          ),
        }));
      },

      updateProjectSettings: (settings) => {
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === state.activeProjectId
              ? { ...p, settings: { ...p.settings, ...settings }, updatedAt: Date.now() }
              : p
          ),
        }));
      },

      setMode: (mode) => set({ mode }),

      addMeasurement: (x, y) => {
        const id = uuid();
        const measurement: MeasurementPoint = {
          id,
          x,
          y,
          value: null,
          timestamp: Date.now(),
        };
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === state.activeProjectId
              ? { ...p, measurements: [...p.measurements, measurement], updatedAt: Date.now() }
              : p
          ),
        }));
        return id;
      },

      updateMeasurement: (id, updates) => {
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === state.activeProjectId
              ? {
                  ...p,
                  measurements: p.measurements.map((m) =>
                    m.id === id ? { ...m, ...updates } : m
                  ),
                  updatedAt: Date.now(),
                }
              : p
          ),
        }));
      },

      deleteMeasurement: (id) => {
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === state.activeProjectId
              ? {
                  ...p,
                  measurements: p.measurements.filter((m) => m.id !== id),
                  updatedAt: Date.now(),
                }
              : p
          ),
        }));
      },

      getActiveProject: () => {
        const state = get();
        return state.projects.find((p) => p.id === state.activeProjectId);
      },
    }),
    {
      name: 'floor-level-mapper-storage',
      version: 2,
      migrate: (persisted: any) => {
        if (persisted?.projects) {
          for (const p of persisted.projects) {
            if (!p.settings) continue;
            // Migrate old tolerance to new format
            if (p.settings.toleranceMm === undefined) {
              p.settings.toleranceMm = p.settings.tolerance ?? 5;
              p.settings.toleranceOverMm = 3000;
              delete p.settings.tolerance;
            }
            if (p.settings.targetHeight === undefined) {
              p.settings.targetHeight = null;
            }
          }
        }
        return persisted;
      },
    }
  )
);
