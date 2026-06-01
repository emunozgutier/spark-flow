import React from 'react';
import type { CardElement, ArrowElement, ToolType } from '../../dataTypes/AnotateType';
import { formatEngineering, parseEngineering, parseInstanceNumber } from '../../utils/math';

interface PassiveElmentProps {
  card: CardElement;
  isSelected: boolean;
  activeTool: ToolType;
  arrows: ArrowElement[];
  initiateCardDrag: (card: CardElement, e: React.MouseEvent) => void;
  initiateArrowDraw: (card: CardElement, socketDir: 'top' | 'right' | 'bottom' | 'left', e: React.MouseEvent) => void;
  updateElement: (id: string, updates: Partial<any>, record?: boolean) => void;
  finalizeDrag: () => void;
  liveDCOn?: boolean;
  dcStats?: { voltageDrop: number; branchCurrent: number };
}

export const PassiveElment: React.FC<PassiveElmentProps> = ({
  card,
  isSelected,
  activeTool,
  arrows,
  initiateCardDrag,
  initiateArrowDraw,
  updateElement,
  finalizeDrag,
  liveDCOn,
  dcStats
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
        <svg width="100%" height="30" viewBox="0 0 100 30" fill="none" stroke="var(--theme-color)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', top: '5px', left: 0, filter: 'drop-shadow(0 0 4px var(--theme-color-glow))' }}>
          <path d="M 0 15 L 20 15 L 25 5 L 35 25 L 45 5 L 55 25 L 65 5 L 75 25 L 80 15 L 100 15" />
        </svg>
      )}
      {card.componentType === 'capacitor' && (
        <svg width="100%" height="30" viewBox="0 0 100 40" fill="none" stroke="var(--theme-color)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', top: '5px', left: 0, filter: 'drop-shadow(0 0 4px var(--theme-color-glow))' }}>
          <path d="M 0 20 L 43 20 M 57 20 L 100 20" />
          <path d="M 43 5 L 43 35 M 57 5 L 57 35" />
        </svg>
      )}
      {card.componentType === 'inductor' && (
        <svg width="100%" height="30" viewBox="0 0 100 30" fill="none" stroke="var(--theme-color)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', top: '5px', left: 0, filter: 'drop-shadow(0 0 4px var(--theme-color-glow))' }}>
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
      {card.componentType === 'voltage' && (
        <svg width="100%" height="30" viewBox="0 0 100 40" fill="none" stroke="var(--theme-color)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', top: '5px', left: 0, filter: 'drop-shadow(0 0 4px var(--theme-color-glow))' }}>
          <path d="M 0 20 L 35 20 M 65 20 L 100 20" />
          <circle cx="50" cy="20" r="15" />
          <path d="M 40 20 H 46 M 43 17 V 23" strokeWidth="2.5" />
          <path d="M 54 20 H 60" strokeWidth="2.5" />
        </svg>
      )}
      {card.componentType === 'current' && (
        <svg width="100%" height="30" viewBox="0 0 100 40" fill="none" stroke="var(--theme-color)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', top: '5px', left: 0, filter: 'drop-shadow(0 0 4px var(--theme-color-glow))' }}>
          <path d="M 0 20 L 35 20 M 65 20 L 100 20" />
          <circle cx="50" cy="20" r="15" />
          <path d="M 42 20 H 58" strokeWidth="2.5" />
          <path d="M 52 15 L 58 20 L 52 25" strokeWidth="2.5" strokeLinejoin="miter" />
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
          value={`${card.componentType === 'resistor' ? 'R' : card.componentType === 'capacitor' ? 'C' : card.componentType === 'inductor' ? 'L' : card.componentType === 'voltage' ? 'V' : card.componentType === 'current' ? 'I' : 'GND'}${card.instanceNumber || 1}`}
          onChange={(e) => {
            const prefix = card.componentType === 'resistor' ? 'R' : card.componentType === 'capacitor' ? 'C' : card.componentType === 'inductor' ? 'L' : card.componentType === 'voltage' ? 'V' : card.componentType === 'current' ? 'I' : 'GND';
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
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
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
            {card.componentType === 'resistor' && card.isGroup2 && (
              <span style={{ fontSize: '8px', fontWeight: 'bold', color: 'var(--theme-sapphire)', textShadow: '0 0 3px var(--theme-sapphire-glow)', marginTop: '2px', textTransform: 'uppercase' }}>
                MNA G2
              </span>
            )}
          </div>
        )}
      </div>

      {liveDCOn && dcStats && card.componentType !== 'ground' && (
        <div
          style={{
            position: 'absolute',
            top: '-24px',
            left: 0,
            width: '100%',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            pointerEvents: 'none',
            transform: `rotate(-${card.rotation || 0}deg)`,
            transformOrigin: '50% 50%',
            zIndex: 10
          }}
        >
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.88)',
              border: '1.2px solid var(--theme-color)',
              boxShadow: '0 4px 10px rgba(0, 0, 0, 0.4), 0 0 6px var(--theme-color-glow)',
              borderRadius: '5px',
              padding: '1.5px 5px',
              display: 'flex',
              gap: '4px',
              fontSize: '8px',
              fontFamily: 'monospace',
              fontWeight: 'bold',
              whiteSpace: 'nowrap',
              color: '#ffffff'
            }}
          >
            <span>
              V: <span style={{ color: 'var(--theme-amber)' }}>{formatEngineering(dcStats.voltageDrop)}V</span>
            </span>
            <span style={{ color: 'var(--theme-color)', opacity: 0.35 }}>|</span>
            <span>
              I: <span style={{ color: 'var(--theme-emerald)' }}>{formatEngineering(dcStats.branchCurrent)}A</span>
            </span>
          </div>
        </div>
      )}

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
                style={{ top: '20px' }}
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
                style={{ top: '20px' }}
              />
            </>
          )}
        </>
      )}
    </div>
  );
};
