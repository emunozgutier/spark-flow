import React from 'react';
import type { ArrowElement, CardElement, DrawingArrowState, Point } from '../../dataTypes/AnotateType';
import { Wire } from './Wire/WirePath';

interface WiresProps {
  arrows: ArrowElement[];
  cards: CardElement[];
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  drawingArrow: DrawingArrowState | null;
  getSocketPosition: (card: CardElement, socket: 'top' | 'right' | 'bottom' | 'left') => Point;
  activeSnap?: { wire: ArrowElement; point: Point } | null;
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
  
  // 1. Determine the actual lead-out point
  let p1 = { ...from };
  if (absFromDir === 'left') p1.x -= minSegment;
  else if (absFromDir === 'right') p1.x += minSegment;
  else if (absFromDir === 'top') p1.y -= minSegment;
  else if (absFromDir === 'bottom') p1.y += minSegment;
  else {
    p1.x += (to.x > from.x ? minSegment : -minSegment);
  }

  // 2. Determine the actual lead-in point
  let p2 = { ...to };
  if (absToDir === 'left') p2.x -= minSegment;
  else if (absToDir === 'right') p2.x += minSegment;
  else if (absToDir === 'top') p2.y -= minSegment;
  else if (absToDir === 'bottom') p2.y += minSegment;
  else {
    p2.x += (to.x > from.x ? -minSegment : minSegment);
  }

  // 3. Connect p1 and p2 using orthogonal steps
  const path: Point[] = [from, p1];

  const isP1ExitHorizontal = absFromDir === 'left' || absFromDir === 'right';
  const isP2EntryHorizontal = absToDir === 'left' || absToDir === 'right';

  if (isP1ExitHorizontal) {
    if (isP2EntryHorizontal) {
      // Both horizontal (left/right)
      let trunkX = (p1.x + p2.x) / 2 + offset;
      if (absFromDir === absToDir) {
        if (absFromDir === 'right') {
          trunkX = p1.x > p2.x ? p1.x : p2.x;
        } else if (absFromDir === 'left') {
          trunkX = p1.x < p2.x ? p1.x : p2.x;
        }
      }
      path.push({ x: trunkX, y: p1.y });
      path.push({ x: trunkX, y: p2.y });
    } else {
      // Exit is horizontal, Entry is vertical
      const needsUturn = (absFromDir === 'right' && p2.x < from.x) || (absFromDir === 'left' && p2.x > from.x);
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
      if (absFromDir === absToDir) {
        if (absFromDir === 'bottom') {
          trunkY = p1.y > p2.y ? p1.y : p2.y;
        } else if (absFromDir === 'top') {
          trunkY = p1.y < p2.y ? p1.y : p2.y;
        }
      }
      path.push({ x: p1.x, y: trunkY });
      path.push({ x: p2.x, y: trunkY });
    } else {
      // Exit is vertical, Entry is horizontal
      const needsUturn = (absFromDir === 'bottom' && p2.y < from.y) || (absFromDir === 'top' && p2.y > from.y);
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
  drawingArrow,
  getSocketPosition,
  activeSnap,
  wireVoltages = {},
  wireCurrents = {},
}) => {
  const sourceCard = drawingArrow ? cards.find((c) => c.id === drawingArrow.fromId) : undefined;

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
 
      {/* Render temporary live connector line preview when dragging socket */}
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
 
      {/* Render temporary live snap join indicator */}
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
  );
};
