import React from 'react';
import type { ArrowElement, CardElement, Point } from '../../dataTypes/AnotateType';
import { calculatePath, getOrthogonalPathPoints, getAbsoluteDirection } from './Connections';
import { Vertices } from './Wire/Vertices';
import { formatEngineering } from '../../utils/math';

interface WireProps {
  arrow: ArrowElement;
  cards: CardElement[];
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  getSocketPosition: (card: CardElement, socket: 'top' | 'right' | 'bottom' | 'left') => Point;
  current?: number;
  liveDCOn?: boolean;
}

export const Wire: React.FC<WireProps> = ({
  arrow,
  cards,
  selectedId,
  setSelectedId,
  getSocketPosition,
  current,
  liveDCOn
}) => {
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
    arrow.toSocket,
    fromCard?.rotation || 0,
    toCard?.rotation || 0,
    arrow.id
  );

  // Compute absolute path points to identify exact 90-degree turns
  const absFromDir = getAbsoluteDirection(arrow.fromSocket, fromCard?.rotation || 0);
  const absToDir = getAbsoluteDirection(arrow.toSocket, toCard?.rotation || 0);
  const pathPoints = getOrthogonalPathPoints(startPt, endPt, absFromDir, absToDir, arrow.id);

  const corners: Point[] = [];
  for (let i = 1; i < pathPoints.length - 1; i++) {
    const prev = pathPoints[i - 1];
    const curr = pathPoints[i];
    const next = pathPoints[i + 1];
    
    const isPrevHorizontal = prev.y === curr.y;
    const isNextHorizontal = curr.y === next.y;
    
    if (isPrevHorizontal !== isNextHorizontal) {
      corners.push(curr);
    }
  }

  const isSelected = selectedId === arrow.id;
  const strokeColorVal = isSelected ? '#ffffff' : '#64748b';
  const isDashed = arrow.style === 'dashed';

  const midX = (startPt.x + endPt.x) / 2;
  const midY = (startPt.y + endPt.y) / 2;

  const nameText = arrow.label ? `${arrow.netName || ''} (${arrow.label})` : (arrow.netName || '');
  const currentText = (liveDCOn && current !== undefined) ? formatEngineering(current) + 'A' : '';

  const maxLen = Math.max(nameText.length, currentText.length);
  const boxWidth = (maxLen * 6.5) + 12;
  const boxHeight = currentText ? 28 : 16;
  const rectX = midX - boxWidth / 2;
  const rectY = midY - boxHeight / 2;

  return (
    <g
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
      {/* 90-Degree Turn Vertex Markers (only shown when the wire is selected) */}
      <Vertices corners={corners} isSelected={isSelected} strokeColorVal={strokeColorVal} />
      {nameText && (
        <g>
          <rect
            x={rectX}
            y={rectY}
            width={boxWidth}
            height={boxHeight}
            rx="4"
            fill="var(--bg-canvas)"
            stroke={isSelected ? '#ffffff' : 'var(--border-subtle)'}
            strokeWidth="1"
          />
          <text
            x={midX}
            y={rectY + 11}
            fill={isSelected ? '#ffffff' : 'var(--text-secondary)'}
            fontSize="9"
            fontWeight="bold"
            fontFamily="var(--font-sans)"
            textAnchor="middle"
          >
            {nameText}
          </text>
          {currentText && (
            <text
              x={midX}
              y={rectY + 23}
              fill="var(--theme-emerald)"
              fontSize="9"
              fontWeight="bold"
              fontFamily="var(--font-mono)"
              textAnchor="middle"
            >
              {currentText}
            </text>
          )}
        </g>
      )}
    </g>
  );
};
