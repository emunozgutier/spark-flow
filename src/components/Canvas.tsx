import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useStyle } from '../store/useStyle';
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

// Engineering notation and designator helpers
const formatEngineering = (val: number | undefined): string => {
  if (val === undefined || isNaN(val)) return '';
  if (val === 0) return '0';
  
  const absVal = Math.abs(val);
  const prefixes = [
    { value: 1e9, symbol: 'G' },
    { value: 1e6, symbol: 'M' },
    { value: 1e3, symbol: 'k' },
    { value: 1, symbol: '' },
    { value: 1e-3, symbol: 'm' },
    { value: 1e-6, symbol: 'u' },
    { value: 1e-9, symbol: 'n' },
    { value: 1e-12, symbol: 'p' },
    { value: 1e-15, symbol: 'f' }
  ];

  for (let i = 0; i < prefixes.length; i++) {
    const p = prefixes[i];
    if (absVal >= p.value) {
      const num = val / p.value;
      const formattedNum = parseFloat(num.toFixed(3));
      return `${formattedNum}${p.symbol}`;
    }
  }
  
  return val.toExponential(2);
};

const parseEngineering = (str: string): number => {
  const trimmed = str.trim();
  if (!trimmed) return 0;
  
  const match = trimmed.match(/^([+-]?\d*(?:\.\d+)?)\s*([a-zA-Zµ]?)$/);
  if (!match) return parseFloat(trimmed) || 0;
  
  const [_, numStr, suffix] = match;
  const num = parseFloat(numStr);
  if (isNaN(num)) return 0;
  
  switch (suffix) {
    case 'f': return num * 1e-15;
    case 'p': return num * 1e-12;
    case 'n': return num * 1e-9;
    case 'u':
    case 'µ': return num * 1e-6;
    case 'm': return num * 1e-3;
    case 'k': return num * 1e3;
    case 'M': return num * 1e6;
    case 'G': return num * 1e9;
    default: return num;
  }
};

