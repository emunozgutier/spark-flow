import React from 'react';
import type { ToolType } from '../../dataTypes/AnotateType';

interface ActiveBarProps {
  activeTool: ToolType;
  setActiveTool: (tool: ToolType) => void;
}

export const ActiveBar: React.FC<ActiveBarProps> = ({ activeTool, setActiveTool }) => {
  return (
    <div className="interactive-panel glass-panel topbar-sub animate-slide-down">
      {/* Diode */}
      <button
        className={`tool-btn text-btn ${activeTool === 'diode' ? 'active' : ''}`}
        onClick={() => setActiveTool('diode')}
        aria-label="Add Diode"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          {/* Anode to Cathode diode symbol */}
          <line x1="2" y1="12" x2="8" y2="12" />
          <polygon points="8,6 16,12 8,18" fill="none" />
          <line x1="16" y1="6" x2="16" y2="18" />
          <line x1="16" y1="12" x2="22" y2="12" />
        </svg>
        <span>diode</span>
        <span className="tooltip">Add Diode Card (D)</span>
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
