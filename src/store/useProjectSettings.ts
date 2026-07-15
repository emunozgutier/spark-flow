import { create } from 'zustand';

export type ESeries = 'E3' | 'E6' | 'E12' | 'E24';

interface ProjectSettingsState {
  eSeries: ESeries;
  setESeries: (series: ESeries) => void;
  resistorBorderPadding: number;
  wireBorderWidth: number;
  setResistorBorderPadding: (val: number) => void;
  setWireBorderWidth: (val: number) => void;
}

export const useProjectSettings = create<ProjectSettingsState>((set) => ({
  eSeries: 'E24',
  setESeries: (series) => set({ eSeries: series }),
  resistorBorderPadding: 12.5,
  wireBorderWidth: 35.5,
  setResistorBorderPadding: (val) => set({ resistorBorderPadding: val }),
  setWireBorderWidth: (val) => set({ wireBorderWidth: val }),
}));