const parseInstanceNumber = (str: string, prefixChar: string): number => {
  const numStr = str.replace(new RegExp(`^${prefixChar}`, 'i'), '').trim();
  const parsed = parseInt(numStr, 10);
  return isNaN(parsed) ? 1 : parsed;
};

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
  addCard: (x: number, y: number, width?: number, height?: number, componentType?: 'resistor' | 'capacitor' | 'inductor') => void;
  addArrow: (arrow: Omit<ArrowElement, 'id' | 'type'>) => void;
  updateElement: (id: string, updates: Partial<any>, record?: boolean) => void;
  updateCardPosition: (id: string, x: number, y: number) => void;
  updateCardSize: (id: string, width: number, height: number) => void;
  finalizeDrag: () => void;
  deleteElement: (id: string) => void;
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
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Interactive Drag states
  const [draggingCard, setDraggingCard] = useState<DraggingCardState | null>(null);
  const [resizingCard, setResizingCard] = useState<{ id: string; startWidth: number; startHeight: number; startMouseX: number; startMouseY: number } | null>(null);
  const [drawingArrow, setDrawingArrow] = useState<DrawingArrowState | null>(null);
  const [drawingBox, setDrawingBox] = useState<{ startPoint: Point; currentPoint: Point; color: ThemeColor } | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<Point>({ x: 0, y: 0 });
  const [spacePressed, setSpacePressed] = useState(false);
  const [drawingSelectionBox, setDrawingSelectionBox] = useState<{ startPoint: Point; currentPoint: Point } | null>(null);

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
    switch (socket) {
      case 'top':
        basePt = { x: card.x + card.width / 2, y: card.y };
        break;
      case 'right':
        basePt = { x: card.x + card.width, y: card.y + card.height / 2 };
        break;
      case 'bottom':
        basePt = { x: card.x + card.width / 2, y: card.y + card.height };
        break;
      case 'left':
        basePt = { x: card.x, y: card.y + card.height / 2 };
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

    // 2. Click-to-spawn for fixed-size passive elements
    if (
      activeTool === 'resistor' ||
      activeTool === 'capacitor' ||
      activeTool === 'inductor'
    ) {
      const clickCoords = screenToCanvas(e.clientX, e.clientY);
      addCard(clickCoords.x - 30, clickCoords.y - 45, 60, 90, activeTool);
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
      setDrawingArrow({
        ...drawingArrow,
        currentPoint: mouseCanvas
      });
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
      
      if (isSocket) {
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

  // Build arrow path string
  const calculatePath = (
    from: Point,
    to: Point,
    style: 'straight' | 'curved' | 'dashed',
    fromDir?: 'top' | 'right' | 'bottom' | 'left',
    toDir?: 'top' | 'right' | 'bottom' | 'left'
  ) => {
    if (style === 'straight' || style === 'dashed') {
      return `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
    }

    let controlPoint1 = { ...from };
    let controlPoint2 = { ...to };
    
    const dx = Math.abs(to.x - from.x);
    const dy = Math.abs(to.y - from.y);
    const handleOffset = Math.max(Math.min(dx, dy) * 0.75, 45);

    if (fromDir) {
      if (fromDir === 'right') controlPoint1.x += handleOffset;
      if (fromDir === 'left') controlPoint1.x -= handleOffset;
      if (fromDir === 'bottom') controlPoint1.y += handleOffset;
      if (fromDir === 'top') controlPoint1.y -= handleOffset;
    } else {
      controlPoint1.x += handleOffset;
    }

    if (toDir) {
      if (toDir === 'right') controlPoint2.x += handleOffset;
      if (toDir === 'left') controlPoint2.x -= handleOffset;
      if (toDir === 'bottom') controlPoint2.y += handleOffset;
      if (toDir === 'top') controlPoint2.y -= handleOffset;
    } else {
      controlPoint2.x -= handleOffset;
    }

    return `M ${from.x} ${from.y} C ${controlPoint1.x} ${controlPoint1.y}, ${controlPoint2.x} ${controlPoint2.y}, ${to.x} ${to.y}`;
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
        <svg
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            overflow: 'visible',
            top: 0,
            left: 0,
            pointerEvents: 'none'
          }}
        >
          {/* arrowhead markers definitions */}
          <defs>
            {COLOR_THEMES.map((theme) => (
              <marker
                key={`marker-${theme.name}`}
                id={`arrowhead-${theme.name}`}
                markerWidth="8"
                markerHeight="7"
                refX="7.5"
                refY="3.5"
                orient="auto"
              >
                <polygon
                  points="0 0, 8 3.5, 0 7"
                  fill={theme.value}
                />
              </marker>
            ))}
            <marker
              id="arrowhead-white"
              markerWidth="8"
              markerHeight="7"
              refX="7.5"
              refY="3.5"
              orient="auto"
            >
              <polygon
                points="0 0, 8 3.5, 0 7"
                fill="#ffffff"
              />
            </marker>
          </defs>

          {/* Render established connector lines */}
          {arrows.map((arrow) => {
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

            const pathStr = calculatePath(
              startPt,
              endPt,
              arrow.style,
              arrow.fromSocket,
              arrow.toSocket
            );

            const isSelected = selectedId === arrow.id;
            const strokeColorVal = isSelected ? '#ffffff' : '#64748b';
            const isDashed = arrow.style === 'dashed';

            const midX = (startPt.x + endPt.x) / 2;
            const midY = (startPt.y + endPt.y) / 2;

            return (
              <g
                key={arrow.id}
                style={{ pointerEvents: 'auto', cursor: 'pointer' }}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedId(arrow.id);
                }}
              >
                <path
                  d={pathStr}
                  fill="none"
                  stroke="transparent"
                  strokeWidth="16"
                />
                <path
                  d={pathStr}
                  fill="none"
                  stroke={strokeColorVal}
                  strokeWidth={isSelected ? '2.5' : '2'}
                  strokeDasharray={isDashed ? '6,6' : 'none'}
                  style={{ transition: 'stroke 0.15s, stroke-width 0.15s' }}
                />
                {arrow.label && (
                  <g>
                    <rect
                      x={midX - (arrow.label.length * 3.8) - 6}
                      y={midY - 8}
                      width={(arrow.label.length * 7.6) + 12}
                      height="16"
                      rx="4"
                      fill="var(--bg-canvas)"
                      stroke={isSelected ? '#ffffff' : 'var(--border-subtle)'}
                      strokeWidth="1"
                    />
                    <text
                      x={midX}
                      y={midY + 4}
                      fill={isSelected ? '#ffffff' : 'var(--text-secondary)'}
                      fontSize="10"
                      fontWeight="bold"
                      fontFamily="var(--font-sans)"
                      textAnchor="middle"
                    >
                      {arrow.label}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* Render temporary live connector line preview when dragging socket */}
          {drawingArrow && drawingArrow.fromPoint && (
            <path
              d={calculatePath(drawingArrow.fromPoint, drawingArrow.currentPoint, drawingArrow.style, drawingArrow.fromSocket)}
              fill="none"
              stroke="#64748b"
              strokeWidth="2.0"
              strokeDasharray="4,4"
            />
          )}
        </svg>

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
          
          if (isPassive) {
            return (
              <div
                key={card.id}
                className={`canvas-card passive-component ${isSelected ? 'selected' : ''}`}
                style={{
                  left: `${card.x}px`,
                  top: `${card.y}px`,
                  width: `${card.width}px`,
                  height: `${card.height}px`,
                  zIndex: isSelected ? 99 : 5,
                  transform: `rotate(${card.rotation || 0}deg)`,
                  '--theme-color': `var(--theme-${card.color})`,
                  '--theme-color-glow': `var(--theme-${card.color}-glow)`
                } as React.CSSProperties}
                onMouseDown={(e) => initiateCardDrag(card, e)}
              >
                {/* Schematic SVG */}
                {card.componentType === 'resistor' && (
                  <svg width="100%" height="30" viewBox="0 0 100 30" fill="none" stroke="var(--theme-color)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', filter: 'drop-shadow(0 0 4px var(--theme-color-glow))' }}>
                    <path d="M 0 15 L 20 15 L 25 5 L 35 25 L 45 5 L 55 25 L 65 5 L 75 25 L 80 15 L 100 15" />
                  </svg>
                )}
                {card.componentType === 'capacitor' && (
                  <svg width="100%" height="40" viewBox="0 0 100 40" fill="none" stroke="var(--theme-color)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', filter: 'drop-shadow(0 0 4px var(--theme-color-glow))' }}>
                    <path d="M 0 20 L 43 20 M 57 20 L 100 20" />
                    <path d="M 43 5 L 43 35 M 57 5 L 57 35" />
                  </svg>
                )}
                {card.componentType === 'inductor' && (
                  <svg width="100%" height="30" viewBox="0 0 100 30" fill="none" stroke="var(--theme-color)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', filter: 'drop-shadow(0 0 4px var(--theme-color-glow))' }}>
                    <path d="M 0 15 L 20 15 C 20 5, 32 5, 32 15 C 32 5, 44 5, 44 15 C 44 5, 56 5, 56 15 C 56 5, 68 5, 68 15 C 68 5, 80 5, 80 15 L 100 15" />
                  </svg>
                )}

                {/* Vertically Stacked Component Labels at the bottom */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: '4px',
                    left: 0,
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '1px',
                    pointerEvents: 'none'
                  }}
                >
                  {/* Designator (Name) */}
                  <input
                    type="text"
                    className="passive-title-input"
                    value={`${card.componentType === 'resistor' ? 'R' : card.componentType === 'capacitor' ? 'C' : 'L'}${card.instanceNumber || 1}`}
                    onChange={(e) => {
                      const prefix = card.componentType === 'resistor' ? 'R' : card.componentType === 'capacitor' ? 'C' : 'L';
                      const num = parseInstanceNumber(e.target.value, prefix);
                      updateElement(card.id, { instanceNumber: num }, false);
                    }}
                    onBlur={finalizeDrag}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-primary)',
                      fontFamily: 'var(--font-sans)',
                      fontWeight: 700,
                      fontSize: '11px',
                      textAlign: 'center',
                      outline: 'none',
                      width: '100%',
                      pointerEvents: 'auto',
                      height: '14px',
                      lineHeight: '14px'
                    }}
                    placeholder="Name"
                  />

                  {/* Technical Value */}
                  <input
                    type="text"
                    className="passive-value-input"
                    value={formatEngineering(card.value)}
                    onChange={(e) => {
                      const num = parseEngineering(e.target.value);
                      updateElement(card.id, { value: num }, false);
                    }}
                    onBlur={finalizeDrag}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--theme-color)',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 600,
                      fontSize: '10px',
                      textAlign: 'center',
                      outline: 'none',
                      width: '100%',
                      pointerEvents: 'auto',
                      height: '13px',
                      lineHeight: '13px'
                    }}
                    placeholder="Value"
                  />
                </div>

                {/* Sockets for Wire connections */}
                {(activeTool === 'select' || activeTool === 'arrow' || activeTool === 'hand') && (
                  <>
                    {/* Left Lead Port */}
                    <div
                      className={`card-socket left ${
                        !arrows.some(
                          (arrow) =>
                            (arrow.fromId === card.id && arrow.fromSocket === 'left') ||
                            (arrow.toId === card.id && arrow.toSocket === 'left')
                        )
                          ? 'open-port'
                          : ''
                      }`}
                      data-card-id={card.id}
                      data-socket-dir="left"
                      onMouseDown={(e) => initiateArrowDraw(card, 'left', e)}
                    />

                    {/* Right Lead Port */}
                    <div
                      className={`card-socket right ${
                        !arrows.some(
                          (arrow) =>
                            (arrow.fromId === card.id && arrow.fromSocket === 'right') ||
                            (arrow.toId === card.id && arrow.toSocket === 'right')
                        )
                          ? 'open-port'
                          : ''
                      }`}
                      data-card-id={card.id}
                      data-socket-dir="right"
                      onMouseDown={(e) => initiateArrowDraw(card, 'right', e)}
                    />
                  </>
                )}
              </div>
            );
          }

          return (
            <div
              key={card.id}
              className={`canvas-card ${isSelected ? 'selected' : ''}`}
              style={{
                left: `${card.x}px`,
                top: `${card.y}px`,
                width: `${card.width}px`,
                height: `${card.height}px`,
                zIndex: isSelected ? 99 : 5,
                '--theme-color': `var(--theme-${card.color})`,
                '--theme-color-glow': `var(--theme-${card.color}-glow)`
              } as React.CSSProperties}
              onMouseDown={(e) => initiateCardDrag(card, e)}
            >
              <div className="card-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
                  {card.componentType && (
                    <div className="component-icon" style={{ flexShrink: 0, display: 'flex', alignItems: 'center', opacity: 0.85 }}>
                      {card.componentType === 'resistor' && (
                        <svg width="32" height="16" viewBox="0 0 60 30" fill="none" stroke="var(--theme-color)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M 0 15 L 12 15 L 16 5 L 24 25 L 32 5 L 40 25 L 44 15 L 60 15" />
                        </svg>
                      )}
                      {card.componentType === 'capacitor' && (
                        <svg width="32" height="16" viewBox="0 0 60 30" fill="none" stroke="var(--theme-color)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M 0 15 L 24 15 M 36 15 L 60 15" />
                          <path d="M 24 5 L 24 25 M 36 5 L 36 25" />
                        </svg>
                      )}
                      {card.componentType === 'inductor' && (
                        <svg width="32" height="16" viewBox="0 0 60 30" fill="none" stroke="var(--theme-color)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M 0 15 L 10 15 C 10 5, 20 5, 20 15 C 20 5, 30 5, 30 15 C 30 5, 40 5, 40 15 C 40 5, 50 5, 50 15 L 60 15" />
                        </svg>
                      )}
                    </div>
                  )}
                  <input
                    type="text"
                    className="card-title-input"
                    value={card.title}
                    onChange={(e) => updateElement(card.id, { title: e.target.value }, false)}
                    onBlur={finalizeDrag}
                    placeholder="Component Title"
                  />
                </div>
              </div>

              <div className="card-body">
                <textarea
                  className="card-textarea"
                  value={card.content}
                  onChange={(e) => updateElement(card.id, { content: e.target.value }, false)}
                  onBlur={finalizeDrag}
                  placeholder="Describe your thoughts..."
                />
              </div>

              {(activeTool === 'select' || activeTool === 'arrow' || activeTool === 'hand') && (
                <>
                  <div
                    className="card-socket top"
                    data-card-id={card.id}
                    data-socket-dir="top"
                    onMouseDown={(e) => initiateArrowDraw(card, 'top', e)}
                  />
                  <div
                    className="card-socket right"
                    data-card-id={card.id}
                    data-socket-dir="right"
                    onMouseDown={(e) => initiateArrowDraw(card, 'right', e)}
                  />
                  <div
                    className="card-socket bottom"
                    data-card-id={card.id}
                    data-socket-dir="bottom"
                    onMouseDown={(e) => initiateArrowDraw(card, 'bottom', e)}
                  />
                  <div
                    className="card-socket left"
                    data-card-id={card.id}
                    data-socket-dir="left"
                    onMouseDown={(e) => initiateArrowDraw(card, 'left', e)}
                  />
                </>
              )}

              {activeTool === 'select' && (
                <div
                  className="card-resize-handle"
                  onMouseDown={(e) => initiateCardResize(card, e)}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const COLOR_THEMES: { name: ThemeColor; value: string }[] = [
  { name: 'slate', value: '#64748b' },
  { name: 'amethyst', value: '#a855f7' },
  { name: 'sapphire', value: '#3b82f6' },
  { name: 'emerald', value: '#10b981' },
  { name: 'coral', value: '#f43f5e' },
  { name: 'amber', value: '#f59e0b' },
];
