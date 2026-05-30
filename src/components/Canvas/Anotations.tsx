import React from 'react';
import type { CardElement, ToolType } from '../../dataTypes/AnotateType';

interface AnotationsProps {
  card: CardElement;
  isSelected: boolean;
  activeTool: ToolType;
  initiateCardDrag: (card: CardElement, e: React.MouseEvent) => void;
  initiateCardResize: (card: CardElement, e: React.MouseEvent) => void;
  initiateArrowDraw: (card: CardElement, socketDir: 'top' | 'right' | 'bottom' | 'left', e: React.MouseEvent) => void;
  updateElement: (id: string, updates: Partial<any>, record?: boolean) => void;
  finalizeDrag: () => void;
}

export const Anotations: React.FC<AnotationsProps> = ({
  card,
  isSelected,
  activeTool,
  initiateCardDrag,
  initiateCardResize,
  initiateArrowDraw,
  updateElement,
  finalizeDrag
}) => {
  const junctionStyles = `
    .junction-dot-card {
      user-select: none;
      transition: transform 0.15s ease-out;
    }
    .junction-dot-card:hover {
      transform: scale(1.2);
    }
    .junction-dot-card.selected circle {
      r: 6px !important;
      fill: #ffffff !important;
      stroke: var(--theme-coral) !important;
      stroke-width: 2px !important;
      filter: drop-shadow(0 0 6px var(--theme-coral));
    }
  `;

  if (card.id.startsWith('join') || card.title === 'join') {
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
        {/* Solid Circular Junction Dot */}
        <svg width="100%" height="100%" viewBox="0 0 16 16" style={{ overflow: 'visible' }}>
          <circle
            cx="8"
            cy="8"
            r={isSelected ? 6.0 : 4.5}
            fill={isSelected ? '#ffffff' : '#f43f5e'}
            stroke={isSelected ? 'var(--theme-coral)' : 'none'}
            strokeWidth="1.5"
            style={{ transition: 'r 0.15s, fill 0.15s' }}
          />
        </svg>

        {/* Junction sockets - invisible or tiny lead-out rings that appear on hover! */}
        {(activeTool === 'select' || activeTool === 'arrow' || activeTool === 'hand') && (
          <>
            <div
              className="card-socket top"
              data-card-id={card.id}
              data-socket-dir="top"
              onMouseDown={(e) => initiateArrowDraw(card, 'top', e)}
              style={{ top: '-4px', left: '4px', width: '8px', height: '8px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
            />
            <div
              className="card-socket right"
              data-card-id={card.id}
              data-socket-dir="right"
              onMouseDown={(e) => initiateArrowDraw(card, 'right', e)}
              style={{ top: '4px', right: '-4px', width: '8px', height: '8px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
            />
            <div
              className="card-socket bottom"
              data-card-id={card.id}
              data-socket-dir="bottom"
              onMouseDown={(e) => initiateArrowDraw(card, 'bottom', e)}
              style={{ bottom: '-4px', left: '4px', width: '8px', height: '8px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
            />
            <div
              className="card-socket left"
              data-card-id={card.id}
              data-socket-dir="left"
              onMouseDown={(e) => initiateArrowDraw(card, 'left', e)}
              style={{ top: '4px', left: '-4px', width: '8px', height: '8px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
            />
          </>
        )}
      </div>
    );
  }

  return (
    <div
      className={`canvas-card ${isSelected ? 'selected' : ''}`}
      style={{
        left: `${card.x}px`,
        top: `${card.y}px`,
        width: `${card.width}px`,
        height: `${card.height}px`,
        zIndex: isSelected ? 99 : 5,
        '--theme-color': `var(--theme-${card.color})`,
        '--theme-color-glow': `var(--theme-${card.color}-glow)`
      } as React.CSSProperties}
      onMouseDown={(e) => initiateCardDrag(card, e)}
    >
      <div className="card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
          <input
            type="text"
            className="card-title-input"
            value={card.title}
            onChange={(e) => updateElement(card.id, { title: e.target.value }, false)}
            onBlur={finalizeDrag}
            placeholder="Component Title"
          />
        </div>
      </div>

      <div className="card-body">
        <textarea
          className="card-textarea"
          value={card.content}
          onChange={(e) => updateElement(card.id, { content: e.target.value }, false)}
          onBlur={finalizeDrag}
          placeholder="Describe your thoughts..."
        />
      </div>

      {(activeTool === 'select' || activeTool === 'arrow' || activeTool === 'hand') && (
        <>
          <div
            className="card-socket top"
            data-card-id={card.id}
            data-socket-dir="top"
            onMouseDown={(e) => initiateArrowDraw(card, 'top', e)}
          />
          <div
            className="card-socket right"
            data-card-id={card.id}
            data-socket-dir="right"
            onMouseDown={(e) => initiateArrowDraw(card, 'right', e)}
          />
          <div
            className="card-socket bottom"
            data-card-id={card.id}
            data-socket-dir="bottom"
            onMouseDown={(e) => initiateArrowDraw(card, 'bottom', e)}
          />
          <div
            className="card-socket left"
            data-card-id={card.id}
            data-socket-dir="left"
            onMouseDown={(e) => initiateArrowDraw(card, 'left', e)}
          />
        </>
      )}

      {activeTool === 'select' && (
        <div
          className="card-resize-handle"
          onMouseDown={(e) => initiateCardResize(card, e)}
        />
      )}
    </div>
  );
};
