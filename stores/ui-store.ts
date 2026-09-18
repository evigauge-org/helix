import { create } from "zustand";

export interface ArtifactPreview {
  url: string;
  title: string;
  type: "md" | "xlsx" | "docx" | "pdf" | "txt" | "csv" | string;
}

interface UIState {
  artifactPreview: ArtifactPreview | null;
  artifactsPanelOpen: boolean;

  openArtifactPreview: (preview: ArtifactPreview) => void;
  closeArtifactPreview: () => void;
  openArtifactsPanel: () => void;
  closeArtifactsPanel: () => void;
  toggleArtifactsPanel: () => void;

  deepResearch: boolean;
  setDeepResearch: (on: boolean) => void;
  memoryPaused: boolean;
  setMemoryPaused: (paused: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  artifactPreview: null,
  artifactsPanelOpen: false,

  openArtifactPreview: (preview) => set({ artifactPreview: preview }),
  closeArtifactPreview: () => set({ artifactPreview: null }),
  openArtifactsPanel: () => set({ artifactsPanelOpen: true }),
  closeArtifactsPanel: () => set({ artifactsPanelOpen: false }),
  toggleArtifactsPanel: () => set((s) => ({ artifactsPanelOpen: !s.artifactsPanelOpen })),

  deepResearch: false,
  setDeepResearch: (on) => set({ deepResearch: on }),
  memoryPaused: false,
  setMemoryPaused: (paused) => set({ memoryPaused: paused }),
}));
