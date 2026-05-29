import { create } from 'zustand';
import type { ThemeColor } from '../types';

export interface ColorThemeDefinition {
  name: ThemeColor;
  main: string;
  glow: string;
  text: string;
  bg: string;
  display: string;
}

export type FontSizeOption = 'small' | 'medium' | 'large' | 'xlarge';

export interface FontSizeDefinition {
  size: number;
  label: string;
}

interface StyleState {
  themeColor: ThemeColor;
  fontSize: FontSizeOption;
  fontFamily: string;
  lightMode: boolean;
  
  // Themes & Sizes Metadata List
  colorThemes: Record<ThemeColor, ColorThemeDefinition>;
  fontSizes: Record<FontSizeOption, FontSizeDefinition>;
  
  // Actions
  setThemeColor: (color: ThemeColor) => void;
  setFontSize: (size: FontSizeOption) => void;
  setFontFamily: (family: string) => void;
  toggleLightMode: () => void;
}

const COLOR_THEMES: Record<ThemeColor, ColorThemeDefinition> = {
  slate: {
    name: 'slate',
    main: '#64748b',
    glow: 'rgba(100, 116, 139, 0.25)',
    text: '#94a3b8',
    bg: '#10121a',
    display: 'Slate'
  },
  amethyst: {
    name: 'amethyst',
    main: '#a855f7',
    glow: 'rgba(168, 85, 247, 0.25)',
    text: '#d8b4fe',
    bg: '#14101a',
    display: 'Amethyst'
  },
  sapphire: {
    name: 'sapphire',
    main: '#3b82f6',
    glow: 'rgba(59, 130, 246, 0.25)',
    text: '#93c5fd',
    bg: '#10141a',
    display: 'Sapphire'
  },
  emerald: {
    name: 'emerald',
    main: '#10b981',
    glow: 'rgba(16, 185, 129, 0.25)',
    text: '#6ee7b7',
    bg: '#101a14',
    display: 'Emerald'
  },
  coral: {
    name: 'coral',
    main: '#f43f5e',
    glow: 'rgba(244, 63, 94, 0.25)',
    text: '#fda4af',
    bg: '#1a1012',
    display: 'Coral'
  },
  amber: {
    name: 'amber',
    main: '#f59e0b',
    glow: 'rgba(245, 158, 11, 0.25)',
    text: '#fde047',
    bg: '#1a1810',
    display: 'Amber'
  }
};

const FONT_SIZES: Record<FontSizeOption, FontSizeDefinition> = {
  small: { size: 11, label: 'Small' },
  medium: { size: 13, label: 'Medium' },
  large: { size: 16, label: 'Large' },
  xlarge: { size: 20, label: 'Extra Large' }
};

export const useStyle = create<StyleState>((set) => ({
  themeColor: 'amethyst',
  fontSize: 'medium',
  fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
  lightMode: false,
  
  colorThemes: COLOR_THEMES,
  fontSizes: FONT_SIZES,

  setThemeColor: (color: ThemeColor) => set({ themeColor: color }),
  
  setFontSize: (size: FontSizeOption) => set({ fontSize: size }),
  
  setFontFamily: (family: string) => set({ fontFamily: family }),
  
  toggleLightMode: () => set((state) => {
    const nextLightMode = !state.lightMode;
    // Toggle class directly on html document root element to update global CSS variable sets
    if (nextLightMode) {
      document.documentElement.classList.add('light-mode');
    } else {
      document.documentElement.classList.remove('light-mode');
    }
    return { lightMode: nextLightMode };
  })
}));
