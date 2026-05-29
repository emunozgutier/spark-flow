import React from 'react';
import type { ArrowElement, CardElement, DrawingArrowState, Point } from '../../dataTypes/AnotateType';
import { Wire } from './Wire';

interface ConnectionsProps {
  arrows: ArrowElement[];
  cards: CardElement[];
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  drawingArrow: DrawingArrowState | null;
  getSocketPosition: (card: CardElement, socket: 'top' | 'right' | 'bottom' | 'left') => Point;
}

const COLOR_THEMES = [
  { name: 'slate', value: '#64748b' },
  { name: 'amethyst', value: '#a855f7' },
  { name: 'sapphire', value: '#3b82f6' },
  { name: 'emerald', value: '#10b981' },
  { name: 'coral', value: '#f43f5e' },
  { name: 'amber', value: '#f59e0b' },
];

export const calculatePath = (
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

export const Connections: React.FC<ConnectionsProps> = ({
  arrows,
  cards,
  selectedId,
  setSelectedId,
  drawingArrow,
  getSocketPosition
}) => {
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
        />
      ))}

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
  );
};
