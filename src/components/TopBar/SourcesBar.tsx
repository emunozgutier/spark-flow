import React from 'react';
import type { ToolType } from '../../dataTypes/AnotateType';

interface SourcesBarProps {
  activeTool: ToolType;
  setActiveTool: (tool: ToolType) => void;
}

export const SourcesBar: React.FC<SourcesBarProps> = ({ activeTool, setActiveTool }) => {
  return (
    <div className="interactive-panel glass-panel topbar-sub animate-slide-down">
      {/* Voltage Source */}
      <button
        className={`tool-btn text-btn ${activeTool === 'voltage' ? 'active' : ''}`}
        onClick={() => setActiveTool('voltage')}
        aria-label="Add Voltage Source"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M 8 10 H 12 M 10 8 V 12" strokeWidth="2" /> {/* + sign */}
          <path d="M 12 16 H 16" strokeWidth="2" /> {/* - sign */}
        </svg>
        <span>voltage src</span>
        <span className="tooltip">Add Voltage Source Card</span>
      </button>

      {/* Current Source */}
      <button
        className={`tool-btn text-btn ${activeTool === 'current' ? 'active' : ''}`}
        onClick={() => setActiveTool('current')}
        aria-label="Add Current Source"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M 7 12 H 17" />
          <path d="M 13 8 L 17 12 L 13 16" />
        </svg>
        <span>current src</span>
        <span className="tooltip">Add Current Source Card</span>
      </button>

      {/* Ground */}
      <button
        className={`tool-btn text-btn ${activeTool === 'ground' ? 'active' : ''}`}
        onClick={() => setActiveTool('ground')}
        aria-label="Add Ground"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M 12 4 L 12 14" />
          <path d="M 5 14 L 19 14" />
          <path d="M 8 18 L 16 18" />
          <path d="M 10 22 L 14 22" />
        </svg>
        <span>ground</span>
        <span className="tooltip">Add Ground Card (G)</span>
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
