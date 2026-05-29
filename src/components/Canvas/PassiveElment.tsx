import React from 'react';
import type { CardElement, ArrowElement, ToolType } from '../../dataTypes/AnotateType';

// Engineering notation and designator helpers
const formatEngineering = (val: number | undefined): string => {
  if (val === undefined || isNaN(val)) return '';
  if (val === 0) return '0';
  
  const absVal = Math.abs(val);
  const prefixes = [
    { value: 1e9, symbol: 'G' },
    { value: 1e6, symbol: 'M' },
    { value: 1e3, symbol: 'k' },
    { value: 1, symbol: '' },
    { value: 1e-3, symbol: 'm' },
    { value: 1e-6, symbol: 'u' },
    { value: 1e-9, symbol: 'n' },
    { value: 1e-12, symbol: 'p' },
    { value: 1e-15, symbol: 'f' }
  ];

  for (let i = 0; i < prefixes.length; i++) {
    const p = prefixes[i];
    if (absVal >= p.value) {
      const num = val / p.value;
      const formattedNum = parseFloat(num.toFixed(3));
      return `${formattedNum}${p.symbol}`;
    }
  }
  
  return val.toExponential(2);
};

const parseEngineering = (str: string): number => {
  const trimmed = str.trim();
  if (!trimmed) return 0;
  
  const match = trimmed.match(/^([+-]?\d*(?:\.\d+)?)\s*([a-zA-Zµ]?)$/);
  if (!match) return parseFloat(trimmed) || 0;
  
  const [_, numStr, suffix] = match;
  const num = parseFloat(numStr);
  if (isNaN(num)) return 0;
  
  switch (suffix) {
    case 'f': return num * 1e-15;
    case 'p': return num * 1e-12;
    case 'n': return num * 1e-9;
    case 'u':
    case 'µ': return num * 1e-6;
    case 'm': return num * 1e-3;
    case 'k': return num * 1e3;
    case 'M': return num * 1e6;
    case 'G': return num * 1e9;
    default: return num;
  }
};

const parseInstanceNumber = (str: string, prefixChar: string): number => {
  const numStr = str.replace(new RegExp(`^${prefixChar}`, 'i'), '').trim();
  const parsed = parseInt(numStr, 10);
  return isNaN(parsed) ? 1 : parsed;
};

interface PassiveElmentProps {
  card: CardElement;
  isSelected: boolean;
  activeTool: ToolType;
  arrows: ArrowElement[];
  initiateCardDrag: (card: CardElement, e: React.MouseEvent) => void;
  initiateArrowDraw: (card: CardElement, socketDir: 'top' | 'right' | 'bottom' | 'left', e: React.MouseEvent) => void;
  updateElement: (id: string, updates: Partial<any>, record?: boolean) => void;
  finalizeDrag: () => void;
}

