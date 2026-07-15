import React from 'react';
import type { ArrowElement, CardElement, Point } from '../../dataTypes/AnotateType';
import { Wire } from './Wire/WirePath';
import { useCanvas } from '../../store/useCanvas';

interface WiresProps {
  arrows: ArrowElement[];
  cards: CardElement[];
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  getSocketPosition: (card: CardElement, socket: 'top' | 'right' | 'bottom' | 'left') => Point;
  wireVoltages?: Record<string, number>;
  wireCurrents?: Record<string, number>;
}

const COLOR_THEMES = [
  { name: 'slate', value: '#64748b' },
  { name: 'amethyst', value: '#a855f7' },
  { name: 'sapphire', value: '#3b82f6' },
  { name: 'emerald', value: '#10b981' },
  { name: 'coral', value: '#f43f5e' },
  { name: 'amber', value: '#f59e0b' },
];

export const getAbsoluteDirection = (
  localDir?: 'top' | 'right' | 'bottom' | 'left',
  rotation: number = 0
): 'top' | 'right' | 'bottom' | 'left' | undefined => {
  if (!localDir) return undefined;
  const dirs: ('top' | 'right' | 'bottom' | 'left')[] = ['top', 'right', 'bottom', 'left'];
  const localIndex = dirs.indexOf(localDir);
  const steps = Math.round((rotation % 360) / 90);
  const absoluteIndex = (localIndex + steps) % 4;
  return dirs[absoluteIndex >= 0 ? absoluteIndex : absoluteIndex + 4];
};

const simplifyPathPoints = (points: Point[]): Point[] => {
  if (points.length === 0) return [];
  const result: Point[] = [points[0]];
  
  // 1. Remove adjacent duplicate points
  for (let i = 1; i < points.length; i++) {
    const prev = result[result.length - 1];
    const curr = points[i];
    if (prev.x !== curr.x || prev.y !== curr.y) {
      result.push(curr);
    }
  }

  if (result.length < 3) return result;
  
  // 2. Remove collinear intermediate points
  const simplified: Point[] = [result[0]];
  for (let i = 1; i < result.length - 1; i++) {
    const prev = simplified[simplified.length - 1];
    const curr = result[i];
    const next = result[i + 1];

    const dx1 = curr.x - prev.x;
    const dy1 = curr.y - prev.y;
    const dx2 = next.x - curr.x;
    const dy2 = next.y - curr.y;

    const isCollinear = (dx1 === 0 && dx2 === 0) || (dy1 === 0 && dy2 === 0);
    if (!isCollinear) {
      simplified.push(curr);
    }
  }
  simplified.push(result[result.length - 1]);
  return simplified;
};

const getSocketPos = (card: CardElement, socket: 'top' | 'right' | 'bottom' | 'left'): Point => {
  let basePt = { x: 0, y: 0 };
  const isPassive = !!card.componentType;
  const isTwoPort = isPassive && card.componentType !== 'ground' && card.componentType !== 'bjt' && card.componentType !== 'mosfet';
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
};

const isVerticalTwoPortSocket = (
  pt: Point,
  cards: CardElement[]
): { card: CardElement; socket: 'left' | 'right' } | null => {
  for (const card of cards) {
    if (!card.componentType) continue;
    const isTwoPort = card.componentType !== 'ground' && 
                      card.componentType !== 'bjt' && 
                      card.componentType !== 'mosfet' &&
                      card.componentType !== 'text';
    if (!isTwoPort) continue;
    
    // Check if it's vertical (90 or 270 degrees rotation)
    const isVertical = Math.abs(card.rotation || 0) % 180 === 90;
    if (!isVertical) continue;

    // Calculate absolute socket positions for 'left' and 'right' ports
    const leftPt = getSocketPos(card, 'left');
    const rightPt = getSocketPos(card, 'right');

    const distLeft = Math.hypot(pt.x - leftPt.x, pt.y - leftPt.y);
    const distRight = Math.hypot(pt.x - rightPt.x, pt.y - rightPt.y);

    if (distLeft < 1.0) {
      return { card, socket: 'left' };
    }
    if (distRight < 1.0) {
      return { card, socket: 'right' };
    }
  }
  return null;
};

const findCardForSocket = (pt: Point, cards: CardElement[]): CardElement | null => {
  const dirs: ('top' | 'right' | 'bottom' | 'left')[] = ['top', 'right', 'bottom', 'left'];
  for (const card of cards) {
    for (const dir of dirs) {
      const socketPt = getSocketPos(card, dir);
      if (Math.hypot(pt.x - socketPt.x, pt.y - socketPt.y) < 1.0) {
        return card;
      }
    }
  }
  return null;
};

