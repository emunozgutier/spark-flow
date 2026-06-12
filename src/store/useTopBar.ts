import { create } from 'zustand';

export type TopBarMenu = 'file' | 'anotate' | 'passives' | 'sources' | 'actives' | 'animation' | 'probes' | 'simulate' | 'debug';

interface TopBarState {
  activeMenu: TopBarMenu;
  setActiveMenu: (menu: TopBarMenu) => void;
}

export const useTopBar = create<TopBarState>((set) => ({
  activeMenu: 'anotate',
  setActiveMenu: (menu) => set({ activeMenu: menu }),
}));
