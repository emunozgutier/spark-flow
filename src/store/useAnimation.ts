import { create } from 'zustand';

interface AnimationState {
  speedMultiplier: number;
  isPaused: boolean;
  setSpeedMultiplier: (speed: number) => void;
  setIsPaused: (isPaused: boolean) => void;
  togglePlayPause: () => void;
}

export const useAnimation = create<AnimationState>((set) => ({
  speedMultiplier: 1.0,
  isPaused: false,
  setSpeedMultiplier: (speedMultiplier) => set({ speedMultiplier }),
  setIsPaused: (isPaused) => set({ isPaused }),
  togglePlayPause: () => set((state) => ({ isPaused: !state.isPaused })),
}));
