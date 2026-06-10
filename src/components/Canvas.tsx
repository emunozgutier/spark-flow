import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useStyle } from '../store/useStyle';
import { useCanvas } from '../store/useCanvas';
import { CircuitElements } from './Canvas/CircuitElements';
import { Anotations } from './Canvas/Anotations';
import { Join } from './Canvas/Wire/Join';
import { Wires, getAbsoluteDirection, getOrthogonalPathPoints } from './Canvas/Wires';
import { AnimationManager } from './Canvas/AnimationManager';


// DSU helper to group connected pins into electrical nodes
class UnionFind {
  parent: Record<string, string> = {};
  
  find(id: string): string {
    if (!this.parent[id]) {
      this.parent[id] = id;
    }
    if (this.parent[id] === id) {
      return id;
    }
    this.parent[id] = this.find(this.parent[id]);
    return this.parent[id];
  }
  
  union(x: string, y: string) {
    const rootX = this.find(x);
    const rootY = this.find(y);
    if (rootX !== rootY) {
      this.parent[rootX] = rootY;
    }
  }
}
import type {
  CanvasElement,
  CardElement,
  ArrowElement,
  Point,
  ToolType,
  ThemeColor,
  DraggingCardState,
  DrawingArrowState
} from '../dataTypes/AnotateType';

const ensureNetNames = (elements: CanvasElement[]): CanvasElement[] => {
  const cards = elements.filter((el) => el.type === 'box') as CardElement[];
  const arrows = elements.filter((el) => el.type === 'arrow') as ArrowElement[];

  const uf = new UnionFind();
  const joinCards = cards.filter((c) => c.id.startsWith('join') || c.title === 'join');
  const compCards = cards.filter((c) => c.componentType !== undefined);

  // Collect all sockets
  const socketKeys: string[] = [];
  compCards.forEach((c) => {
    if (c.componentType === 'ground') {
      socketKeys.push(`${c.id}-top`);
    } else if (c.componentType === 'bjt') {
      socketKeys.push(`${c.id}-left`, `${c.id}-top`, `${c.id}-bottom`);
    } else {
      socketKeys.push(`${c.id}-left`, `${c.id}-right`);
    }
  });
  joinCards.forEach((j) => {
    socketKeys.push(`${j.id}-top`, `${j.id}-right`, `${j.id}-bottom`, `${j.id}-left`);
  });

  // Union join sockets
  joinCards.forEach((j) => {
    uf.union(`${j.id}-top`, `${j.id}-right`);
    uf.union(`${j.id}-top`, `${j.id}-bottom`);
    uf.union(`${j.id}-top`, `${j.id}-left`);
  });

  // Union connected wires
  arrows.forEach((w) => {
    if (w.fromId && w.fromSocket && w.toId && w.toSocket) {
      uf.union(`${w.fromId}-${w.fromSocket}`, `${w.toId}-${w.toSocket}`);
    }
  });

  // Map sets to node keys
  const groups: Record<string, string[]> = {};
  cards.forEach((card) => {
    const isGround = card.componentType === 'ground';
    const isJoin = card.id.startsWith('join') || card.title === 'join';
    const isBjt = card.componentType === 'bjt';
    const portsList = isGround ? ['top'] : (isJoin ? ['top', 'right', 'bottom', 'left'] : (isBjt ? ['left', 'top', 'bottom'] : ['left', 'right']));
    
    portsList.forEach((socket) => {
      const pin = `${card.id}-${socket}`;
      const root = uf.find(pin);
      if (!groups[root]) groups[root] = [];
      groups[root].push(pin);
    });
  });

  // Ensure all wires roots are in groups to avoid unmapped wires
  arrows.forEach((w) => {
    let wRoot = '';
    if (w.fromId && w.fromSocket) {
      wRoot = uf.find(`${w.fromId}-${w.fromSocket}`);
    } else if (w.toId && w.toSocket) {
      wRoot = uf.find(`${w.toId}-${w.toSocket}`);
    } else {
      wRoot = uf.find(w.id);
    }
    if (!groups[wRoot]) {
      groups[wRoot] = [w.id];
    }
  });

  // Identify all ground roots
  const gndRoots = new Set<string>();
  Object.keys(groups).forEach((root) => {
    const hasGndPin = groups[root].some((pin) => {
      const cardId = pin.substring(0, pin.lastIndexOf('-'));
      const card = cards.find((c) => c.id === cardId);
      return card?.componentType === 'ground';
    });
    if (hasGndPin) {
      gndRoots.add(root);
    }
  });

  const rootToNodeName: Record<string, string> = {};
  let nodeCounter = 1;
  
  gndRoots.forEach((root) => {
    rootToNodeName[root] = '0';
  });

  if (gndRoots.size === 0 && Object.keys(groups).length > 0) {
    const defaultGnd = Object.keys(groups)[0];
    rootToNodeName[defaultGnd] = '0';
    gndRoots.add(defaultGnd);
  }

  Object.keys(groups).forEach((root) => {
    if (gndRoots.has(root)) return;
    rootToNodeName[root] = String(nodeCounter++);
  });

  // Group wires by root
  const wiresByRoot: Record<string, ArrowElement[]> = {};
  arrows.forEach((w) => {
    let wRoot = '';
    if (w.fromId && w.fromSocket) {
      wRoot = uf.find(`${w.fromId}-${w.fromSocket}`);
    } else if (w.toId && w.toSocket) {
      wRoot = uf.find(`${w.toId}-${w.toSocket}`);
    } else {
      wRoot = uf.find(w.id);
    }
    if (!wiresByRoot[wRoot]) {
      wiresByRoot[wRoot] = [];
    }
    wiresByRoot[wRoot].push(w);
  });

  const wireToNetName: Record<string, string> = {};
  Object.keys(wiresByRoot).forEach((rootKey) => {
    const baseName = rootToNodeName[rootKey] || '0';
    const groupWires = wiresByRoot[rootKey];
    
    if (groupWires.length > 1) {
      groupWires.forEach((w, index) => {
        wireToNetName[w.id] = `${baseName}.${index}`;
      });
    } else if (groupWires.length === 1) {
      wireToNetName[groupWires[0].id] = baseName;
    }
  });

  // Assign joint numbers to join cards deterministically (top-to-bottom, left-to-right)
  const jointCounters: Record<string, number> = {};
  const joinToNumber: Record<string, string> = {};
  
  const sortedJoinCards = [...joinCards].sort((a, b) => {
    if (Math.abs(a.y - b.y) > 1) {
      return a.y - b.y;
    }
    return a.x - b.x;
  });

  sortedJoinCards.forEach((j) => {
    const root = uf.find(`${j.id}-top`);
    const baseNodeName = rootToNodeName[root] || '0';
    if (jointCounters[baseNodeName] === undefined) {
      jointCounters[baseNodeName] = 0;
    }
    const idx = jointCounters[baseNodeName]++;
    joinToNumber[j.id] = `${baseNodeName}.${idx}`;
  });

  return elements.map((el) => {
    if (el.type === 'arrow') {
      const w = el as ArrowElement;
      const netName = wireToNetName[w.id] || '';
      if (w.netName !== netName) {
        return { ...w, netName };
      }
    } else if (el.type === 'box') {
      const card = el as CardElement;
      const isJoin = card.id.startsWith('join') || card.title === 'join';
      if (isJoin) {
        const jointNumber = joinToNumber[card.id] || '';
        if (card.jointNumber !== jointNumber) {
          return { ...card, jointNumber };
        }
      }
    }
    return el;
  });
};

