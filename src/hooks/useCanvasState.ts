import { useState, useEffect, useCallback, useRef } from 'react';
import type { CanvasElement, CanvasState, CardElement, ArrowElement, Point, ThemeColor } from '../types';

const STORAGE_KEY = 'spark-flow:board-state';

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

const DEFAULT_STATE: CanvasState = {
  pan: { x: 150, y: 150 },
  zoom: 1.0,
  elements: DEFAULT_ELEMENTS
};

export function useCanvasState() {
  const [state, setState] = useState<CanvasState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.elements && Array.isArray(parsed.elements)) {
          return {
            pan: parsed.pan || DEFAULT_STATE.pan,
            zoom: parsed.zoom || DEFAULT_STATE.zoom,
            elements: parsed.elements
          };
        }
      }
    } catch (e) {
      console.error('Failed to load canvas state:', e);
    }
    return DEFAULT_STATE;
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Undo & Redo stacks
  const historyRef = useRef<{
    past: CanvasState[];
    future: CanvasState[];
  }>({
    past: [],
    future: []
  });

  // Save current state to localStorage whenever elements change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  // Helper to push a new undo state, clearing any redo future
  const recordHistory = useCallback((currentState: CanvasState) => {
    const history = historyRef.current;
    // Cap history length at 40 states
    const newPast = [...history.past, JSON.parse(JSON.stringify(currentState))];
    if (newPast.length > 40) {
      newPast.shift();
    }
    history.past = newPast;
    history.future = [];
  }, []);

  const undo = useCallback(() => {
    const history = historyRef.current;
    if (history.past.length === 0) return;

    const previousState = history.past.pop()!;
    history.future.push(JSON.parse(JSON.stringify(state)));

    setState(previousState);
    setSelectedId(null);
  }, [state]);

  const redo = useCallback(() => {
    const history = historyRef.current;
    if (history.future.length === 0) return;

    const nextState = history.future.pop()!;
    history.past.push(JSON.parse(JSON.stringify(state)));

    setState(nextState);
    setSelectedId(null);
  }, [state]);

  // Viewport navigation
  const setPan = useCallback((newPan: Point | ((p: Point) => Point)) => {
    setState((prev) => ({
      ...prev,
      pan: typeof newPan === 'function' ? newPan(prev.pan) : newPan
    }));
  }, []);

  const setZoom = useCallback((newZoom: number | ((z: number) => number)) => {
    setState((prev) => {
      let zoomVal = typeof newZoom === 'function' ? newZoom(prev.zoom) : newZoom;
      // Clamp zoom between 0.15x and 4x
      zoomVal = Math.max(0.15, Math.min(4.0, zoomVal));
      return {
        ...prev,
        zoom: zoomVal
      };
    });
  }, []);

  // Center/Reset camera view
  const resetView = useCallback(() => {
    setState((prev) => ({
      ...prev,
      pan: { x: window.innerWidth / 2 - 400, y: window.innerHeight / 2 - 250 },
      zoom: 1.0
    }));
  }, []);

  // Zoom to fit elements
  const fitView = useCallback(() => {
    const cards = state.elements.filter((el) => el.type === 'card') as CardElement[];
    if (cards.length === 0) {
      resetView();
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
    zoomVal = Math.max(0.3, zoomVal); // Lower clamp 0.3

    const panX = viewportW / 2 - (minX + (maxX - minX) / 2) * zoomVal;
    const panY = viewportH / 2 - (minY + (maxY - minY) / 2) * zoomVal;

    setState((prev) => ({
      ...prev,
      zoom: zoomVal,
      pan: { x: panX, y: panY }
    }));
  }, [state.elements, resetView]);

  // Create card
  const addCard = useCallback((x: number, y: number) => {
    recordHistory(state);

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

    setState((prev) => ({
      ...prev,
      elements: [...prev.elements, newCard]
    }));
    setSelectedId(newCard.id);
  }, [state, recordHistory]);

  // Create connector arrow
  const addArrow = useCallback((arrow: Omit<ArrowElement, 'id' | 'type'>) => {
    recordHistory(state);

    const newArrow: ArrowElement = {
      ...arrow,
      id: `arrow-${Date.now()}`,
      type: 'arrow'
    };

    setState((prev) => ({
      ...prev,
      elements: [...prev.elements, newArrow]
    }));
    setSelectedId(newArrow.id);
  }, [state, recordHistory]);

  // Update specific element parameters
  const updateElement = useCallback((id: string, updates: Partial<CanvasElement>, record = true) => {
    if (record) {
      recordHistory(state);
    }

    setState((prev) => {
      const updated = prev.elements.map((el) => {
        if (el.id !== id) return el;
        return {
          ...el,
          ...updates
        } as CanvasElement;
      });

      return {
        ...prev,
        elements: updated
      };
    });
  }, [state, recordHistory]);

  // Smooth position updating during card drags (no history bloat)
  const updateCardPosition = useCallback((id: string, x: number, y: number) => {
    setState((prev) => {
      const updated = prev.elements.map((el) => {
        if (el.id !== id || el.type !== 'card') return el;
        return { ...el, x, y };
      });
      return { ...prev, elements: updated };
    });
  }, []);

  const updateCardSize = useCallback((id: string, width: number, height: number) => {
    setState((prev) => {
      const updated = prev.elements.map((el) => {
        if (el.id !== id || el.type !== 'card') return el;
        return { ...el, width, height };
      });
      return { ...prev, elements: updated };
    });
  }, []);

  // Save historical snapshot once drag operations complete
  const finalizeDrag = useCallback(() => {
    recordHistory(state);
  }, [state, recordHistory]);

  // Delete specific element
  const deleteElement = useCallback((id: string) => {
    recordHistory(state);
    setState((prev) => {
      // If we delete a card, we must also clean up any arrows anchored to that card
      const remaining = prev.elements.filter((el) => {
        if (el.id === id) return false;
        if (el.type === 'arrow') {
          return el.fromId !== id && el.toId !== id;
        }
        return true;
      });

      return {
        ...prev,
        elements: remaining
      };
    });
    setSelectedId(null);
  }, [state, recordHistory]);

  // Wipe board clean
  const clearCanvas = useCallback(() => {
    recordHistory(state);
    setState((prev) => ({
      ...prev,
      elements: []
    }));
    setSelectedId(null);
  }, [state, recordHistory]);

  // Selected element helper object
  const selectedElement = state.elements.find((el) => el.id === selectedId) || null;

  return {
    state,
    pan: state.pan,
    zoom: state.zoom,
    elements: state.elements,
    selectedId,
    selectedElement,
    setSelectedId,
    setPan,
    setZoom,
    undo,
    redo,
    resetView,
    fitView,
    addCard,
    addArrow,
    updateElement,
    updateCardPosition,
    updateCardSize,
    finalizeDrag,
    deleteElement,
    clearCanvas,
    canUndo: historyRef.current.past.length > 0,
    canRedo: historyRef.current.future.length > 0
  };
}
