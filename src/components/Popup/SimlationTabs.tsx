import React from 'react';
import { DCOperatingPt } from './SimulationTabs/DCOperatingPt';
import { SPICENet } from './SimulationTabs/SPICENet';
import { MNAWalkthrough } from './SimulationTabs/MNAWalkthrough';
import type { CanvasElement } from '../../dataTypes/AnotateType';

interface SimlationTabsProps {
  activeSubTab: 'dc' | 'netlist' | 'nma';
  setActiveSubTab: (tab: 'dc' | 'netlist' | 'nma') => void;
  dcVoltages: Record<string, number>;
  spiceNetlist: string;
  elements: CanvasElement[];
  setToast?: (toast: { message: string; type: 'success' | 'info' } | null) => void;
}

export const SimlationTabs: React.FC<SimlationTabsProps> = ({
  activeSubTab,
  setActiveSubTab,
  dcVoltages,
  spiceNetlist,
  elements,
  setToast
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* Sub tabs navigation */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', padding: '0 12px', background: 'rgba(0, 0, 0, 0.15)' }}>
        <button
          onClick={() => setActiveSubTab('dc')}
          style={{
            padding: '8px 12px',
            background: 'none',
            border: 'none',
            color: activeSubTab === 'dc' ? 'var(--theme-sapphire)' : 'rgba(255,255,255,0.5)',
            fontWeight: activeSubTab === 'dc' ? 'bold' : 'normal',
            fontSize: '11px',
            cursor: 'pointer',
            borderBottom: activeSubTab === 'dc' ? '2px solid var(--theme-sapphire)' : 'none'
          }}
        >
          DC Operating Pt
        </button>
        <button
          onClick={() => setActiveSubTab('netlist')}
          style={{
            padding: '8px 12px',
            background: 'none',
            border: 'none',
            color: activeSubTab === 'netlist' ? 'var(--theme-sapphire)' : 'rgba(255,255,255,0.5)',
            fontWeight: activeSubTab === 'netlist' ? 'bold' : 'normal',
            fontSize: '11px',
            cursor: 'pointer',
            borderBottom: activeSubTab === 'netlist' ? '2px solid var(--theme-sapphire)' : 'none'
          }}
        >
          SPICE Netlist
        </button>
        <button
          onClick={() => setActiveSubTab('nma')}
          style={{
            padding: '8px 12px',
            background: 'none',
            border: 'none',
            color: activeSubTab === 'nma' ? 'var(--theme-sapphire)' : 'rgba(255,255,255,0.5)',
            fontWeight: activeSubTab === 'nma' ? 'bold' : 'normal',
            fontSize: '11px',
            cursor: 'pointer',
            borderBottom: activeSubTab === 'nma' ? '2px solid var(--theme-sapphire)' : 'none'
          }}
        >
          MNA Walkthrough
        </button>
      </div>

      {/* Sub tabs content wrapper */}
      <div style={{ flex: 1, padding: '16px', overflowY: 'auto', minHeight: 0 }}>
        {activeSubTab === 'dc' && <DCOperatingPt dcVoltages={dcVoltages} />}
        {activeSubTab === 'netlist' && <SPICENet spiceNetlist={spiceNetlist} setToast={setToast} />}
        {activeSubTab === 'nma' && <MNAWalkthrough elements={elements} />}
      </div>
    </div>
  );
};