interface WireSnapResult {
  wire: ArrowElement;
  point: Point;
  distance: number;
}

const getJoinSocketDirection = (joinCenter: Point, targetPt: Point): 'top' | 'right' | 'bottom' | 'left' => {
  const dx = targetPt.x - joinCenter.x;
  const dy = targetPt.y - joinCenter.y;
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? 'right' : 'left';
  } else {
    return dy > 0 ? 'bottom' : 'top';
  }
};

const findClosestWirePoint = (
  mousePt: Point,
  arrows: ArrowElement[],
  cards: CardElement[],
  getSocketPosition: (card: CardElement, socket: 'top' | 'right' | 'bottom' | 'left') => Point
): WireSnapResult | null => {
  let bestResult: WireSnapResult | null = null;
  const threshold = 16; // Snap within 16px of wire path

  arrows.forEach((arrow) => {
    let startPt = arrow.fromPoint || { x: 0, y: 0 };
    let endPt = arrow.toPoint || { x: 0, y: 0 };

    const fromCard = cards.find((c) => c.id === arrow.fromId);
    const toCard = cards.find((c) => c.id === arrow.toId);

    if (arrow.fromId && fromCard && arrow.fromSocket) {
      startPt = getSocketPosition(fromCard, arrow.fromSocket);
    }
    if (arrow.toId && toCard && arrow.toSocket) {
      endPt = getSocketPosition(toCard, arrow.toSocket);
    }

    const absFromDir = getAbsoluteDirection(arrow.fromSocket, fromCard?.rotation || 0);
    const absToDir = getAbsoluteDirection(arrow.toSocket, toCard?.rotation || 0);
    const pathPoints = getOrthogonalPathPoints(startPt, endPt, absFromDir, absToDir, arrow.id);

    for (let i = 0; i < pathPoints.length - 1; i++) {
      const ptA = pathPoints[i];
      const ptB = pathPoints[i + 1];

      const isHorizontal = Math.abs(ptA.y - ptB.y) < 1;
      const isVertical = Math.abs(ptA.x - ptB.x) < 1;

      if (isHorizontal) {
        const minX = Math.min(ptA.x, ptB.x);
        const maxX = Math.max(ptA.x, ptB.x);
        if (mousePt.x >= minX - 4 && mousePt.x <= maxX + 4) {
          const dist = Math.abs(mousePt.y - ptA.y);
          if (dist < threshold && (!bestResult || dist < bestResult.distance)) {
            const snapX = Math.round(mousePt.x / 10) * 10;
            const clampedX = Math.max(minX, Math.min(maxX, snapX));
            bestResult = {
              wire: arrow,
              point: { x: clampedX, y: ptA.y },
              distance: dist
            };
          }
        }
      } else if (isVertical) {
        const minY = Math.min(ptA.y, ptB.y);
        const maxY = Math.max(ptA.y, ptB.y);
        if (mousePt.y >= minY - 4 && mousePt.y <= maxY + 4) {
          const dist = Math.abs(mousePt.x - ptA.x);
          if (dist < threshold && (!bestResult || dist < bestResult.distance)) {
            const snapY = Math.round(mousePt.y / 10) * 10;
            const clampedY = Math.max(minY, Math.min(maxY, snapY));
            bestResult = {
              wire: arrow,
              point: { x: ptA.x, y: clampedY },
              distance: dist
            };
          }
        }
      }
    }
  });

  return bestResult;
};

