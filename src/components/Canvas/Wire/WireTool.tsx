import React from 'react';
import type { 
  Point, 
  CardElement, 
  ArrowElement, 
  CanvasElement, 
  ToolType, 
  ThemeColor, 
  DrawingArrowState 
} from '../../../dataTypes/AnotateType';
import { 
  calculatePath, 
  getOrthogonalPathPoints, 
  getAbsoluteDirection 
} from '../Wires';
import { Join } from './Join';
import { useCanvas } from '../../../store/useCanvas';

// Helper to determine the socket direction on the join node relative to the target point
export const getJoinSocketDirection = (joinCenter: Point, targetPt: Point): 'top' | 'right' | 'bottom' | 'left' => {
  const dx = targetPt.x - joinCenter.x;
  const dy = targetPt.y - joinCenter.y;
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? 'right' : 'left';
  } else {
    return dy > 0 ? 'bottom' : 'top';
  }
};

// Interface for wire snapping results
export interface WireSnapResult {
  wire: ArrowElement;
  point: Point;
  distance: number;
}

// Helper to find the closest point on any wire path relative to the mouse canvas coordinates
export const findClosestWirePoint = (
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

// Handles cursor movement inside wire mode (active snapping and drag path drawing update)
export const handleWireMouseMove = (
  e: React.MouseEvent,
  drawingArrow: DrawingArrowState | null,
  activeTool: ToolType,
  elements: CanvasElement[],
  screenToCanvas: (x: number, y: number) => Point,
  getSocketPosition: (card: CardElement, socket: 'top' | 'right' | 'bottom' | 'left') => Point,
  setDrawingArrow: React.Dispatch<React.SetStateAction<DrawingArrowState | null>>,
  setActiveSnap: React.Dispatch<React.SetStateAction<{ wire: ArrowElement; point: Point } | null>>,
  setTempJoin: React.Dispatch<React.SetStateAction<{ x: number; y: number; wire: ArrowElement } | null>>
) => {
  const mouseCanvas = screenToCanvas(e.clientX, e.clientY);
  const arrows = elements.filter((el) => el.type === 'arrow') as ArrowElement[];
  const cards = elements.filter((el) => el.type === 'box') as CardElement[];

  // 1. Drawing Connection Arrow dragging
  if (drawingArrow) {
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

  // 2. Hovering wire in Wire tool mode (spawns temp join preview)
  if (activeTool === 'arrow') {
    const snapResult = findClosestWirePoint(mouseCanvas, arrows, cards, getSocketPosition);
    if (snapResult) {
      setTempJoin({
        x: snapResult.point.x,
        y: snapResult.point.y,
        wire: snapResult.wire
      });
    } else {
      setTempJoin(null);
    }
  }
};

// Finalizes drawing or splits a wire on mouse up
export const handleWireMouseUp = (
  e: React.MouseEvent,
  drawingArrow: DrawingArrowState | null,
  activeSnap: { wire: ArrowElement; point: Point } | null,
  activeTool: ToolType,
  elements: CanvasElement[],
  screenToCanvas: (x: number, y: number) => Point,
  getSocketPosition: (card: CardElement, socket: 'top' | 'right' | 'bottom' | 'left') => Point,
  addArrow: (arrow: Omit<ArrowElement, 'id' | 'type'>) => void,
  updateElement: (id: string, updates: Partial<any>, record?: boolean) => void,
  setDrawingArrow: React.Dispatch<React.SetStateAction<DrawingArrowState | null>>,
  setActiveSnap: React.Dispatch<React.SetStateAction<{ wire: ArrowElement; point: Point } | null>>,
  setToast?: (toast: { message: string; type: 'success' | 'info' } | null) => void
) => {
  if (!drawingArrow) return;

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

      const joinId = `join-${Date.now()}`;
      const wireAId = `arrow-${Date.now()}-a`;
      const wireBId = `arrow-${Date.now()}-b`;
      const wireCId = `arrow-${Date.now()}-c`;

      const origFromCard = cards.find((c) => c.id === targetWire.fromId);
      const origToCard = cards.find((c) => c.id === targetWire.toId);

      if (origFromCard && origToCard && targetWire.fromSocket && targetWire.toSocket) {
        const origFromSocketPt = getSocketPosition(origFromCard, targetWire.fromSocket);
        const origToSocketPt = getSocketPosition(origToCard, targetWire.toSocket);

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

        const joinCenter = snapPt;
        const socketForOrigFrom = getJoinSocketDirection(joinCenter, origFromSocketPt);
        const socketForOrigTo = getJoinSocketDirection(joinCenter, origToSocketPt);
        
        const sourceCard = cards.find((c) => c.id === fromId);
        const sourceSocketPt = sourceCard ? getSocketPosition(sourceCard, fromSocket) : snapPt;
        const socketForNewSource = getJoinSocketDirection(joinCenter, sourceSocketPt);

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
    const cardColors: ThemeColor[] = ['amethyst', 'emerald', 'sapphire', 'amber', 'coral', 'slate'];
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
};

export const handleStartDrawingFromTempJoin = (
  snapPtX: number,
  snapPtY: number,
  targetWire: ArrowElement,
  clickedSocketDir: 'top' | 'right' | 'bottom' | 'left',
  e: React.MouseEvent,
  elements: CanvasElement[],
  getSocketPosition: (card: CardElement, socket: 'top' | 'right' | 'bottom' | 'left') => Point,
  setDrawingArrow: React.Dispatch<React.SetStateAction<DrawingArrowState | null>>,
  setTempJoin: React.Dispatch<React.SetStateAction<{ x: number; y: number; wire: ArrowElement } | null>>,
  setToast?: (toast: { message: string; type: 'success' | 'info' } | null) => void
) => {
  e.stopPropagation();
  e.preventDefault();

  const cards = elements.filter((el) => el.type === 'box') as CardElement[];
  const snapPt = { x: snapPtX, y: snapPtY };

  const joinId = `join-${Date.now()}`;
  const wireAId = `arrow-${Date.now()}-a`;
  const wireBId = `arrow-${Date.now()}-b`;

  const origFromCard = cards.find((c) => c.id === targetWire.fromId);
  const origToCard = cards.find((c) => c.id === targetWire.toId);

  if (origFromCard && origToCard && targetWire.fromSocket && targetWire.toSocket) {
    const origFromSocketPt = getSocketPosition(origFromCard, targetWire.fromSocket);
    const origToSocketPt = getSocketPosition(origToCard, targetWire.toSocket);

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

    const joinCenter = snapPt;
    const socketForOrigFrom = getJoinSocketDirection(joinCenter, origFromSocketPt);
    const socketForOrigTo = getJoinSocketDirection(joinCenter, origToSocketPt);

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

    const filteredElements = elements.filter((el) => el.id !== targetWire.id);
    const nextElements = [...filteredElements, joinCard, wireA, wireB];

    const temporalApi = (useCanvas as any).temporal?.getState();
    temporalApi?.resume();

    useCanvas.setState({ elements: nextElements });
    localStorage.setItem('spark-flow:board-elements', JSON.stringify(nextElements));

    const socketPt = getSocketPosition(joinCard, clickedSocketDir);
    setDrawingArrow({
      fromId: joinId,
      fromSocket: clickedSocketDir,
      fromPoint: socketPt,
      currentPoint: socketPt,
      color: joinCard.color,
      style: 'curved'
    });

    setTempJoin(null);

    if (setToast) {
      setToast({
        message: '🔗 Wire split at junction! Drawing new wire...',
        type: 'success'
      });
    }
  }
};

interface WireToolProps {
  drawingArrow: DrawingArrowState | null;
  activeSnap: { wire: ArrowElement; point: Point } | null;
  tempJoin: { x: number; y: number; wire: ArrowElement } | null;
  activeTool: ToolType;
  elements: CanvasElement[];
  handleStartDrawingFromTempJoin: (
    snapPtX: number,
    snapPtY: number,
    targetWire: ArrowElement,
    clickedSocketDir: 'top' | 'right' | 'bottom' | 'left',
    e: React.MouseEvent
  ) => void;
}

export const WireTool: React.FC<WireToolProps> = ({
  drawingArrow,
  activeSnap,
  tempJoin,
  activeTool,
  elements,
  handleStartDrawingFromTempJoin
}) => {
  const cards = elements.filter((el) => el.type === 'box') as CardElement[];
  const sourceCard = drawingArrow ? cards.find((c) => c.id === drawingArrow.fromId) : null;

  return (
    <>
      {/* 1. Render temporary live connector line preview when dragging socket */}
      {drawingArrow && drawingArrow.fromPoint && (
        <path
          d={calculatePath(
            drawingArrow.fromPoint,
            drawingArrow.currentPoint,
            drawingArrow.style,
            drawingArrow.fromSocket,
            undefined,
            sourceCard?.rotation || 0,
            0
          )}
          fill="none"
          stroke="#64748b"
          strokeWidth="2.0"
          strokeDasharray="4,4"
        />
      )}

      {/* 2. Render temporary live snap join indicator */}
      {drawingArrow && activeSnap && (
        <g style={{ pointerEvents: 'none' }}>
          {/* Glowing pulse ring */}
          <circle
            cx={activeSnap.point.x}
            cy={activeSnap.point.y}
            r="8"
            fill="rgba(244, 63, 94, 0.35)"
            style={{ transformOrigin: `${activeSnap.point.x}px ${activeSnap.point.y}px` }}
          />
          {/* Core circular junction dot */}
          <circle
            cx={activeSnap.point.x}
            cy={activeSnap.point.y}
            r="4.5"
            fill="#f43f5e"
            stroke="#ffffff"
            strokeWidth="1"
          />
          {/* Glow tooltip saying "JOIN" */}
          <g transform={`translate(${activeSnap.point.x}, ${activeSnap.point.y - 15})`}>
            <rect
              x="-18"
              y="-10"
              width="36"
              height="14"
              rx="3"
              fill="#f43f5e"
              stroke="#ffffff"
              strokeWidth="0.5"
            />
            <text
              fill="#ffffff"
              fontSize="8"
              fontWeight="bold"
              textAnchor="middle"
              y="-1"
              fontFamily="var(--font-sans)"
            >
              JOIN
            </text>
          </g>
        </g>
      )}

      {/* 3. Render temporary hover join on wire */}
      {tempJoin && !drawingArrow && activeTool === 'arrow' && (
        <Join
          card={{
            id: 'temp-join',
            type: 'box',
            x: tempJoin.x - 8,
            y: tempJoin.y - 8,
            width: 16,
            height: 16,
            color: tempJoin.wire.color || 'slate',
            title: 'join',
            content: ''
          } as CardElement}
          isSelected={false}
          activeTool={activeTool}
          initiateCardDrag={() => {}}
          initiateArrowDraw={(_, socketDir, e) => {
            handleStartDrawingFromTempJoin(tempJoin.x, tempJoin.y, tempJoin.wire, socketDir, e);
          }}
        />
      )}
    </>
  );
};
