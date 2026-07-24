import React, { useState } from 'react';
import type { CanvasElement } from '../../dataTypes/AnotateType';
import { deserializeElements } from '../../url';
import { useTopBar } from '../../store/useTopBar';

interface ExamplesBarProps {
  loadElements: (elements: CanvasElement[]) => void;
  setToast?: (toast: { message: string; type: 'success' | 'info' } | null) => void;
}

interface CircuitExample {
  id: string;
  name: string;
  category: string;
  description: string;
  netlist: string;
}

const CIRCUIT_EXAMPLES: CircuitExample[] = [
  {
    id: 'voltage-divider',
    name: '🔌 Simple Voltage Divider',
    category: 'Linear MNA',
    description: '5V source across 1k and 2k series resistors',
    netlist: `GND1.130.250~V1.250.50.90.5.sapphire~R1.130.50.90.1000.amber~R2.130.150.90.2000.amber~W.V1.l.R1.l.sapphire~W.R1.r.R2.l.amber~W.R2.r.GND1.t.amethyst~W.V1.r.GND1.t.amethyst`
  },
  {
    id: 'diode-clipper',
    name: '💡 Diode Clipper Network',
    category: 'Non-linear MNA',
    description: 'AC voltage source with resistor and diode clipper',
    netlist: `GND1.130.250~Vac1.120.120.90.5.60.sapphire~R1.210.80.90.1000.amber~D1.210.150.90.amber~W.Vac1.l.R1.l.sapphire~W.R1.r.D1.l.amber~W.D1.r.GND1.t.amethyst~W.Vac1.r.GND1.t.amethyst`
  }
];

export const ExamplesBar: React.FC<ExamplesBarProps> = ({ loadElements, setToast }) => {
  const { setActiveMenu } = useTopBar();
  const [selectedId, setSelectedId] = useState<string>('');

  const handleLoad = (exampleId: string) => {
    if (!exampleId) return;
    const ex = CIRCUIT_EXAMPLES.find((e) => e.id === exampleId);
    if (!ex) return;

    try {
      const decoded = deserializeElements(ex.netlist.trim());
      if (Array.isArray(decoded) && decoded.length > 0) {
        loadElements(decoded);
        setActiveMenu('file'); // Auto-close subbar to immediately reveal canvas
        if (setToast) {
          setToast({
            message: `🎉 Loaded example: ${ex.name}`,
            type: 'success'
          });
        }
      }
    } catch (err) {
      console.error('Failed to load circuit example:', err);
    }
  };

  return (
    <div className="interactive-panel glass-panel topbar-sub animate-slide-down" style={{ gap: '10px', alignItems: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'rgba(255, 255, 255, 0.7)', fontWeight: 'bold' }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ stroke: 'var(--theme-amber)' }}>
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
        </svg>
        <span>Examples:</span>
      </div>

      {/* Dropdown Menu Selector */}
      <select
        value={selectedId}
        onChange={(e) => {
          const val = e.target.value;
          setSelectedId(val);
          if (val) {
            handleLoad(val);
          }
        }}
        style={{
          background: 'rgba(15, 23, 42, 0.9)',
          color: '#ffffff',
          border: '1px solid rgba(245, 158, 11, 0.4)',
          borderRadius: '6px',
          padding: '5px 12px',
          fontSize: '11px',
          fontFamily: 'inherit',
          outline: 'none',
          cursor: 'pointer',
          boxShadow: '0 0 8px rgba(245, 158, 11, 0.2)'
        }}
      >
        <option value="" style={{ background: '#0f172a', color: 'rgba(255,255,255,0.6)' }}>
          -- Select an Example Circuit --
        </option>
        {CIRCUIT_EXAMPLES.map((ex) => (
          <option key={ex.id} value={ex.id} style={{ background: '#0f172a', color: '#ffffff', padding: '4px' }}>
            {ex.name}
          </option>
        ))}
      </select>
    </div>
  );
};
