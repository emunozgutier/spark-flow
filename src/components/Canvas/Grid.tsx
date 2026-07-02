import React from 'react';
import type { Point } from '../../dataTypes/AnotateType';

interface GridProps {
  pan: Point;
  zoom: number;
}

export const Grid: React.FC<GridProps> = ({ pan, zoom }) => {
  // We can make the grid lines fade out when zoomed too far out to prevent aliasing
  const showMinor = zoom > 0.6;
  const showMajor = zoom > 0.15;

  const style: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    backgroundImage: showMinor ? `
      linear-gradient(to right, var(--border-strong) 1.2px, transparent 1.2px),
      linear-gradient(to bottom, var(--border-strong) 1.2px, transparent 1.2px),
      linear-gradient(to right, var(--border-subtle) 1px, transparent 1px),
      linear-gradient(to bottom, var(--border-subtle) 1px, transparent 1px)
    ` : `
      linear-gradient(to right, var(--border-strong) 1.2px, transparent 1.2px),
      linear-gradient(to bottom, var(--border-strong) 1.2px, transparent 1.2px)
    `,
    backgroundSize: showMinor
      ? `${100 * zoom}px ${100 * zoom}px, ${100 * zoom}px ${100 * zoom}px, ${10 * zoom}px ${10 * zoom}px, ${10 * zoom}px ${10 * zoom}px`
      : `${100 * zoom}px ${100 * zoom}px, ${100 * zoom}px ${100 * zoom}px`,
    backgroundPosition: showMinor
      ? `${pan.x - 0.6}px ${pan.y - 0.6}px, ${pan.x - 0.6}px ${pan.y - 0.6}px, ${pan.x - 0.5}px ${pan.y - 0.5}px, ${pan.x - 0.5}px ${pan.y - 0.5}px`
      : `${pan.x - 0.6}px ${pan.y - 0.6}px, ${pan.x - 0.6}px ${pan.y - 0.6}px`,
    opacity: showMajor ? Math.min(1.0, (zoom - 0.1) * 3) : 0,
    transition: 'opacity 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
  };

  return <div className="canvas-grid" style={style} />;
};
