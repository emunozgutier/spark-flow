import React from 'react';
import type { CardElement } from '../../../dataTypes/AnotateType';
import { formatEngineering } from '../../../utils/math';

interface NameAndValueProps {
  card: CardElement;
  updateElement: (id: string, updates: Partial<any>, record?: boolean) => void;
  finalizeDrag: () => void;
}

export const NameAndValue: React.FC<NameAndValueProps> = ({
  card,
}) => {
  const isBJT = card.componentType === 'bjt';

  const getFormattedValue = () => {
    if (card.value === undefined) return '';
    const formatted = formatEngineering(card.value);
    switch (card.componentType) {
      case 'resistor': return `${formatted}Ω`;
      case 'capacitor': return `${formatted}F`;
      case 'inductor': return `${formatted}H`;
      case 'voltage':
      case 'acvoltage': return `${formatted}V`;
      case 'current': return `${formatted}A`;
      case 'bjt': return String(card.value ?? 100);
      case 'mosfet': return `${card.value ?? 2.0}V`;
      default: return formatted;
    }
  };

  return (
    <div
      style={isBJT ? {
        position: 'absolute',
        top: '50%',
        left: '52px',
        width: '50px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: '1px',
        pointerEvents: 'none',
        transform: `translateY(-50%) rotate(-${card.rotation || 0}deg)`,
        transformOrigin: '0% 50%'
      } : {
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
      <div
        className="passive-title-display"
        style={{
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-sans)',
          fontWeight: 700,
          fontSize: '11px',
          textAlign: isBJT ? 'left' : 'center',
          width: '100%',
          height: '14px',
          lineHeight: '14px',
          userSelect: 'none',
          pointerEvents: 'none'
        }}
      >
        {`${card.componentType === 'resistor' ? 'R' : card.componentType === 'capacitor' ? 'C' : card.componentType === 'inductor' ? 'L' : card.componentType === 'voltage' ? 'V' : card.componentType === 'acvoltage' ? 'Vac' : card.componentType === 'current' ? 'I' : card.componentType === 'diode' ? 'D' : card.componentType === 'bjt' ? 'Q' : card.componentType === 'mosfet' ? 'M' : 'GND'}${card.instanceNumber || 1}`}
      </div>

      {/* Technical Value */}
      {card.componentType !== 'ground' && card.componentType !== 'diode' && (
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: isBJT ? 'flex-start' : 'center' }}>
          <div
            className="passive-value-display"
            style={{
              color: 'var(--theme-color)',
              fontFamily: 'var(--font-mono)',
              fontWeight: 600,
              fontSize: '10px',
              textAlign: isBJT ? 'left' : 'center',
              width: '100%',
              height: '13px',
              lineHeight: '13px',
              userSelect: 'none',
              pointerEvents: 'none'
            }}
          >
            {getFormattedValue()}
          </div>
          {card.componentType === 'acvoltage' && (
            <div
              className="passive-value-display"
              style={{
                color: 'rgba(255, 255, 255, 0.45)',
                fontFamily: 'var(--font-mono)',
                fontWeight: 500,
                fontSize: '9px',
                textAlign: 'center',
                width: '100%',
                height: '12px',
                lineHeight: '12px',
                marginTop: '1px',
                userSelect: 'none',
                pointerEvents: 'none'
              }}
            >
              {`${formatEngineering(card.frequency ?? 60)}Hz`}
            </div>
          )}
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
