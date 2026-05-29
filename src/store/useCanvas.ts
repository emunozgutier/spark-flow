import { create } from 'zustand';
import type { CanvasElement, CardElement, ArrowElement, ToolType, ThemeColor } from '../types';

const STORAGE_KEY = 'spark-flow:board-elements';

// Beautiful preloaded starter board elements
const DEFAULT_ELEMENTS: CanvasElement[] = [
  {
    id: 'node-welcome',
    type: 'card',
    x: 100,
    y: 100,
    width: 240,
    height: 140,
    title: '✨ Welcome to Spark Flow',
    content: 'An elegant, high-performance infinite board. Double-click here to edit or customize colors in the right-side inspector.',
    color: 'amethyst'
  },
  {
    id: 'node-canvas',
    type: 'card',
    x: 480,
    y: 0,
    width: 220,
    height: 120,
    title: '🚀 High Performance Grid',
    content: 'Pan around by holding Spacebar + Dragging, or scroll to zoom in/out relative to your mouse pointer.',
    color: 'sapphire'
  },
  {
    id: 'node-arrows',
    type: 'card',
    x: 480,
    y: 220,
    width: 220,
    height: 120,
    title: '🔗 Anchored Connectors',
    content: 'Drag from card edge sockets to create arrows. Move cards, and arrows automatically stretch with them!',
    color: 'emerald'
  },
  {
    id: 'arrow-1',
    type: 'arrow',
    fromId: 'node-welcome',
    fromSocket: 'right',
    toId: 'node-canvas',
    toSocket: 'left',
    color: 'slate',
    style: 'curved',
    label: 'Interactive Zoom'
  },
  {
    id: 'arrow-2',
    type: 'arrow',
    fromId: 'node-welcome',
    fromSocket: 'right',
    toId: 'node-arrows',
    toSocket: 'left',
    color: 'amethyst',
    style: 'dashed',
    label: 'Dynamic Links'
  }
];

const loadInitialElements = (): CanvasElement[] => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to load canvas elements:', e);
  }
  return DEFAULT_ELEMENTS;
};

interface CanvasState {
  elements: CanvasElement[];
  selectedId: string | null;
  activeTool: ToolType;
  past: CanvasElement[][];
  future: CanvasElement[][];
  
  // Actions
  setActiveTool: (tool: ToolType) => void;
  setSelectedId: (id: string | null) => void;
  addCard: (x: number, y: number) => void;
  addArrow: (arrow: Omit<ArrowElement, 'id' | 'type'>) => void;
  updateElement: (id: string, updates: Partial<CanvasElement>, record?: boolean) => void;
  updateCardPosition: (id: string, x: number, y: number) => void;
  updateCardSize: (id: string, width: number, height: number) => void;
  finalizeDrag: () => void;
  deleteElement: (id: string) => void;
  clearCanvas: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

export const useCanvas = create<CanvasState>((set, get) => {
  const saveToStorage = (elements: CanvasElement[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(elements));
  };

  const recordHistory = () => {
    const { elements, past } = get();
    // Capture deep copy of elements list to avoid reference mutations
    const snap = JSON.parse(JSON.stringify(elements));
    const nextPast = [...past, snap];
    if (nextPast.length > 40) nextPast.shift(); // Limit memory depth
    set({
      past: nextPast,
      future: []
    });
  };

  return {
    elements: loadInitialElements(),
    selectedId: null,
    activeTool: 'select',
    past: [],
    future: [],

    setActiveTool: (tool) => set({ activeTool: tool }),
    
    setSelectedId: (id) => set({ selectedId: id }),

    canUndo: () => get().past.length > 0,
    
    canRedo: () => get().future.length > 0,

    undo: () => {
      const { past, elements, future } = get();
      if (past.length === 0) return;

      const prev = past[past.length - 1];
      const nextPast = past.slice(0, -1);
      const snap = JSON.parse(JSON.stringify(elements));

      set({
        elements: prev,
        past: nextPast,
        future: [...future, snap],
        selectedId: null
      });
      saveToStorage(prev);
    },

    redo: () => {
      const { future, elements, past } = get();
      if (future.length === 0) return;

      const next = future[future.length - 1];
      const nextFuture = future.slice(0, -1);
      const snap = JSON.parse(JSON.stringify(elements));

      set({
        elements: next,
        past: [...past, snap],
        future: nextFuture,
        selectedId: null
      });
      saveToStorage(next);
    },

    addCard: (x, y) => {
      recordHistory();
      
      const colors: ThemeColor[] = ['amethyst', 'sapphire', 'emerald', 'amber', 'coral', 'slate'];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];

      const newCard: CardElement = {
        id: `card-${Date.now()}`,
        type: 'card',
        x,
        y,
        width: 200,
        height: 120,
        title: 'New Idea',
        content: 'Click here to write something wonderful...',
        color: randomColor
      };

      const nextElements = [...get().elements, newCard];
      set({ elements: nextElements, selectedId: newCard.id });
      saveToStorage(nextElements);
    },

    addArrow: (arrow) => {
      recordHistory();

      const newArrow: ArrowElement = {
        ...arrow,
        id: `arrow-${Date.now()}`,
        type: 'arrow'
      };

      const nextElements = [...get().elements, newArrow];
      set({ elements: nextElements, selectedId: newArrow.id });
      saveToStorage(nextElements);
    },

    updateElement: (id, updates, record = true) => {
      if (record) recordHistory();

      const nextElements = get().elements.map((el) => {
        if (el.id !== id) return el;
        return {
          ...el,
          ...updates
        } as CanvasElement;
      });

      set({ elements: nextElements });
      saveToStorage(nextElements);
    },

    updateCardPosition: (id, x, y) => {
      const nextElements = get().elements.map((el) => {
        if (el.id !== id || el.type !== 'card') return el;
        return { ...el, x, y };
      });
      set({ elements: nextElements });
    },

    updateCardSize: (id, width, height) => {
      const nextElements = get().elements.map((el) => {
        if (el.id !== id || el.type !== 'card') return el;
        return { ...el, width, height };
      });
      set({ elements: nextElements });
    },

    finalizeDrag: () => {
      // Save position to localStorage and push history snapshot
      recordHistory();
      saveToStorage(get().elements);
    },

    deleteElement: (id) => {
      recordHistory();

      const nextElements = get().elements.filter((el) => {
        if (el.id === id) return false;
        // Clean up linked connectors anchored to this deleted card
        if (el.type === 'arrow') {
          return el.fromId !== id && el.toId !== id;
        }
        return true;
      });

      set({ elements: nextElements, selectedId: null });
      saveToStorage(nextElements);
    },

    clearCanvas: () => {
      recordHistory();
      set({ elements: [], selectedId: null });
      saveToStorage([]);
    }
  };
});
