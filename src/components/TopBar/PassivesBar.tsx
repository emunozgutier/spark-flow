import React from 'react';
import type { ToolType } from '../../dataTypes/AnotateType';

interface PassivesBarProps {
  activeTool: ToolType;
  setActiveTool: (tool: ToolType) => void;
}

export const PassivesBar: React.FC<PassivesBarProps> = ({ activeTool, setActiveTool }) => {
  return (
    <div className="interactive-panel glass-panel topbar-sub animate-slide-down">
      {/* Resistor */}
      <button
        className={`tool-btn text-btn ${activeTool === 'resistor' ? 'active' : ''}`}
        onClick={() => setActiveTool('resistor')}
        aria-label="Add Resistor"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M 2 12 L 6 12 L 8 6 L 12 18 L 16 6 L 18 12 L 22 12" />
        </svg>
        <span>resistor</span>
        <span className="tooltip">Add Resistor Card (R)</span>
      </button>

      <div className="toolbar-divider" />

      {/* Wire (Uses Arrow Connection Tool) */}
      <button
        className={`tool-btn text-btn ${activeTool === 'arrow' ? 'active' : ''}`}
        onClick={() => setActiveTool('arrow')}
        aria-label="Draw Wire"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="5" cy="12" r="2" fill="currentColor"/>
          <path d="M 7 12 L 17 12" />
          <circle cx="19" cy="12" r="2" fill="currentColor"/>
        </svg>
        <span>wire</span>
        <span className="tooltip">Draw Connection Wire (W)</span>
      </button>
    </div>
  );
};