// Canvas component definition starts here

interface CanvasProps {
  elements: CanvasElement[];
  pan: Point;
  zoom: number;
  selectedId: string | null;
  selectedIds: string[];
  activeTool: ToolType;
  setSelectedId: (id: string | null) => void;
  setSelectedIds: (ids: string[]) => void;
  setPan: (newPan: Point | ((p: Point) => Point)) => void;
  setZoom: (newZoom: number | ((z: number) => number)) => void;
  addCard: (x: number, y: number, width?: number, height?: number, componentType?: 'resistor' | 'capacitor' | 'inductor' | 'ground' | 'voltage' | 'acvoltage' | 'current' | 'diode' | 'bjt') => void;
  addArrow: (arrow: Omit<ArrowElement, 'id' | 'type'>) => void;
  updateElement: (id: string, updates: Partial<any>, record?: boolean) => void;
  updateCardPosition: (id: string, x: number, y: number) => void;
  updateCardSize: (id: string, width: number, height: number) => void;
  finalizeDrag: () => void;
  deleteElement: (id: string) => void;
  setToast?: (toast: { message: string; type: 'success' | 'info' } | null) => void;
  solvedDCOperatingPoint: Record<
    string,
    {
      voltageDrop: number;
      branchCurrent: number;
      vLeft?: number;
      vRight?: number;
      signedCurrent?: number;
    }
  >;
  wireVoltages?: Record<string, number>;
}

