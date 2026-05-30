import React from 'react';
import type { Point } from '../../../dataTypes/AnotateType';

interface VerticesProps {
  corners: Point[];
  isSelected: boolean;
  strokeColorVal: string;
}

export const Vertices: React.FC<VerticesProps> = ({
  corners,
  isSelected,
  strokeColorVal
}) => {
  if (!isSelected) return null;

  return (
    <>
      {corners.map((corner, idx) => (
        <circle
          key={`corner-${idx}`}
          cx={corner.x}
          cy={corner.y}
          r="3"
          fill="var(--bg-canvas)"
          stroke={strokeColorVal}
          strokeWidth="2.5"
          style={{ transition: 'stroke 0.15s, stroke-width 0.15s' }}
        />
      ))}
    </>
  );
};
