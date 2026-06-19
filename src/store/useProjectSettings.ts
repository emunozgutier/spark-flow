import { create } from 'zustand';

export type ESeries = 'E3' | 'E6' | 'E12' | 'E24';

interface ProjectSettingsState {
  eSeries: ESeries;
  setESeries: (series: ESeries) => void;
}

export const useProjectSettings = create<ProjectSettingsState>((set) => ({
  eSeries: 'E24',
  setESeries: (series) => set({ eSeries: series }),
}));
