import React from 'react';
import type { CardElement } from '../../../dataTypes/AnotateType';
import { formatEngineering, parseEngineering, parseInstanceNumber } from '../../../utils/math';

interface NameAndValueProps {
  card: CardElement;
  updateElement: (id: string, updates: Partial<any>, record?: boolean) => void;
  finalizeDrag: () => void;
}

export const NameAndValue: React.FC<NameAndValueProps> = ({
  card,
  updateElement,
  finalizeDrag
}) => {
  return (
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
        value={`${card.componentType === 'resistor' ? 'R' : card.componentType === 'capacitor' ? 'C' : card.componentType === 'inductor' ? 'L' : card.componentType === 'voltage' ? 'V' : card.componentType === 'acvoltage' ? 'Vac' : card.componentType === 'current' ? 'I' : card.componentType === 'diode' ? 'D' : 'GND'}${card.instanceNumber || 1}`}
        onChange={(e) => {
          const prefix = card.componentType === 'resistor' ? 'R' : card.componentType === 'capacitor' ? 'C' : card.componentType === 'inductor' ? 'L' : card.componentType === 'voltage' ? 'V' : card.componentType === 'acvoltage' ? 'Vac' : card.componentType === 'current' ? 'I' : card.componentType === 'diode' ? 'D' : 'GND';
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
      {card.componentType !== 'ground' && card.componentType !== 'diode' && (
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
  );
};
