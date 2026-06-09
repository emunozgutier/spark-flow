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

      {/* BJT Transistor */}
      <button
        className={`tool-btn text-btn ${activeTool === 'bjt' ? 'active' : ''}`}
        onClick={() => setActiveTool('bjt')}
        aria-label="Add BJT Transistor"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          {/* Simplified Transistor Icon */}
          <line x1="3" y1="12" x2="10" y2="12" />
          <line x1="10" y1="7" x2="10" y2="17" strokeWidth="2.8" />
          <line x1="10" y1="10" x2="17" y2="5" />
          <line x1="10" y1="14" x2="17" y2="19" />
          <polygon points="12,15 15,18 14,13" fill="currentColor" stroke="none" />
        </svg>
        <span>transistor</span>
        <span className="tooltip">Add NPN BJT Card (Q)</span>
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
