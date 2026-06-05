import React from 'react';
import type { CardElement, ToolType } from '../../../dataTypes/AnotateType';

interface JoinProps {
  card: CardElement;
  isSelected: boolean;
  activeTool: ToolType;
  initiateCardDrag: (card: CardElement, e: React.MouseEvent) => void;
  initiateArrowDraw: (card: CardElement, socketDir: 'top' | 'right' | 'bottom' | 'left', e: React.MouseEvent) => void;
}

export const Join: React.FC<JoinProps> = ({
  card,
  isSelected,
  activeTool,
  initiateCardDrag,
  initiateArrowDraw
}) => {
  const junctionStyles = `
    .junction-dot-card {
      user-select: none;
      transition: transform 0.15s ease-out;
    }
    .junction-dot-card:hover {
      transform: scale(1.2);
    }
    .junction-dot-card circle {
      r: 3.5px;
      fill: var(--bg-canvas) !important;
      stroke: var(--theme-${card.color}) !important;
      stroke-width: 2px !important;
      transition: r 0.15s, stroke 0.15s, stroke-width 0.15s;
    }
    .junction-dot-card.selected circle {
      r: 4.5px !important;
      fill: var(--bg-canvas) !important;
      stroke: #ffffff !important;
      stroke-width: 2.5px !important;
      filter: drop-shadow(0 0 4px rgba(255, 255, 255, 0.6));
    }
    /* Make the 4 routing sockets completely invisible while preserving full interactivity */
    .junction-dot-card .card-socket {
      background: transparent !important;
      border: none !important;
      box-shadow: none !important;
      transform: none !important;
    }
    .junction-dot-card .card-socket:hover {
      background: transparent !important;
      transform: none !important;
    }
  `;

  return (
    <div
      className={`junction-dot-card ${isSelected ? 'selected' : ''}`}
      style={{
        position: 'absolute',
        left: `${card.x}px`,
        top: `${card.y}px`,
        width: `${card.width}px`,
        height: `${card.height}px`,
        zIndex: isSelected ? 99 : 5,
        background: 'none',
        border: 'none',
        boxShadow: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'auto',
        cursor: 'pointer'
      }}
      onMouseDown={(e) => initiateCardDrag(card, e)}
    >
      <style>{junctionStyles}</style>
      {/* Hollow, vertex-like circular junction dot */}
      <svg width="100%" height="100%" viewBox="0 0 16 16" style={{ overflow: 'visible' }}>
        <circle cx="8" cy="8" />
        {card.jointNumber && (
          <text
            x="16"
            y="12"
            fill="var(--theme-amber)"
            fontSize="9px"
            fontWeight="bold"
            fontFamily="monospace"
            style={{
              textShadow: '0 0 4px rgba(0,0,0,0.8)',
              pointerEvents: 'none',
              userSelect: 'none'
            }}
          >
            {card.jointNumber}
          </text>
        )}
      </svg>

      {/* Junction sockets - invisible or tiny lead-out rings that appear on hover! */}
      {(activeTool === 'select' || activeTool === 'arrow' || activeTool === 'hand') && (
        <>
          <div
            className="card-socket top"
            data-card-id={card.id}
            data-socket-dir="top"
            onMouseDown={(e) => initiateArrowDraw(card, 'top', e)}
            style={{ top: '-4px', left: '4px', width: '8px', height: '8px', borderRadius: '50%' }}
          />
          <div
            className="card-socket right"
            data-card-id={card.id}
            data-socket-dir="right"
            onMouseDown={(e) => initiateArrowDraw(card, 'right', e)}
            style={{ top: '4px', right: '-4px', width: '8px', height: '8px', borderRadius: '50%' }}
          />
          <div
            className="card-socket bottom"
            data-card-id={card.id}
            data-socket-dir="bottom"
            onMouseDown={(e) => initiateArrowDraw(card, 'bottom', e)}
            style={{ bottom: '-4px', left: '4px', width: '8px', height: '8px', borderRadius: '50%' }}
          />
          <div
            className="card-socket left"
            data-card-id={card.id}
            data-socket-dir="left"
            onMouseDown={(e) => initiateArrowDraw(card, 'left', e)}
            style={{ top: '4px', left: '-4px', width: '8px', height: '8px', borderRadius: '50%' }}
          />
        </>
      )}
    </div>
  );
};
