import { create } from 'zustand';
import type { UseBoundStore, StoreApi } from 'zustand';
import { temporal } from 'zundo';
import type { TemporalState } from 'zundo';
import type { CanvasElement, CardElement, ArrowElement, ToolType, ThemeColor } from '../dataTypes/AnotateType';

const STORAGE_KEY = 'spark-flow:board-elements';

// Beautiful preloaded starter board elements (safely cast as CardElement/ArrowElement)
const DEFAULT_ELEMENTS: CanvasElement[] = [
  {
    id: 'node-welcome',
    type: 'box',
    x: 100,
    y: 100,
    width: 240,
    height: 140,
    title: '✨ Welcome to Spark Flow',
    content: 'An elegant, high-performance infinite board. Double-click here to edit or customize colors in the right-side inspector.',
    color: 'amethyst'
  } as CardElement,
  {
    id: 'node-canvas',
    type: 'box',
    x: 480,
    y: 0,
    width: 220,
    height: 120,
    title: '🚀 High Performance Grid',
    content: 'Pan around by holding Spacebar + Dragging, or scroll to zoom in/out relative to your mouse pointer.',
    color: 'sapphire'
  } as CardElement,
  {
    id: 'node-arrows',
    type: 'box',
    x: 480,
    y: 220,
    width: 220,
    height: 120,
    title: '🔗 Anchored Connectors',
    content: 'Drag from card edge sockets to create arrows. Move cards, and arrows automatically stretch with them!',
    color: 'emerald'
  } as CardElement,
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
  } as ArrowElement,
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
  } as ArrowElement
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
  
  // Actions
  setActiveTool: (tool: ToolType) => void;
  setSelectedId: (id: string | null) => void;
  addCard: (x: number, y: number, width?: number, height?: number) => void;
  addArrow: (arrow: Omit<ArrowElement, 'id' | 'type'>) => void;
  updateElement: (id: string, updates: Partial<any>, record?: boolean) => void;
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

export const useCanvas: UseBoundStore<StoreApi<CanvasState>> & {
  temporal: StoreApi<TemporalState<{ elements: CanvasElement[] }>>;
} = create<CanvasState>()(
  temporal(
    (set, get) => {
      const saveToStorage = (elements: CanvasElement[]) => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(elements));
      };

      return {
        elements: loadInitialElements(),
        selectedId: null as string | null,
        activeTool: 'select' as ToolType,

        setActiveTool: (tool: ToolType) => set({ activeTool: tool }),
        
        setSelectedId: (id: string | null) => set({ selectedId: id }),

        canUndo: (): boolean => {
          return (useCanvas as any).temporal?.getState().pastStates.length > 0;
        },
        
        canRedo: (): boolean => {
          return (useCanvas as any).temporal?.getState().futureStates.length > 0;
        },

        undo: () => {
          if (get().canUndo()) {
            (useCanvas as any).temporal?.getState().undo();
            saveToStorage(get().elements);
            set({ selectedId: null });
          }
        },

        redo: () => {
          if (get().canRedo()) {
            (useCanvas as any).temporal?.getState().redo();
            saveToStorage(get().elements);
            set({ selectedId: null });
          }
        },

        addCard: (x: number, y: number, width?: number, height?: number) => {
          (useCanvas as any).temporal?.getState().resume();
          
          const colors: ThemeColor[] = ['amethyst', 'sapphire', 'emerald', 'amber', 'coral', 'slate'];
          const randomColor = colors[Math.floor(Math.random() * colors.length)];

          const newCard: CardElement = {
            id: `card-${Date.now()}`,
            type: 'box', // BoxAnnotation datatype
            x,
            y,
            width: width !== undefined ? width : 200,
            height: height !== undefined ? height : 120,
            title: 'New Idea',
            content: 'Click here to write something wonderful...',
            color: randomColor
          };

          const nextElements = [...get().elements, newCard];
          set({ elements: nextElements, selectedId: newCard.id });
          saveToStorage(nextElements);
        },

        addArrow: (arrow: Omit<ArrowElement, 'id' | 'type'>) => {
          (useCanvas as any).temporal?.getState().resume();

          const newArrow: ArrowElement = {
            ...arrow,
            id: `arrow-${Date.now()}`,
            type: 'arrow'
          };

          const nextElements = [...get().elements, newArrow];
          set({ elements: nextElements, selectedId: newArrow.id });
          saveToStorage(nextElements);
        },

        updateElement: (id: string, updates: Partial<any>, record = true) => {
          const temporalApi = (useCanvas as any).temporal?.getState();
          if (record) {
            temporalApi?.resume();
          } else {
            temporalApi?.pause();
          }

          const nextElements = get().elements.map((el) => {
            if (el.id !== id) return el;
            return {
              ...el,
              ...updates
            } as CanvasElement;
          });

          set({ elements: nextElements });
          if (record) {
            saveToStorage(nextElements);
          }
        },

        updateCardPosition: (id: string, x: number, y: number) => {
          (useCanvas as any).temporal?.getState().pause();

          const nextElements = get().elements.map((el) => {
            if (el.id !== id || el.type !== 'box') return el;
            return { ...el, x, y };
          });
          set({ elements: nextElements });
        },

        updateCardSize: (id: string, width: number, height: number) => {
          (useCanvas as any).temporal?.getState().pause();

          const nextElements = get().elements.map((el) => {
            if (el.id !== id || el.type !== 'box') return el;
            return { ...el, width, height };
          });
          set({ elements: nextElements });
        },

        finalizeDrag: () => {
          const { elements } = get();
          const temporalApi = (useCanvas as any).temporal?.getState();
          
          temporalApi?.resume();
          const nextElements = JSON.parse(JSON.stringify(elements));
          set({ elements: nextElements });
          
          saveToStorage(nextElements);
        },

        deleteElement: (id: string) => {
          (useCanvas as any).temporal?.getState().resume();

          const nextElements = get().elements.filter((el) => {
            if (el.id === id) return false;
            if (el.type === 'arrow') {
              const arrow = el as ArrowElement;
              return arrow.fromId !== id && arrow.toId !== id;
            }
            return true;
          });

          set({ elements: nextElements, selectedId: null });
          saveToStorage(nextElements);
        },

        clearCanvas: () => {
          (useCanvas as any).temporal?.getState().resume();
          set({ elements: [], selectedId: null });
          saveToStorage([]);
        }
      };
    },
    {
      partialize: (state) => ({ elements: state.elements }),
      limit: 40
    }
  )
);
