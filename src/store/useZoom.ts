import { create } from 'zustand';
import type { Point, CanvasElement, CardElement } from '../dataTypes/AnotateType';

interface ZoomState {
  zoom: number;
  offset: Point;
  setZoom: (newZoom: number | ((z: number) => number)) => void;
  setOffset: (newOffset: Point | ((p: Point) => Point)) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetView: () => void;
  fitView: (elements: CanvasElement[]) => void;
}

export const useZoom = create<ZoomState>((set, get) => ({
  zoom: 1.75,
  offset: { x: 150, y: 150 },
  
  setZoom: (newZoom) => set((state) => {
    let nextZoom = typeof newZoom === 'function' ? newZoom(state.zoom) : newZoom;
    // Clamp zoom scale between 0.15x and 4x
    nextZoom = Math.max(0.15, Math.min(4.0, nextZoom));
    return { zoom: nextZoom };
  }),

  setOffset: (newOffset) => set((state) => {
    const nextOffset = typeof newOffset === 'function' ? newOffset(state.offset) : newOffset;
    return { offset: nextOffset };
  }),

  zoomIn: () => get().setZoom((z) => z + 0.1),
  
  zoomOut: () => get().setZoom((z) => z - 0.1),

  resetView: () => set({
    offset: { x: window.innerWidth / 2 - 400, y: window.innerHeight / 2 - 250 },
    zoom: 1.75
  }),

  fitView: (elements) => {
    const cards = elements.filter((el) => el.type === 'card') as CardElement[];
    if (cards.length === 0) {
      set({
        offset: { x: window.innerWidth / 2 - 400, y: window.innerHeight / 2 - 250 },
        zoom: 1.75
      });
      return;
    }

    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    cards.forEach((c) => {
      minX = Math.min(minX, c.x);
      minY = Math.min(minY, c.y);
      maxX = Math.max(maxX, c.x + c.width);
      maxY = Math.max(maxY, c.y + c.height);
    });

    const padding = 100;
    const boardW = maxX - minX + padding * 2;
    const boardH = maxY - minY + padding * 2;

    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;

    const scaleX = viewportW / boardW;
    const scaleY = viewportH / boardH;
    let zoomVal = Math.min(scaleX, scaleY, 1.2); // Cap zoom fit at 1.2
    zoomVal = Math.max(0.3, zoomVal); // Lower clamp at 0.3

    const offsetX = viewportW / 2 - (minX + (maxX - minX) / 2) * zoomVal;
    const offsetY = viewportH / 2 - (minY + (maxY - minY) / 2) * zoomVal;

    set({
      zoom: zoomVal,
      offset: { x: offsetX, y: offsetY }
    });
  }
}));
