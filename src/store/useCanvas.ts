import { create } from 'zustand';
import type { UseBoundStore, StoreApi } from 'zustand';
import { temporal } from 'zundo';
import type { TemporalState } from 'zundo';
import type { CanvasElement, CardElement, ArrowElement, ToolType, ThemeColor, Port } from '../dataTypes/AnotateType';

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
        return parsed.map((el) => {
          if (el.type === 'box') {
            const card = el as CardElement;
            if (card.componentType && card.componentType !== 'ground') {
              if (card.height === 90) {
                return {
                  ...card,
                  height: 60,
                  y: card.y + 25
                };
              } else if (card.height === 40) {
                return {
                  ...card,
                  height: 60
                };
              }
            }
          }
          return el;
        });
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
  selectedIds: string[];
  activeTool: ToolType;
  liveDCOn: boolean;
  
  // Actions
  setActiveTool: (tool: ToolType) => void;
  setSelectedId: (id: string | null) => void;
  setSelectedIds: (ids: string[]) => void;
  setLiveDCOn: (on: boolean) => void;
  addCard: (x: number, y: number, width?: number, height?: number, componentType?: 'resistor' | 'capacitor' | 'inductor' | 'ground' | 'voltage' | 'current' | 'diode') => void;
  addArrow: (arrow: Omit<ArrowElement, 'id' | 'type'>) => void;
  updateElement: (id: string, updates: Partial<any>, record?: boolean) => void;
  updateCardPosition: (id: string, x: number, y: number) => void;
  updateCardSize: (id: string, width: number, height: number) => void;
  finalizeDrag: () => void;
  deleteElement: (id: string) => void;
  clearCanvas: () => void;
  loadElements: (elements: CanvasElement[]) => void;
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
        selectedIds: [] as string[],
        activeTool: 'select' as ToolType,
        liveDCOn: true,

        setActiveTool: (tool: ToolType) => set({ activeTool: tool }),
        setLiveDCOn: (on: boolean) => set({ liveDCOn: on }),
        
        setSelectedId: (id: string | null) => set(() => {
          if (id === null) {
            return { selectedId: null, selectedIds: [] };
          } else {
            return { selectedId: id, selectedIds: [id] };
          }
        }),

        setSelectedIds: (ids: string[]) => set(() => {
          return {
            selectedIds: ids,
            selectedId: ids.length === 1 ? ids[0] : (ids.length > 0 ? ids[0] : null)
          };
        }),

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

        addCard: (x: number, y: number, width?: number, height?: number, componentType?: 'resistor' | 'capacitor' | 'inductor' | 'ground' | 'voltage' | 'current' | 'diode') => {
          (useCanvas as any).temporal?.getState().resume();
          
          let defaultWidth = 200;
          let defaultHeight = 120;
          let title = 'New Idea';
          let content = 'Click here to write something wonderful...';
          let color: ThemeColor = 'amethyst';

          let val: number | undefined = undefined;
          let instanceNumber: number | undefined = undefined;
          let ports: Port[] | undefined = undefined;

          const cardId = `card-${Date.now()}`;

          if (componentType) {
            const sameTypeElements = get().elements.filter(
              (el) => el.type === 'box' && (el as CardElement).componentType === componentType
            );
            instanceNumber = sameTypeElements.length + 1;

            if (componentType === 'ground') {
              ports = [
                { id: `${cardId}-top`, direction: 'top', isConnected: false }
              ];
              val = undefined;
              color = 'amethyst';
              defaultWidth = 60;
              defaultHeight = 60;
            } else {
              ports = [
                { id: `${cardId}-left`, direction: 'left', isConnected: false },
                { id: `${cardId}-right`, direction: 'right', isConnected: false }
              ];

              if (componentType === 'resistor') {
                val = 1000;
                color = 'amber';
              } else if (componentType === 'capacitor') {
                val = 10e-6; // 10uF
                color = 'sapphire';
              } else if (componentType === 'inductor') {
                val = 10e-3; // 10mH
                color = 'amethyst';
              } else if (componentType === 'voltage') {
                val = 5; // 5V
                color = 'sapphire';
              } else if (componentType === 'current') {
                val = 0.001; // 1mA
                color = 'amethyst';
              } else if (componentType === 'diode') {
                val = undefined;
                color = 'amber';
              }
              defaultWidth = 60;
              defaultHeight = 60;
            }
          } else {
            const colors: ThemeColor[] = ['amethyst', 'sapphire', 'emerald', 'amber', 'coral', 'slate'];
            color = colors[Math.floor(Math.random() * colors.length)];
          }

          const newCard: CardElement = {
            id: cardId,
            type: 'box', // BoxAnnotation datatype
            x: Math.round(x / 10) * 10,
            y: Math.round(y / 10) * 10,
            width: componentType ? defaultWidth : (width !== undefined ? Math.round(width / 10) * 10 : defaultWidth),
            height: componentType ? defaultHeight : (height !== undefined ? Math.round(height / 10) * 10 : defaultHeight),
            title: componentType ? undefined : title,
            content: componentType ? undefined : content,
            color,
            componentType,
            instanceNumber,
            value: val,
            ports
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
            
            const snappedUpdates = { ...updates };
            if (el.type === 'box') {
              if (snappedUpdates.x !== undefined) snappedUpdates.x = Math.round(snappedUpdates.x / 10) * 10;
              if (snappedUpdates.y !== undefined) snappedUpdates.y = Math.round(snappedUpdates.y / 10) * 10;
              if (snappedUpdates.width !== undefined) snappedUpdates.width = Math.round(snappedUpdates.width / 10) * 10;
              if (snappedUpdates.height !== undefined) snappedUpdates.height = Math.round(snappedUpdates.height / 10) * 10;

              // Prevent setting green (emerald), red (coral), or grey (slate) on CircuitElements
              if ((el as CardElement).componentType !== undefined) {
                if (snappedUpdates.color === 'slate' || snappedUpdates.color === 'emerald' || snappedUpdates.color === 'coral') {
                  snappedUpdates.color = 'amethyst';
                }
              }
            }

            return {
              ...el,
              ...snappedUpdates
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
            return { ...el, x: Math.round(x / 10) * 10, y: Math.round(y / 10) * 10 };
          });
          set({ elements: nextElements });
        },

        updateCardSize: (id: string, width: number, height: number) => {
          (useCanvas as any).temporal?.getState().pause();

          const nextElements = get().elements.map((el) => {
            if (el.id !== id || el.type !== 'box') return el;
            if ((el as CardElement).componentType) return el; // Prevent resizing passive components
            return { ...el, width: Math.round(width / 10) * 10, height: Math.round(height / 10) * 10 };
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

          const idsToDelete = get().selectedIds.includes(id) ? get().selectedIds : [id];

          // 1. Initial filter to remove deleted items and any wires attached to them
          let nextElements = get().elements.filter((el) => {
            if (idsToDelete.includes(el.id)) return false;
            if (el.type === 'arrow') {
              const arrow = el as ArrowElement;
              return (!arrow.fromId || !idsToDelete.includes(arrow.fromId)) && 
                     (!arrow.toId || !idsToDelete.includes(arrow.toId));
            }
            return true;
          });

          // Helper to trace non-join end of a wire connected to a join card
          const getOtherEnd = (arrow: ArrowElement, joinId: string) => {
            if (arrow.fromId === joinId) {
              return {
                id: arrow.toId,
                socket: arrow.toSocket,
                point: arrow.toPoint
              };
            } else {
              return {
                id: arrow.fromId,
                socket: arrow.fromSocket,
                point: arrow.fromPoint
              };
            }
          };

          // 2. Iteratively find joins with <= 2 connections, delete them, and merge their connections if exactly 2
          let changed = true;
          while (changed) {
            changed = false;
            const currentCards = nextElements.filter(el => el.type === 'box') as CardElement[];
            const currentArrows = nextElements.filter(el => el.type === 'arrow') as ArrowElement[];

            const joinToDelete = currentCards.find(card => {
              const isJoin = card.id.startsWith('join') || card.title === 'join';
              if (!isJoin) return false;

              const connections = currentArrows.filter(arrow => 
                arrow.fromId === card.id || arrow.toId === card.id
              );
              return connections.length <= 2;
            });

            if (joinToDelete) {
              const connections = currentArrows.filter(arrow => 
                arrow.fromId === joinToDelete.id || arrow.toId === joinToDelete.id
              );

              // Remove this join
              nextElements = nextElements.filter(el => el.id !== joinToDelete.id);

              if (connections.length === 2) {
                const [arrow1, arrow2] = connections;

                // Remove both arrows
                nextElements = nextElements.filter(el => el.id !== arrow1.id && el.id !== arrow2.id);

                // Merge them into one
                const end1 = getOtherEnd(arrow1, joinToDelete.id);
                const end2 = getOtherEnd(arrow2, joinToDelete.id);

                const mergedArrow: ArrowElement = {
                  id: arrow1.id, // reuse id
                  type: 'arrow',
                  fromId: end1.id,
                  fromSocket: end1.socket,
                  fromPoint: end1.point,
                  toId: end2.id,
                  toSocket: end2.socket,
                  toPoint: end2.point,
                  color: arrow1.color || arrow2.color || 'amber',
                  style: arrow1.style || arrow2.style || 'straight',
                  label: arrow1.label || arrow2.label || ''
                };

                nextElements.push(mergedArrow);
              } else {
                // If 1 or 0 connections, just remove the connections as well
                connections.forEach(arrow => {
                  nextElements = nextElements.filter(el => el.id !== arrow.id);
                });
              }

              changed = true;
            }
          }

          set({ elements: nextElements, selectedId: null, selectedIds: [] });
          saveToStorage(nextElements);
        },

        clearCanvas: () => {
          (useCanvas as any).temporal?.getState().resume();
          set({ elements: [], selectedId: null });
          saveToStorage([]);
        },
        loadElements: (elements: CanvasElement[]) => {
          (useCanvas as any).temporal?.getState().resume();
          const migrated = elements.map((el) => {
            if (el.type === 'box') {
              const card = el as CardElement;
              if (card.componentType && card.componentType !== 'ground') {
                if (card.height === 90) {
                  return {
                    ...card,
                    height: 60,
                    y: card.y + 25
                  };
                } else if (card.height === 40) {
                  return {
                    ...card,
                    height: 60
                  };
                }
              }
            }
            return el;
          });
          set({ elements: migrated, selectedId: null });
          saveToStorage(migrated);
        }
      };
    },
    {
      partialize: (state) => ({ elements: state.elements }),
      limit: 40
    }
  )
);
