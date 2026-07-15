import { create } from 'zustand';

export type TopBarMenu = 'file' | 'animation' | 'simulate' | 'debug';

interface TopBarState {
  activeMenu: TopBarMenu;
  setActiveMenu: (menu: TopBarMenu) => void;
}

export const useTopBar = create<TopBarState>((set) => ({
  activeMenu: 'file',
  setActiveMenu: (menu) => set({ activeMenu: menu }),
}));