export const PassiveElment: React.FC<PassiveElmentProps> = ({
  card,
  isSelected,
  activeTool,
  arrows,
  initiateCardDrag,
  initiateArrowDraw,
  updateElement,
  finalizeDrag
}) => {
  return (
    <div
      className={`canvas-card passive-component ${isSelected ? 'selected' : ''}`}
      style={{
        left: `${card.x}px`,
        top: `${card.y}px`,
        width: `${card.width}px`,
        height: `${card.height}px`,
        zIndex: isSelected ? 99 : 5,
        transform: `rotate(${card.rotation || 0}deg)`,
        '--theme-color': `var(--theme-${card.color})`,
        '--theme-color-glow': `var(--theme-${card.color}-glow)`
      } as React.CSSProperties}
      onMouseDown={(e) => initiateCardDrag(card, e)}
    >
      {/* Schematic SVG */}
      {card.componentType === 'resistor' && (
        <svg width="100%" height="30" viewBox="0 0 100 30" fill="none" stroke="var(--theme-color)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', filter: 'drop-shadow(0 0 4px var(--theme-color-glow))' }}>
          <path d="M 0 15 L 20 15 L 25 5 L 35 25 L 45 5 L 55 25 L 65 5 L 75 25 L 80 15 L 100 15" />
        </svg>
      )}
      {card.componentType === 'capacitor' && (
        <svg width="100%" height="40" viewBox="0 0 100 40" fill="none" stroke="var(--theme-color)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', filter: 'drop-shadow(0 0 4px var(--theme-color-glow))' }}>
          <path d="M 0 20 L 43 20 M 57 20 L 100 20" />
          <path d="M 43 5 L 43 35 M 57 5 L 57 35" />
        </svg>
      )}
      {card.componentType === 'inductor' && (
        <svg width="100%" height="30" viewBox="0 0 100 30" fill="none" stroke="var(--theme-color)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', filter: 'drop-shadow(0 0 4px var(--theme-color-glow))' }}>
          <path d="M 0 15 L 20 15 C 20 5, 32 5, 32 15 C 32 5, 44 5, 44 15 C 44 5, 56 5, 56 15 C 56 5, 68 5, 68 15 C 68 5, 80 5, 80 15 L 100 15" />
        </svg>
      )}
      {card.componentType === 'ground' && (
        <svg width="100%" height="100%" viewBox="0 0 60 60" fill="none" stroke="var(--theme-color)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', top: 0, left: 0, filter: 'drop-shadow(0 0 4px var(--theme-color-glow))' }}>
          <path d="M 30 0 L 30 25" />
          <path d="M 20 25 L 40 25" />
          <path d="M 24 33 L 36 33" />
          <path d="M 28 41 L 32 41" />
        </svg>
      )}

      {/* Vertically Stacked Component Labels at the bottom */}
      <div
        style={{
          position: 'absolute',
          bottom: '4px',
          left: 0,
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1px',
          pointerEvents: 'none',
          transform: `rotate(-${card.rotation || 0}deg)`,
          transformOrigin: '50% 50%'
        }}
      >
        {/* Designator (Name) */}
        <input
          type="text"
          className="passive-title-input"
          value={`${card.componentType === 'resistor' ? 'R' : card.componentType === 'capacitor' ? 'C' : card.componentType === 'inductor' ? 'L' : 'GND'}${card.instanceNumber || 1}`}
          onChange={(e) => {
            const prefix = card.componentType === 'resistor' ? 'R' : card.componentType === 'capacitor' ? 'C' : card.componentType === 'inductor' ? 'L' : 'GND';
            const num = parseInstanceNumber(e.target.value, prefix);
            updateElement(card.id, { instanceNumber: num }, false);
          }}
          onBlur={finalizeDrag}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-sans)',
            fontWeight: 700,
            fontSize: '11px',
            textAlign: 'center',
            outline: 'none',
            width: '100%',
            pointerEvents: 'auto',
            height: '14px',
            lineHeight: '14px'
          }}
          placeholder="Name"
        />

        {/* Technical Value */}
        {card.componentType !== 'ground' && (
          <input
            type="text"
            className="passive-value-input"
            value={formatEngineering(card.value)}
            onChange={(e) => {
              const num = parseEngineering(e.target.value);
              updateElement(card.id, { value: num }, false);
            }}
            onBlur={finalizeDrag}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--theme-color)',
              fontFamily: 'var(--font-mono)',
              fontWeight: 600,
              fontSize: '10px',
              textAlign: 'center',
              outline: 'none',
              width: '100%',
              pointerEvents: 'auto',
              height: '13px',
              lineHeight: '13px'
            }}
            placeholder="Value"
          />
        )}
      </div>

      {/* Sockets for Wire connections */}
      {(activeTool === 'select' || activeTool === 'arrow' || activeTool === 'hand') && (
        <>
          {card.componentType === 'ground' ? (
            /* Top Lead Port for Ground */
            <div
              className={`card-socket top ${
                !arrows.some(
                  (arrow) =>
                    (arrow.fromId === card.id && arrow.fromSocket === 'top') ||
                    (arrow.toId === card.id && arrow.toSocket === 'top')
                )
                  ? 'open-port'
                  : ''
              }`}
              data-card-id={card.id}
              data-socket-dir="top"
              onMouseDown={(e) => initiateArrowDraw(card, 'top', e)}
            />
          ) : (
            <>
              {/* Left Lead Port */}
              <div
                className={`card-socket left ${
                  !arrows.some(
                    (arrow) =>
                      (arrow.fromId === card.id && arrow.fromSocket === 'left') ||
                      (arrow.toId === card.id && arrow.toSocket === 'left')
                  )
                    ? 'open-port'
                    : ''
                }`}
                data-card-id={card.id}
                data-socket-dir="left"
                onMouseDown={(e) => initiateArrowDraw(card, 'left', e)}
              />

              {/* Right Lead Port */}
              <div
                className={`card-socket right ${
                  !arrows.some(
                    (arrow) =>
                      (arrow.fromId === card.id && arrow.fromSocket === 'right') ||
                      (arrow.toId === card.id && arrow.toSocket === 'right')
                  )
                    ? 'open-port'
                    : ''
                }`}
                data-card-id={card.id}
                data-socket-dir="right"
                onMouseDown={(e) => initiateArrowDraw(card, 'right', e)}
              />
            </>
          )}
        </>
      )}
    </div>
  );
};