export const getOrthogonalPathPoints = (
  from: Point,
  to: Point,
  absFromDir?: 'top' | 'right' | 'bottom' | 'left',
  absToDir?: 'top' | 'right' | 'bottom' | 'left',
  _arrowId?: string
): Point[] => {
  const minSegment = 24; // Distance to push wire away from component

  // Keep wires perfectly snapped to grid lines with sharp clean 90-degree corners
  const offset = 0;

  // Retrieve current cards from useCanvas
  let cards: CardElement[] = [];
  try {
    const elements = useCanvas.getState().elements;
    cards = elements.filter((el) => el.type === 'box') as CardElement[];
  } catch (e) {
    // Fallback if useCanvas is not initialized yet
  }

  let finalAbsFromDir = absFromDir;
  let finalAbsToDir = absToDir;

  let forceFromUturn = false;
  let forceToUturn = false;

  let customP1: Point | null = null;
  let customP2: Point | null = null;

  // Check if "from" is a socket on a vertical two-port component
  const fromInfo = isVerticalTwoPortSocket(from, cards);
  if (fromInfo) {
    const { card: fromCard } = fromInfo;
    const goLeft = to.x < fromCard.x + fromCard.width / 2;
    if (goLeft) {
      finalAbsFromDir = 'left';
      customP1 = { x: fromCard.x - minSegment, y: from.y };
    } else {
      finalAbsFromDir = 'right';
      customP1 = { x: fromCard.x + fromCard.width + minSegment, y: from.y };
    }
    forceFromUturn = true;
  }

  // Check if "to" is a socket on a vertical two-port component
  const toInfo = isVerticalTwoPortSocket(to, cards);
  if (toInfo) {
    const { card: toCard } = toInfo;
    const goLeft = from.x < toCard.x + toCard.width / 2;
    if (goLeft) {
      finalAbsToDir = 'left';
      customP2 = { x: toCard.x - minSegment, y: to.y };
    } else {
      finalAbsToDir = 'right';
      customP2 = { x: toCard.x + toCard.width + minSegment, y: to.y };
    }
    forceToUturn = true;
  }
  
  // 1. Determine the actual lead-out point
  let p1 = customP1 ? { ...customP1 } : { ...from };
  if (!customP1) {
    if (finalAbsFromDir === 'left') p1.x -= minSegment;
    else if (finalAbsFromDir === 'right') p1.x += minSegment;
    else if (finalAbsFromDir === 'top') p1.y -= minSegment;
    else if (finalAbsFromDir === 'bottom') p1.y += minSegment;
    else {
      p1.x += (to.x > from.x ? minSegment : -minSegment);
    }
  }

  // 2. Determine the actual lead-in point
  let p2 = customP2 ? { ...customP2 } : { ...to };
  if (!customP2) {
    if (finalAbsToDir === 'left') p2.x -= minSegment;
    else if (finalAbsToDir === 'right') p2.x += minSegment;
    else if (finalAbsToDir === 'top') p2.y -= minSegment;
    else if (finalAbsToDir === 'bottom') p2.y += minSegment;
    else {
      p2.x += (to.x > from.x ? -minSegment : minSegment);
    }
  }

  if (forceFromUturn) {
    const path = [from, p1, { x: p1.x, y: p2.y }, p2, to];
    return simplifyPathPoints(path);
  }
  if (forceToUturn) {
    const path = [from, p1, { x: p2.x, y: p1.y }, p2, to];
    return simplifyPathPoints(path);
  }

  // Check if we need to route around horizontal overlapping components
  const isP1ExitHorizontal = finalAbsFromDir === 'left' || finalAbsFromDir === 'right';
  const isP2EntryHorizontal = finalAbsToDir === 'left' || finalAbsToDir === 'right';

  if (isP1ExitHorizontal && isP2EntryHorizontal) {
    const fromCard = findCardForSocket(from, cards);
    const toCard = findCardForSocket(to, cards);
    if (fromCard && toCard && fromCard.id !== toCard.id) {
      const isCrossing = (finalAbsFromDir === 'right' && to.x < from.x) || (finalAbsFromDir === 'left' && to.x > from.x);
      if (isCrossing) {
        const minY = Math.min(fromCard.y, toCard.y);
        const maxY = Math.max(fromCard.y + fromCard.height, toCard.y + toCard.height);
        const bypassY = (Math.abs(from.y - minY) < Math.abs(from.y - maxY))
          ? (minY - minSegment)
          : (maxY + minSegment);

        const p1x = finalAbsFromDir === 'left'
          ? fromCard.x - minSegment
          : fromCard.x + fromCard.width + minSegment;

        const p2x = finalAbsToDir === 'left'
          ? toCard.x - minSegment
          : toCard.x + toCard.width + minSegment;

        const path = [
          from,
          { x: p1x, y: from.y },
          { x: p1x, y: bypassY },
          { x: p2x, y: bypassY },
          { x: p2x, y: to.y },
          to
        ];
        return simplifyPathPoints(path);
      }
    }
  }

  // 3. Connect p1 and p2 using orthogonal steps
  const path: Point[] = [from, p1];

  if (isP1ExitHorizontal) {
    if (isP2EntryHorizontal) {
      // Both horizontal (left/right)
      let trunkX = (p1.x + p2.x) / 2 + offset;
      if (finalAbsFromDir === finalAbsToDir) {
        if (finalAbsFromDir === 'right') {
          trunkX = p1.x > p2.x ? p1.x : p2.x;
        } else if (finalAbsFromDir === 'left') {
          trunkX = p1.x < p2.x ? p1.x : p2.x;
        }
      }
      path.push({ x: trunkX, y: p1.y });
      path.push({ x: trunkX, y: p2.y });
    } else {
      // Exit is horizontal, Entry is vertical
      const needsUturn = (finalAbsFromDir === 'right' && p2.x < from.x) || (finalAbsFromDir === 'left' && p2.x > from.x);
      if (needsUturn) {
        path.push({ x: p1.x, y: p2.y });
      } else {
        path.push({ x: p2.x + offset, y: p1.y });
        path.push({ x: p2.x + offset, y: p2.y });
      }
    }
  } else {
    if (!isP2EntryHorizontal) {
      // Both vertical (top/bottom)
      let trunkY = (p1.y + p2.y) / 2 + offset;
      if (finalAbsFromDir === finalAbsToDir) {
        if (finalAbsFromDir === 'bottom') {
          trunkY = p1.y > p2.y ? p1.y : p2.y;
        } else if (finalAbsFromDir === 'top') {
          trunkY = p1.y < p2.y ? p1.y : p2.y;
        }
      }
      path.push({ x: p1.x, y: trunkY });
      path.push({ x: p2.x, y: trunkY });
    } else {
      // Exit is vertical, Entry is horizontal
      const needsUturn = (finalAbsFromDir === 'bottom' && p2.y < from.y) || (finalAbsFromDir === 'top' && p2.y > from.y);
      if (needsUturn) {
        path.push({ x: p2.x, y: p1.y });
      } else {
        path.push({ x: p1.x, y: p2.y + offset });
        path.push({ x: p2.x, y: p2.y + offset });
      }
    }
  }

  path.push(p2);
  path.push(to);
  return simplifyPathPoints(path);
};

