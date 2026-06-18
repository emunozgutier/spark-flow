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
  const isTextOnly = card.componentType === 'text';

  return (
    <div
      className={`canvas-card ${isSelected ? 'selected' : ''} ${isTextOnly ? 'text-only-annotation' : ''}`}
      style={{
        left: `${card.x}px`,
        top: `${card.y}px`,
        width: `${card.width}px`,
        height: `${card.height}px`,
        zIndex: isSelected ? 99 : 5,
        '--theme-color': isTextOnly ? 'rgba(255, 255, 255, 0.15)' : `var(--theme-${card.color})`,
        '--theme-color-glow': isTextOnly ? 'transparent' : `var(--theme-${card.color}-glow)`
      } as React.CSSProperties}
      onMouseDown={(e) => initiateCardDrag(card, e)}
    >
      {!isTextOnly && (
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
            <input
              type="text"
              className="card-title-input"
              value={card.title || ''}
              onChange={(e) => updateElement(card.id, { title: e.target.value }, false)}
              onBlur={finalizeDrag}
              placeholder="Component Title"
            />
          </div>
        </div>
      )}

      <div className="card-body" style={isTextOnly ? { height: '100%', padding: '0px' } : undefined}>
        <textarea
          className="card-textarea"
          value={card.content || ''}
          onChange={(e) => updateElement(card.id, { content: e.target.value }, false)}
          onBlur={finalizeDrag}
          placeholder={isTextOnly ? "Type text..." : "Describe your thoughts..."}
          style={isTextOnly ? {
            background: 'transparent',
            border: 'none',
            outline: 'none',
            boxShadow: 'none',
            fontSize: '13px',
            color: 'var(--text-primary)',
            resize: 'none'
          } : undefined}
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