export const Canvas: React.FC<CanvasProps> = ({
  elements,
  pan,
  zoom,
  selectedId,
  selectedIds,
  activeTool,
  setSelectedId,
  setSelectedIds,
  setPan,
  setZoom,
  addCard,
  addArrow,
  updateElement,
  updateCardPosition,
  updateCardSize,
  finalizeDrag,
  deleteElement,
  setToast,
  solvedDCOperatingPoint,
  wireVoltages = {},
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { liveDCOn } = useCanvas();
  const loopCounterRef = useRef(0);
  const loopResetTimeRef = useRef(Date.now());

  // Auto-assign net names to all wires in the circuit
  useEffect(() => {
    const nextElements = ensureNetNames(elements);
    
    // Check if any netName or jointNumber actually changed, or elements array shape differs
    let changed = false;
    if (elements.length !== nextElements.length) {
      changed = true;
    } else {
      for (let i = 0; i < elements.length; i++) {
        const oldEl = elements[i];
        const newEl = nextElements[i];
        
        if (oldEl.type !== newEl.type || oldEl.id !== newEl.id) {
          changed = true;
          break;
        }
        
        if (oldEl.type === 'arrow') {
          const oldArrow = oldEl as ArrowElement;
          const newArrow = newEl as ArrowElement;
          if (oldArrow.netName !== newArrow.netName) {
            changed = true;
            break;
          }
        } else if (oldEl.type === 'box') {
          const oldBox = oldEl as CardElement;
          const newBox = newEl as CardElement;
          if (oldBox.jointNumber !== newBox.jointNumber) {
            changed = true;
            break;
          }
        }
      }
    }

    if (changed) {
      const now = Date.now();
      if (now - loopResetTimeRef.current > 2000) {
        loopCounterRef.current = 0;
        loopResetTimeRef.current = now;
      }
      loopCounterRef.current++;

      if (loopCounterRef.current > 10) {
        console.error('SparkFlow: Prevented infinite update loop in ensureNetNames!');
        if (setToast) {
          setToast({
            message: '⚠️ Auto-naming paused to prevent page freeze.',
            type: 'info'
          });
        }
        return;
      }

      useCanvas.setState({ elements: nextElements });
      localStorage.setItem('spark-flow:board-elements', JSON.stringify(nextElements));
    }
  }, [elements, setToast]);

  // Interactive Drag states
  const [draggingCard, setDraggingCard] = useState<DraggingCardState | null>(null);
  const [resizingCard, setResizingCard] = useState<{ id: string; startWidth: number; startHeight: number; startMouseX: number; startMouseY: number } | null>(null);
  const [drawingArrow, setDrawingArrow] = useState<DrawingArrowState | null>(null);
  const [drawingBox, setDrawingBox] = useState<{ startPoint: Point; currentPoint: Point; color: ThemeColor } | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<Point>({ x: 0, y: 0 });
  const [spacePressed, setSpacePressed] = useState(false);
  const [drawingSelectionBox, setDrawingSelectionBox] = useState<{ startPoint: Point; currentPoint: Point } | null>(null);
  const [activeSnap, setActiveSnap] = useState<{ wire: ArrowElement; point: Point } | null>(null);

  // Monitor Spacebar key bindings for panning toggle and R key rotation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        setSpacePressed(true);
        e.preventDefault();
      }
      
      // Select All, Delete, Undo / Redo keybinds could go here
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        // Only delete if we are not currently editing inputs
        if (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
          deleteElement(selectedId);
        }
      }

      // Rotate selected passive component on 'R' keypress (90 deg increments)
      if (e.key.toLowerCase() === 'r' && selectedId) {
        if (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
          const selectedEl = elements.find((el) => el.id === selectedId);
          if (selectedEl && selectedEl.type === 'box') {
            const card = selectedEl as CardElement;
            if (card.componentType) {
              const currentRotation = card.rotation || 0;
              const nextRotation = (currentRotation + 90) % 360;
              updateElement(selectedId, { rotation: nextRotation });
            }
          }
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setSpacePressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [selectedId, deleteElement, elements, updateElement]);

  // Convert Screen pixel coordinates into Canvas coordinate system
  const screenToCanvas = useCallback((screenX: number, screenY: number): Point => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: (screenX - rect.left - pan.x) / zoom,
      y: (screenY - rect.top - pan.y) / zoom
    };
  }, [pan, zoom]);

  // Calculate socket absolute coordinates on canvas
  const getSocketPosition = useCallback((card: CardElement, socket: 'top' | 'right' | 'bottom' | 'left'): Point => {
    let basePt = { x: 0, y: 0 };
    const isPassive = !!card.componentType;
    const isTwoPort = isPassive && card.componentType !== 'ground' && card.componentType !== 'bjt';
    switch (socket) {
      case 'top':
        basePt = { x: card.x + card.width / 2, y: card.y };
        break;
      case 'right':
        basePt = {
          x: card.x + card.width,
          y: isTwoPort ? card.y + 20 : card.y + card.height / 2
        };
        break;
      case 'bottom':
        basePt = { x: card.x + card.width / 2, y: card.y + card.height };
        break;
      case 'left':
        basePt = {
          x: card.x,
          y: isTwoPort ? card.y + 20 : card.y + card.height / 2
        };
        break;
    }

    if (card.rotation && card.rotation !== 0) {
      const cx = card.x + card.width / 2;
      const cy = card.y + card.height / 2;
      const rad = (card.rotation * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const dx = basePt.x - cx;
      const dy = basePt.y - cy;
      return {
        x: cx + dx * cos - dy * sin,
        y: cy + dx * sin + dy * cos
      };
    }
    return basePt;
  }, []);

  // Zoom-to-Mouse Wheel Handler
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomIntensity = 0.05;
    const wheelDelta = -e.deltaY;
    
    // Zoom step formula
    setZoom((prevZoom) => {
      const scale = wheelDelta > 0 ? (1 + zoomIntensity) : (1 - zoomIntensity);
      const nextZoom = Math.max(0.15, Math.min(4.0, prevZoom * scale));
      
      // Adjust pan offset to center scale around mouse position
      const mouseCanvasX = (mouseX - pan.x) / prevZoom;
      const mouseCanvasY = (mouseY - pan.y) / prevZoom;
      
      const newPanX = mouseX - mouseCanvasX * nextZoom;
      const newPanY = mouseY - mouseCanvasY * nextZoom;
      
      setPan({ x: newPanX, y: newPanY });
      return nextZoom;
    });
  };

  // Viewport Panning / Creation Click handler
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current) return;

    // Detect if we clicked any card or panel UI element
    const target = e.target as HTMLElement;
    const isUI = target.closest('.canvas-card') || 
                 target.closest('.card-socket') || 
                 target.closest('.card-resize-handle') ||
                 target.closest('.interactive-panel') || 
                 target.closest('.sidebar-panel');

    // 1. Viewport panning via Spacebar, Middle mouse, or Hand Tool active
    const isMiddleClick = e.button === 1;
    const isHandMode = activeTool === 'hand' || spacePressed;

    if (isMiddleClick || isHandMode) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      e.preventDefault();
      return;
    }

    if (isUI) return;

    if (
      activeTool === 'resistor' ||
      activeTool === 'capacitor' ||
      activeTool === 'inductor' ||
      activeTool === 'ground' ||
      activeTool === 'voltage' ||
      activeTool === 'acvoltage' ||
      activeTool === 'current' ||
      activeTool === 'diode' ||
      activeTool === 'bjt'
    ) {
      const clickCoords = screenToCanvas(e.clientX, e.clientY);
      if (activeTool === 'ground' || activeTool === 'bjt') {
        addCard(clickCoords.x - 30, clickCoords.y - 30, 60, 60, activeTool);
      } else {
        addCard(clickCoords.x - 30, clickCoords.y - 20, 60, 60, activeTool);
      }
      e.preventDefault();
      return;
    }

    // 3. Click-and-Hold to draw a custom Box for Text cards
    if (activeTool === 'text') {
      const clickCoords = screenToCanvas(e.clientX, e.clientY);
      let activeColor = useStyle.getState().themeColor;
      setDrawingBox({
        startPoint: clickCoords,
        currentPoint: clickCoords,
        color: activeColor
      });
      e.preventDefault();
      return;
    }

    // 4. Start group selection box if clicking blank canvas in select mode
    if (activeTool === 'select') {
      setSelectedId(null);
      const clickCoords = screenToCanvas(e.clientX, e.clientY);
      setDrawingSelectionBox({
        startPoint: clickCoords,
        currentPoint: clickCoords
      });
      e.preventDefault();
      return;
    }
  };

  // Drag Motion Engine (Mouse Move)
  const handleMouseMove = (e: React.MouseEvent) => {
    // 1. Panning state
    if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      });
      return;
    }

    // 1.5 Box Drawing state
    if (drawingBox) {
      const mouseCanvas = screenToCanvas(e.clientX, e.clientY);
      setDrawingBox({
        ...drawingBox,
        currentPoint: mouseCanvas
      });
      return;
    }

    // 1.7 Selection Box Drawing state
    if (drawingSelectionBox) {
      const mouseCanvas = screenToCanvas(e.clientX, e.clientY);
      setDrawingSelectionBox({
        ...drawingSelectionBox,
        currentPoint: mouseCanvas
      });
      return;
    }

    // 2. Dragging Card state
    if (draggingCard) {
      const deltaX = (e.clientX - draggingCard.startX) / zoom;
      const deltaY = (e.clientY - draggingCard.startY) / zoom;

      const snapVal = 10;
      const nextX = Math.round((draggingCard.originalX + deltaX) / snapVal) * snapVal;
      const nextY = Math.round((draggingCard.originalY + deltaY) / snapVal) * snapVal;

      updateCardPosition(draggingCard.id, nextX, nextY);
      return;
    }

    // 3. Resizing Card state
    if (resizingCard) {
      const deltaX = (e.clientX - resizingCard.startMouseX) / zoom;
      const deltaY = (e.clientY - resizingCard.startMouseY) / zoom;
      
      const snapVal = 10;
      const newW = Math.max(140, Math.round((resizingCard.startWidth + deltaX) / snapVal) * snapVal);
      const newH = Math.max(80, Math.round((resizingCard.startHeight + deltaY) / snapVal) * snapVal);

      updateCardSize(resizingCard.id, newW, newH);
      return;
    }

    // 4. Drawing Connection Arrow state
    if (drawingArrow) {
      const mouseCanvas = screenToCanvas(e.clientX, e.clientY);
      const arrows = elements.filter((el) => el.type === 'arrow') as ArrowElement[];
      const cards = elements.filter((el) => el.type === 'box') as CardElement[];
      
      const snapResult = findClosestWirePoint(mouseCanvas, arrows, cards, getSocketPosition);
      
      if (snapResult) {
        setActiveSnap({ wire: snapResult.wire, point: snapResult.point });
        setDrawingArrow({
          ...drawingArrow,
          currentPoint: snapResult.point
        });
      } else {
        setActiveSnap(null);
        setDrawingArrow({
          ...drawingArrow,
          currentPoint: mouseCanvas
        });
      }
      return;
    }
  };

  // Drag Release Handler (Mouse Up)
  const handleMouseUp = (e: React.MouseEvent) => {
    if (isPanning) {
      setIsPanning(false);
      return;
    }

    if (drawingBox) {
      const x1 = Math.min(drawingBox.startPoint.x, drawingBox.currentPoint.x);
      const y1 = Math.min(drawingBox.startPoint.y, drawingBox.currentPoint.y);
      const width = Math.abs(drawingBox.currentPoint.x - drawingBox.startPoint.x);
      const height = Math.abs(drawingBox.currentPoint.y - drawingBox.startPoint.y);

      // If the drag shape size is extremely small (e.g. less than 15px), we treat it as a click-to-spawn centered box!
      if (width < 15 || height < 15) {
        addCard(drawingBox.startPoint.x - 100, drawingBox.startPoint.y - 60, undefined, undefined, undefined);
      } else {
        // Spawn standard box with custom dimensions drawn!
        addCard(x1, y1, width, height, undefined);
      }

      setDrawingBox(null);
      return;
    }

    if (drawingSelectionBox) {
      const minX = Math.min(drawingSelectionBox.startPoint.x, drawingSelectionBox.currentPoint.x);
      const maxX = Math.max(drawingSelectionBox.startPoint.x, drawingSelectionBox.currentPoint.x);
      const minY = Math.min(drawingSelectionBox.startPoint.y, drawingSelectionBox.currentPoint.y);
      const maxY = Math.max(drawingSelectionBox.startPoint.y, drawingSelectionBox.currentPoint.y);

      const overlappingIds: string[] = [];
      elements.forEach((el) => {
        if (el.type === 'box') {
          const card = el as CardElement;
          const cardWidth = card.width;
          const cardHeight = card.height;
          const overlaps = (
            card.x + cardWidth >= minX &&
            card.x <= maxX &&
            card.y + cardHeight >= minY &&
            card.y <= maxY
          );
          if (overlaps) {
            overlappingIds.push(card.id);
          }
        }
      });

      setSelectedIds(overlappingIds);
      setDrawingSelectionBox(null);
      return;
    }

    if (draggingCard) {
      setDraggingCard(null);
      finalizeDrag();
      return;
    }

    if (resizingCard) {
      setResizingCard(null);
      finalizeDrag();
      return;
    }

    if (drawingArrow) {
      const realTarget = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      const targetElement = realTarget || (e.target as HTMLElement);
      const isSocket = targetElement?.classList.contains('card-socket');
      const cards = elements.filter((el) => el.type === 'box') as CardElement[];
      
      if (activeSnap) {
        // --- WIRE SPLIT AND JOIN TRANSACTION ---
        const fromId = drawingArrow.fromId;
        const fromSocket = drawingArrow.fromSocket;
        
        if (fromId && fromSocket) {
          const snapPt = activeSnap.point;
          const targetWire = activeSnap.wire;

          // 1. Generate unique IDs
          const joinId = `join-${Date.now()}`;
          const wireAId = `arrow-${Date.now()}-a`;
          const wireBId = `arrow-${Date.now()}-b`;
          const wireCId = `arrow-${Date.now()}-c`;

          const origFromCard = cards.find((c) => c.id === targetWire.fromId);
          const origToCard = cards.find((c) => c.id === targetWire.toId);

          if (origFromCard && origToCard && targetWire.fromSocket && targetWire.toSocket) {
            const origFromSocketPt = getSocketPosition(origFromCard, targetWire.fromSocket);
            const origToSocketPt = getSocketPosition(origToCard, targetWire.toSocket);

            // 2. Create the join junction card/box (centered at snapPt, size 16x16)
            const joinCard: CardElement = {
              id: joinId,
              type: 'box',
              x: snapPt.x - 8,
              y: snapPt.y - 8,
              width: 16,
              height: 16,
              color: targetWire.color || 'slate',
              title: 'join',
              content: ''
            };

            // 3. Calculate socket directions on the join node
            const joinCenter = snapPt;
            const socketForOrigFrom = getJoinSocketDirection(joinCenter, origFromSocketPt);
            const socketForOrigTo = getJoinSocketDirection(joinCenter, origToSocketPt);
            
            const sourceCard = cards.find((c) => c.id === fromId);
            const sourceSocketPt = sourceCard ? getSocketPosition(sourceCard, fromSocket) : snapPt;
            const socketForNewSource = getJoinSocketDirection(joinCenter, sourceSocketPt);

            // 4. Create the three new wires
            const wireA: ArrowElement = {
              id: wireAId,
              type: 'arrow',
              fromId: targetWire.fromId,
              fromSocket: targetWire.fromSocket,
              toId: joinId,
              toSocket: socketForOrigFrom,
              color: targetWire.color,
              style: targetWire.style,
              label: ''
            };

            const wireB: ArrowElement = {
              id: wireBId,
              type: 'arrow',
              fromId: joinId,
              fromSocket: socketForOrigTo,
              toId: targetWire.toId,
              toSocket: targetWire.toSocket,
              color: targetWire.color,
              style: targetWire.style,
              label: ''
            };

            const wireC: ArrowElement = {
              id: wireCId,
              type: 'arrow',
              fromId: fromId,
              fromSocket: fromSocket,
              toId: joinId,
              toSocket: socketForNewSource,
              color: drawingArrow.color || 'slate',
              style: drawingArrow.style || 'curved',
              label: ''
            };

            // 5. Update Zustand store atomically
            const filteredElements = elements.filter((el) => el.id !== targetWire.id);
            const nextElements = [...filteredElements, joinCard, wireA, wireB, wireC];

            const temporalApi = (useCanvas as any).temporal?.getState();
            temporalApi?.resume();

            useCanvas.setState({ elements: nextElements });
            localStorage.setItem('spark-flow:board-elements', JSON.stringify(nextElements));

            if (setToast) {
              setToast({
                message: '🔗 Wire successfully joined and split into 3 segments!',
                type: 'success'
              });
            }
          }
        }
        setActiveSnap(null);
      } else if (isSocket) {
        const toCardId = targetElement.getAttribute('data-card-id');
        const toSocketDir = targetElement.getAttribute('data-socket-dir') as 'top' | 'right' | 'bottom' | 'left';
        
        if (toCardId && toSocketDir && (toCardId !== drawingArrow.fromId)) {
          addArrow({
            fromId: drawingArrow.fromId,
            fromSocket: drawingArrow.fromSocket,
            toId: toCardId,
            toSocket: toSocketDir,
            color: drawingArrow.color,
            style: drawingArrow.style,
            label: ''
          });
        }
      } else if (activeTool === 'arrow') {
        const mouseCanvas = screenToCanvas(e.clientX, e.clientY);
        
        const cardColors: ThemeColor[] = ['amethyst', 'sapphire', 'emerald', 'amber', 'coral', 'slate'];
        const randomColor = cardColors[Math.floor(Math.random() * cardColors.length)];
        const newCardId = `card-${Date.now()}`;
        
        const newCard: CardElement = {
          id: newCardId,
          type: 'box',
          x: mouseCanvas.x - 100,
          y: mouseCanvas.y - 60,
          width: 200,
          height: 120,
          title: 'Linked Point',
          content: 'Auto-created link idea node.',
          color: randomColor
        };

        const sourceCard = elements.find(el => el.id === drawingArrow.fromId) as CardElement;
        let incomingSocket: 'top' | 'right' | 'bottom' | 'left' = 'left';
        if (sourceCard) {
          const dx = newCard.x - sourceCard.x;
          const dy = newCard.y - sourceCard.y;
          if (Math.abs(dx) > Math.abs(dy)) {
            incomingSocket = dx > 0 ? 'left' : 'right';
          } else {
            incomingSocket = dy > 0 ? 'top' : 'bottom';
          }
        }

        updateElement(newCardId, newCard);
        addArrow({
          fromId: drawingArrow.fromId,
          fromSocket: drawingArrow.fromSocket,
          toId: newCardId,
          toSocket: incomingSocket,
          color: drawingArrow.color,
          style: drawingArrow.style,
          label: ''
        });
      }

      setDrawingArrow(null);
    }
  };

  // Node drag parameters setup
  const initiateCardDrag = (card: CardElement, e: React.MouseEvent) => {
    if (activeTool !== 'select') return;
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLButtonElement) {
      return;
    }
    
    setSelectedId(card.id);
    setDraggingCard({
      id: card.id,
      startX: e.clientX,
      startY: e.clientY,
      originalX: card.x,
      originalY: card.y
    });
    e.stopPropagation();
  };

  // Node resize parameters setup
  const initiateCardResize = (card: CardElement, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedId(card.id);
    setResizingCard({
      id: card.id,
      startWidth: card.width,
      startHeight: card.height,
      startMouseX: e.clientX,
      startMouseY: e.clientY
    });
  };

  // Arrow drawing start parameters setup
  const initiateArrowDraw = (card: CardElement, socketDir: 'top' | 'right' | 'bottom' | 'left', e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    const socketPt = getSocketPosition(card, socketDir);
    setSelectedId(null);
    setDrawingArrow({
      fromId: card.id,
      fromSocket: socketDir,
      fromPoint: socketPt,
      currentPoint: socketPt,
      color: card.color,
      style: 'curved'
    });
  };



  // Dynamic CSS Class determination for container cursor
  const getContainerClassName = () => {
    let className = 'canvas-container';
    if (isPanning) className += ' tool-hand active';
    else if (spacePressed) className += ' tool-hand';
    else className += ` tool-${activeTool}`;
    return className;
  };

  // Find cards and arrow elements separated
  const cards = elements.filter((el) => el.type === 'box') as CardElement[];
  const arrows = elements.filter((el) => el.type === 'arrow') as ArrowElement[];

  return (
    <div
      ref={containerRef}
      className={getContainerClassName()}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      style={{ touchAction: 'none' }}
    >
      {/* 1. Vector Grid Background layer */}
      <div
        className="canvas-grid"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          backgroundImage: zoom > 0.35 
            ? 'radial-gradient(var(--border-strong) 1.2px, transparent 1.2px), radial-gradient(var(--border-subtle) 1px, transparent 1px)' 
            : 'none',
          backgroundSize: '40px 40px, 20px 20px',
          backgroundPosition: '0 0, 10px 10px',
          width: '50000px',
          height: '50000px',
          top: '-25000px',
          left: '-25000px',
          opacity: Math.min(1.0, zoom * 1.5)
        }}
      />

      {/* Viewport content layer */}
      <div
        className="canvas-viewport"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
        }}
      >
        {/* 2. SVG Overlay Layer (Connectors) */}
        <Wires
          arrows={arrows}
          cards={cards}
          selectedId={selectedId}
          setSelectedId={(id) => {
            setSelectedId(id);
            if (id) {
              const clickedArrow = arrows.find((a) => a.id === id);
              if (clickedArrow && setToast) {
                setToast({
                  message: `🔌 Net Name: ${clickedArrow.netName || 'Unassigned'}`,
                  type: 'info'
                });
              }
            }
          }}
          drawingArrow={drawingArrow}
          getSocketPosition={getSocketPosition}
          activeSnap={activeSnap}
          wireVoltages={wireVoltages}
        />

        {/* Render temporary live box drawing preview */}
        {drawingBox && (
          <div
            className="canvas-card animate-fade-in"
            style={{
              left: `${Math.min(drawingBox.startPoint.x, drawingBox.currentPoint.x)}px`,
              top: `${Math.min(drawingBox.startPoint.y, drawingBox.currentPoint.y)}px`,
              width: `${Math.abs(drawingBox.currentPoint.x - drawingBox.startPoint.x)}px`,
              height: `${Math.abs(drawingBox.currentPoint.y - drawingBox.startPoint.y)}px`,
              border: '2px dashed var(--theme-color)',
              background: 'rgba(255, 255, 255, 0.03)',
              boxShadow: '0 0 15px var(--theme-color-glow)',
              pointerEvents: 'none',
              zIndex: 999,
              '--theme-color': `var(--theme-${drawingBox.color})`,
              '--theme-color-glow': `var(--theme-${drawingBox.color}-glow)`
            } as React.CSSProperties}
          >
            <div className="card-header" style={{ opacity: 0.5 }}>
              <span className="card-title-input" style={{ fontStyle: 'italic' }}>Drawing Box...</span>
            </div>
          </div>
        )}

        {/* Render temporary live group selection box */}
        {drawingSelectionBox && (
          <div
            className="selection-box animate-fade-in"
            style={{
              position: 'absolute',
              left: `${Math.min(drawingSelectionBox.startPoint.x, drawingSelectionBox.currentPoint.x)}px`,
              top: `${Math.min(drawingSelectionBox.startPoint.y, drawingSelectionBox.currentPoint.y)}px`,
              width: `${Math.abs(drawingSelectionBox.currentPoint.x - drawingSelectionBox.startPoint.x)}px`,
              height: `${Math.abs(drawingSelectionBox.currentPoint.y - drawingSelectionBox.startPoint.y)}px`,
              border: '1.5px dashed #3b82f6',
              background: 'rgba(59, 130, 246, 0.08)',
              boxShadow: '0 0 10px rgba(59, 130, 246, 0.2)',
              pointerEvents: 'none',
              zIndex: 999,
              borderRadius: '4px'
            }}
          />
        )}

        {/* 3. HTML Cards Layer (absolutely positioned) */}
        {cards.map((card) => {
          const isSelected = selectedId === card.id || selectedIds.includes(card.id);
          const isPassive = !!card.componentType;
          const isJoin = card.id.startsWith('join') || card.title === 'join';
          
          if (isPassive) {
            return (
              <CircuitElements
                key={card.id}
                card={card}
                isSelected={isSelected}
                activeTool={activeTool}
                arrows={arrows}
                initiateCardDrag={initiateCardDrag}
                initiateArrowDraw={initiateArrowDraw}
                updateElement={updateElement}
                finalizeDrag={finalizeDrag}
              />
            );
          }

          if (isJoin) {
            return (
              <Join
                key={card.id}
                card={card}
                isSelected={isSelected}
                activeTool={activeTool}
                initiateCardDrag={initiateCardDrag}
                initiateArrowDraw={initiateArrowDraw}
              />
            );
          }

          return (
            <Anotations
              key={card.id}
              card={card}
              isSelected={isSelected}
              activeTool={activeTool}
              initiateCardDrag={initiateCardDrag}
              initiateCardResize={initiateCardResize}
              initiateArrowDraw={initiateArrowDraw}
              updateElement={updateElement}
              finalizeDrag={finalizeDrag}
            />
          );
        })}
      </div>

      {liveDCOn && (
        <AnimationManager
          elements={elements}
          solvedResults={solvedDCOperatingPoint}
          pan={pan}
          zoom={zoom}
          containerRef={containerRef}
        />
      )}
    </div>
  );
};


