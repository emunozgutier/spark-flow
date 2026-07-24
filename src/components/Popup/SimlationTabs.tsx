import React, { useState } from 'react';
import { DCSweep } from './SimulationTabs/DCSweep';
import { TransientSim } from './SimulationTabs/TransientSim';
import { SPICENet } from './SimulationTabs/SPICENet';
import { MNAWalkthrough } from './SimulationTabs/MNAWalkthrough';
import type { CanvasElement } from '../../dataTypes/AnotateType';

interface SimlationTabsProps {
  activeSubTab: 'sim' | 'netlist' | 'nma';
  setActiveSubTab: (tab: 'sim' | 'netlist' | 'nma') => void;
  dcVoltages: Record<string, number>;
  spiceNetlist: string;
  elements: CanvasElement[];
  setToast?: (toast: { message: string; type: 'success' | 'info' } | null) => void;
}

export const SimlationTabs: React.FC<SimlationTabsProps> = ({
  activeSubTab,
  setActiveSubTab,
  spiceNetlist,
  elements,
  setToast
}) => {
  const [simOption, setSimOption] = useState<'transient' | 'dc_sweep'>('transient');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* Top Tabs Header: Sim, Netlist, MNA Walkthrough */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          borderBottom: '1px solid var(--border-subtle)',
          padding: '0 16px',
          background: 'rgba(0, 0, 0, 0.2)'
        }}
      >
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            onClick={() => setActiveSubTab('sim')}
            style={{
              padding: '10px 16px',
              background: 'none',
              border: 'none',
              color: activeSubTab === 'sim' ? 'var(--theme-sapphire)' : 'rgba(255,255,255,0.5)',
              fontWeight: activeSubTab === 'sim' ? 'bold' : 'normal',
              fontSize: '12px',
              cursor: 'pointer',
              borderBottom: activeSubTab === 'sim' ? '2px solid var(--theme-sapphire)' : '2px solid transparent',
              transition: 'all 0.15s ease'
            }}
          >
            ⚡ Sim
          </button>
          <button
            onClick={() => setActiveSubTab('netlist')}
            style={{
              padding: '10px 16px',
              background: 'none',
              border: 'none',
              color: activeSubTab === 'netlist' ? 'var(--theme-sapphire)' : 'rgba(255,255,255,0.5)',
              fontWeight: activeSubTab === 'netlist' ? 'bold' : 'normal',
              fontSize: '12px',
              cursor: 'pointer',
              borderBottom: activeSubTab === 'netlist' ? '2px solid var(--theme-sapphire)' : '2px solid transparent',
              transition: 'all 0.15s ease'
            }}
          >
            📜 Netlist
          </button>
          <button
            onClick={() => setActiveSubTab('nma')}
            style={{
              padding: '10px 16px',
              background: 'none',
              border: 'none',
              color: activeSubTab === 'nma' ? 'var(--theme-sapphire)' : 'rgba(255,255,255,0.5)',
              fontWeight: activeSubTab === 'nma' ? 'bold' : 'normal',
              fontSize: '12px',
              cursor: 'pointer',
              borderBottom: activeSubTab === 'nma' ? '2px solid var(--theme-sapphire)' : '2px solid transparent',
              transition: 'all 0.15s ease'
            }}
          >
            📐 MNA Walkthrough
          </button>
        </div>
      </div>

      {/* Mode Sub-bar: Right under the Sim tab */}
      {activeSubTab === 'sim' && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '8px 16px',
            background: 'rgba(0, 0, 0, 0.15)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)'
          }}
        >
          <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.7)', fontWeight: 'bold' }}>
            Simulation Mode:
          </span>
          <select
            value={simOption}
            onChange={(e) => setSimOption(e.target.value as 'transient' | 'dc_sweep')}
            style={{
              background: '#0d0f17',
              border: '1px solid rgba(59, 130, 246, 0.4)',
              color: '#ffffff',
              fontSize: '11px',
              padding: '4px 12px',
              borderRadius: '6px',
              outline: 'none',
              cursor: 'pointer',
              fontWeight: 'bold',
              boxShadow: '0 0 8px rgba(59, 130, 246, 0.2)'
            }}
          >
            <option value="transient">Transient</option>
            <option value="dc_sweep">DC Sweep</option>
          </select>
        </div>
      )}

      {/* Sub tabs content wrapper */}
      <div style={{ flex: 1, padding: '16px', overflowY: 'auto', minHeight: 0 }}>
        {activeSubTab === 'sim' && (
          <>
            {simOption === 'transient' && <TransientSim spiceNetlist={spiceNetlist} />}
            {simOption === 'dc_sweep' && <DCSweep spiceNetlist={spiceNetlist} />}
          </>
        )}
        {activeSubTab === 'netlist' && <SPICENet spiceNetlist={spiceNetlist} setToast={setToast} />}
        {activeSubTab === 'nma' && <MNAWalkthrough elements={elements} />}
      </div>
    </div>
  );
};
