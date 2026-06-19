import React from 'react';
import type { ArrowElement, Point, CardElement } from '../../../dataTypes/AnotateType';
import { calculatePath, getOrthogonalPathPoints, getAbsoluteDirection } from '../Wires';
import { Vertices } from './Vertices';
import { useCanvas } from '../../../store/useCanvas';
import { useEditMode } from '../../../store/useEditMode';
import { formatEngineering } from '../../../utils/math';

interface WireProps {
  arrow: ArrowElement;
  cards: CardElement[];
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  getSocketPosition: (card: CardElement, socket: 'top' | 'right' | 'bottom' | 'left') => Point;
  voltage?: number;
  current?: number;
  maxVoltage?: number;
}

const getPathMidpoint = (points: Point[]): Point => {
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1) return points[0];
  
  let totalLength = 0;
  const segments = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    totalLength += len;
    segments.push({ p1, p2, len });
  }

  let targetLen = totalLength / 2;
  for (const seg of segments) {
    if (targetLen <= seg.len) {
      if (seg.len === 0) return seg.p1;
      const ratio = targetLen / seg.len;
      return {
        x: seg.p1.x + (seg.p2.x - seg.p1.x) * ratio,
        y: seg.p1.y + (seg.p2.y - seg.p1.y) * ratio
      };
    }
    targetLen -= seg.len;
  }
  return points[points.length - 1];
};

export const Wire: React.FC<WireProps> = ({
  arrow,
  cards,
  selectedId,
  setSelectedId,
  getSocketPosition,
  voltage,
  current,
  maxVoltage,
}) => {
  const { liveDCOn, showCurrentProbes, deleteElement } = useCanvas();
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
  let strokeColorVal = isSelected ? '#ffffff' : '#64748b';

  if (!isSelected && liveDCOn && voltage !== undefined && maxVoltage !== undefined) {
    const ratio = Math.min(Math.abs(voltage) / maxVoltage, 1.0);
    const pct = Math.round(35 + Math.sqrt(ratio) * 65);
    if (voltage > 1e-5) {
      strokeColorVal = `color-mix(in srgb, var(--theme-emerald) ${pct}%, var(--theme-slate))`;
    } else if (voltage < -1e-5) {
      strokeColorVal = `color-mix(in srgb, var(--theme-coral) ${pct}%, var(--theme-slate))`;
    } else {
      strokeColorVal = 'var(--theme-slate)';
    }
  }

  const isDashed = arrow.style === 'dashed';

  const midPt = getPathMidpoint(pathPoints);
  const showI = liveDCOn && showCurrentProbes && current !== undefined;
  const hasLabel = !!arrow.label;

  const activeItems: ('label' | 'curr')[] = [];
  if (hasLabel) activeItems.push('label');
  if (showI) activeItems.push('curr');

  const getOffset = (type: 'label' | 'curr'): number => {
    const idx = activeItems.indexOf(type);
    if (idx === -1) return 0;
    if (activeItems.length === 1) return 0;
    // activeItems.length === 2
    return idx === 0 ? -10 : 10;
  };

  const labelY = midPt.y + getOffset('label');
  const currY = midPt.y + getOffset('curr');

  const { editMode } = useEditMode();

  return (
    <g
      className="deletable-wire"
      style={{ pointerEvents: 'auto', cursor: 'pointer' }}
      onClick={(e) => {
        e.stopPropagation();
        if (editMode === 'delete') {
          deleteElement(arrow.id);
        } else {
          setSelectedId(arrow.id);
        }
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
      
      {/* Custom Text Label */}
      {arrow.label && (
        <g>
          <rect
            x={midPt.x - (arrow.label.length * 3.8) - 6}
            y={labelY - 8}
            width={(arrow.label.length * 7.6) + 12}
            height="16"
            rx="4"
            fill="var(--bg-canvas)"
            stroke={isSelected ? '#ffffff' : 'var(--border-subtle)'}
            strokeWidth="1"
          />
          <text
            x={midPt.x}
            y={labelY + 4}
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

      {/* Current Probe Badge */}
      {showI && (
        <g>
          {(() => {
            const currText = formatEngineering(current) + 'A';
            const pW = (currText.length * 6.0) + 14;

            return (
              <>
                <rect
                  x={midPt.x - pW / 2}
                  y={currY - 8}
                  width={pW}
                  height="16"
                  rx="8"
                  fill="#090a0f"
                  stroke="var(--theme-amber)"
                  strokeWidth="1.5"
                  style={{
                    filter: 'drop-shadow(0 0 3px var(--theme-amber-glow))',
                    transition: 'stroke 0.2s'
                  }}
                />
                <text
                  x={midPt.x}
                  y={currY + 4}
                  fill="#ffffff"
                  fontSize="9"
                  fontWeight="bold"
                  fontFamily="var(--font-mono)"
                  textAnchor="middle"
                >
                  {currText}
                </text>
              </>
            );
          })()}
        </g>
      )}
    </g>
  );
};
