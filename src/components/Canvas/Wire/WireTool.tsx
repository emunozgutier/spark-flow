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

export const splitWire = (
  targetWire: ArrowElement,
  snapPt: Point,
  joinId: string,
  cards: CardElement[],
  getSocketPosition: (card: CardElement, socket: 'top' | 'right' | 'bottom' | 'left') => Point
): { wireA: ArrowElement; wireB: ArrowElement; joinSocketForOrigFrom: 'top' | 'right' | 'bottom' | 'left'; joinSocketForOrigTo: 'top' | 'right' | 'bottom' | 'left' } | null => {
  const origFromCard = cards.find((c) => c.id === targetWire.fromId);
  const origToCard = cards.find((c) => c.id === targetWire.toId);

  if (origFromCard && origToCard && targetWire.fromSocket && targetWire.toSocket) {
    const origFromSocketPt = getSocketPosition(origFromCard, targetWire.fromSocket);
    const origToSocketPt = getSocketPosition(origToCard, targetWire.toSocket);

    const joinCenter = snapPt;
    const socketForOrigFrom = getJoinSocketDirection(joinCenter, origFromSocketPt);
    const socketForOrigTo = getJoinSocketDirection(joinCenter, origToSocketPt);

    const wireA: ArrowElement = {
      id: `arrow-${Date.now()}-split-a-${Math.random().toString(36).substr(2, 5)}`,
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
      id: `arrow-${Date.now()}-split-b-${Math.random().toString(36).substr(2, 5)}`,
      type: 'arrow',
      fromId: joinId,
      fromSocket: socketForOrigTo,
      toId: targetWire.toId,
      toSocket: targetWire.toSocket,
      color: targetWire.color,
      style: targetWire.style,
      label: ''
    };

    return {
      wireA,
      wireB,
      joinSocketForOrigFrom: socketForOrigFrom,
      joinSocketForOrigTo: socketForOrigTo
    };
  }

  return null;
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
    const realTarget = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    const targetElement = realTarget || (e.target as HTMLElement);
    const isSocket = targetElement?.classList.contains('card-socket');

    if (isSocket) {
      const toCardId = targetElement.getAttribute('data-card-id');
      const toSocketDir = targetElement.getAttribute('data-socket-dir') as 'top' | 'right' | 'bottom' | 'left';
      if (toCardId && toSocketDir && toCardId !== drawingArrow.fromId) {
        const targetCard = cards.find((c) => c.id === toCardId);
        if (targetCard) {
          const socketPt = getSocketPosition(targetCard, toSocketDir);
          setActiveSnap(null);
          setDrawingArrow({
            ...drawingArrow,
            currentPoint: socketPt,
            toSocket: toSocketDir,
            toCardId: toCardId
          } as any);
          return;
        }
      }
    }

    const snapResult = findClosestWirePoint(mouseCanvas, arrows, cards, getSocketPosition);
    if (snapResult) {
      setActiveSnap({ wire: snapResult.wire, point: snapResult.point });
      const nextArrow = { ...drawingArrow } as any;
      delete nextArrow.toSocket;
      delete nextArrow.toCardId;
      nextArrow.currentPoint = snapResult.point;
      setDrawingArrow(nextArrow);
    } else {
      setActiveSnap(null);
      const nextArrow = { ...drawingArrow } as any;
      delete nextArrow.toSocket;
      delete nextArrow.toCardId;
      nextArrow.currentPoint = mouseCanvas;
      setDrawingArrow(nextArrow);
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
  setDrawingArrow: React.Dispatch<React.SetStateAction<DrawingArrowState | null>>,
  setActiveSnap: React.Dispatch<React.SetStateAction<{ wire: ArrowElement; point: Point } | null>>,
  setToast?: (toast: { message: string; type: 'success' | 'info' } | null) => void
) => {
  if (!drawingArrow) return;

  const realTarget = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
  const targetElement = realTarget || (e.target as HTMLElement);
  const isSocket = targetElement?.classList.contains('card-socket');
  const cards = elements.filter((el) => el.type === 'box') as CardElement[];
  const arrows = elements.filter((el) => el.type === 'arrow') as ArrowElement[];

  // 1. Resolve start wire and snap point from drawingArrow
  const extArrow = drawingArrow as any;
  const fromWireId = extArrow.fromWireId;
  const fromWireSnapPt = extArrow.fromWireSnapPt;
  const startWire = fromWireId ? arrows.find((w) => w.id === fromWireId) : null;

  // 2. Resolve end wire snap point
  let finalSnap = activeSnap;
  if (!finalSnap) {
    const mouseCanvas = screenToCanvas(e.clientX, e.clientY);
    const snapResult = findClosestWirePoint(mouseCanvas, arrows, cards, getSocketPosition);
    if (snapResult) {
      finalSnap = { wire: snapResult.wire, point: snapResult.point };
    }
  }

  // Define transaction lists
  let nextElements = [...elements];
  let createdJoins: CardElement[] = [];
  let createdWires: ArrowElement[] = [];
  let deletedWireIds: string[] = [];

  const joinStartId = `join-start-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
  const joinEndId = `join-end-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

  // Handle start wire split
  let joinStartCreated = false;
  if (startWire && fromWireSnapPt) {
    const splitResult = splitWire(startWire, fromWireSnapPt, joinStartId, cards, getSocketPosition);
    if (splitResult) {
      const joinCard: CardElement = {
        id: joinStartId,
        type: 'box',
        x: fromWireSnapPt.x - 8,
        y: fromWireSnapPt.y - 8,
        width: 16,
        height: 16,
        color: startWire.color || 'slate',
        title: 'join',
        content: ''
      };
      createdJoins.push(joinCard);
      createdWires.push(splitResult.wireA, splitResult.wireB);
      deletedWireIds.push(startWire.id);
      joinStartCreated = true;
    }
  }

  // Handle end wire split
  let joinEndCreated = false;
  const endWire = finalSnap ? arrows.find((w) => w.id === finalSnap.wire.id) : null;
  const endWireSnapPt = finalSnap?.point;

  if (endWire && endWireSnapPt && (!startWire || endWire.id !== startWire.id)) {
    const splitResult = splitWire(endWire, endWireSnapPt, joinEndId, cards, getSocketPosition);
    if (splitResult) {
      const joinCard: CardElement = {
        id: joinEndId,
        type: 'box',
        x: endWireSnapPt.x - 8,
        y: endWireSnapPt.y - 8,
        width: 16,
        height: 16,
        color: endWire.color || 'slate',
        title: 'join',
        content: ''
      };
      createdJoins.push(joinCard);
      createdWires.push(splitResult.wireA, splitResult.wireB);
      deletedWireIds.push(endWire.id);
      joinEndCreated = true;
    }
  }

  // Determine wireNew properties
  let fromId = drawingArrow.fromId;
  let fromSocket = drawingArrow.fromSocket;
  let fromPt = drawingArrow.fromPoint || fromWireSnapPt;

  if (joinStartCreated && fromWireSnapPt) {
    fromId = joinStartId;
    fromPt = fromWireSnapPt;
  }

  // Decide destination target
  if (joinEndCreated && endWireSnapPt) {
    const toSocketStart = getJoinSocketDirection(fromPt, endWireSnapPt);
    const toSocketEnd = getJoinSocketDirection(endWireSnapPt, fromPt);

    if (joinStartCreated) {
      fromSocket = toSocketStart;
    }

    const wireNew: ArrowElement = {
      id: `arrow-new-${Date.now()}`,
      type: 'arrow',
      fromId: fromId,
      fromSocket: fromSocket,
      toId: joinEndId,
      toSocket: toSocketEnd,
      color: drawingArrow.color || 'slate',
      style: drawingArrow.style || 'curved',
      label: ''
    };
    createdWires.push(wireNew);

  } else if (isSocket) {
    const toCardId = targetElement.getAttribute('data-card-id') || '';
    const toSocketDir = (targetElement.getAttribute('data-socket-dir') || 'left') as 'top' | 'right' | 'bottom' | 'left';
    
    if (toCardId && toSocketDir && (toCardId !== fromId)) {
      const targetCard = cards.find((c) => c.id === toCardId);
      const targetSocketPt = targetCard ? getSocketPosition(targetCard, toSocketDir) : fromPt;
      
      if (joinStartCreated) {
        fromSocket = getJoinSocketDirection(fromPt, targetSocketPt);
      }

      const wireNew: ArrowElement = {
        id: `arrow-new-${Date.now()}`,
        type: 'arrow',
        fromId: fromId,
        fromSocket: fromSocket,
        toId: toCardId,
        toSocket: toSocketDir,
        color: drawingArrow.color || 'slate',
        style: drawingArrow.style || 'curved',
        label: ''
      };
      createdWires.push(wireNew);
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

    let incomingSocket: 'top' | 'right' | 'bottom' | 'left' = 'left';
    const dx = newCard.x - fromPt.x;
    const dy = newCard.y - fromPt.y;
    if (Math.abs(dx) > Math.abs(dy)) {
      incomingSocket = dx > 0 ? 'left' : 'right';
    } else {
      incomingSocket = dy > 0 ? 'top' : 'bottom';
    }

    if (joinStartCreated) {
      fromSocket = getJoinSocketDirection(fromPt, { x: newCard.x, y: newCard.y });
    }

    const wireNew: ArrowElement = {
      id: `arrow-new-${Date.now()}`,
      type: 'arrow',
      fromId: fromId,
      fromSocket: fromSocket,
      toId: newCardId,
      toSocket: incomingSocket,
      color: drawingArrow.color || 'slate',
      style: drawingArrow.style || 'curved',
      label: ''
    };

    nextElements.push(newCard);
    createdWires.push(wireNew);
  }

  if (createdWires.length > 0 || createdJoins.length > 0) {
    let filteredElements = nextElements.filter((el) => !deletedWireIds.includes(el.id));
    const finalElements = [...filteredElements, ...createdJoins, ...createdWires];

    const temporalApi = (useCanvas as any).temporal?.getState();
    temporalApi?.resume();

    useCanvas.setState({ elements: finalElements });
    localStorage.setItem('spark-flow:board-elements', JSON.stringify(finalElements));

    if (setToast) {
      setToast({
        message: '🔗 Wire connection established successfully!',
        type: 'success'
      });
    }
  }

  setDrawingArrow(null);
  setActiveSnap(null);
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
  const targetCard = drawingArrow && (drawingArrow as any).toCardId
    ? cards.find((c) => c.id === (drawingArrow as any).toCardId)
    : null;

  return (
    <>
      {/* SVG Overlay layer for paths and snap indicators */}
      {(drawingArrow || activeSnap) && (
        <svg
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            overflow: 'visible'
          }}
        >
          {/* 1. Render temporary live connector line preview when dragging socket */}
          {drawingArrow && drawingArrow.fromPoint && (
            <path
              d={calculatePath(
                drawingArrow.fromPoint,
                drawingArrow.currentPoint,
                drawingArrow.style,
                drawingArrow.fromSocket,
                (drawingArrow as any).toSocket,
                sourceCard?.rotation || 0,
                targetCard?.rotation || 0
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
        </svg>
      )}

      {/* 1.5. Render preview join at drawing start if started on a wire */}
      {drawingArrow && (drawingArrow as any).fromWireId && (drawingArrow as any).fromWireSnapPt && (
        <Join
          card={{
            id: 'temp-start-join',
            type: 'box',
            x: (drawingArrow as any).fromWireSnapPt.x - 8,
            y: (drawingArrow as any).fromWireSnapPt.y - 8,
            width: 16,
            height: 16,
            color: drawingArrow.color || 'slate',
            title: 'join',
            content: ''
          } as CardElement}
          isSelected={false}
          activeTool={activeTool}
          initiateCardDrag={() => {}}
          initiateArrowDraw={() => {}}
        />
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