export const calculateOrthogonalPath = (
  from: Point,
  to: Point,
  absFromDir?: 'top' | 'right' | 'bottom' | 'left',
  absToDir?: 'top' | 'right' | 'bottom' | 'left',
  arrowId?: string
): Point[] => {
  return getOrthogonalPathPoints(from, to, absFromDir, absToDir, arrowId);
};

export const calculatePath = (
  from: Point,
  to: Point,
  _style: 'straight' | 'curved' | 'dashed',
  fromDir?: 'top' | 'right' | 'bottom' | 'left',
  toDir?: 'top' | 'right' | 'bottom' | 'left',
  fromRotation: number = 0,
  toRotation: number = 0,
  arrowId?: string
) => {
  const absFromDir = getAbsoluteDirection(fromDir, fromRotation);
  const absToDir = getAbsoluteDirection(toDir, toRotation);
  const points = getOrthogonalPathPoints(from, to, absFromDir, absToDir, arrowId);
  return points.reduce((dStr, pt, index) => {
    if (index === 0) return `M ${pt.x} ${pt.y}`;
    const prev = points[index - 1];
    if (prev.x === pt.x && prev.y === pt.y) return dStr;
    return `${dStr} L ${pt.x} ${pt.y}`;
  }, '');
};

export const Wires: React.FC<WiresProps> = ({
  arrows,
  cards,
  selectedId,
  setSelectedId,
  getSocketPosition,
  wireVoltages = {},
  wireCurrents = {},
}) => {
  const maxVoltage = Math.max(
    ...Object.values(wireVoltages).map((v) => Math.abs(v)),
    1e-5
  );

  return (
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
          id="arrowhead-select"
          markerWidth="8"
          markerHeight="7"
          refX="7.5"
          refY="3.5"
          orient="auto"
        >
          <polygon
            points="0 0, 8 3.5, 0 7"
            fill="#f43f5e"
          />
        </marker>
      </defs>
 
      {/* Render established connector lines */}
      {arrows.map((arrow) => (
        <Wire
          key={arrow.id}
          arrow={arrow}
          cards={cards}
          selectedId={selectedId}
          setSelectedId={setSelectedId}
          getSocketPosition={getSocketPosition}
          voltage={wireVoltages[arrow.id]}
          current={wireCurrents[arrow.id]}
          maxVoltage={maxVoltage}
        />
      ))}
    </svg>
  );
};
