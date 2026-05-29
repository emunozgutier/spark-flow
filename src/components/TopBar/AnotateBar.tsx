import React from 'react';
import type { ToolType } from '../../dataTypes/AnotateType';

interface AnotateBarProps {
  activeTool: ToolType;
  setActiveTool: (tool: ToolType) => void;
}

export const AnotateBar: React.FC<AnotateBarProps> = ({ activeTool, setActiveTool }) => {
  return (
    <div className="interactive-panel glass-panel topbar-sub animate-slide-down">
      {/* Box */}
      <button
        className={`tool-btn text-btn ${activeTool === 'text' ? 'active' : ''}`}
        onClick={() => setActiveTool('text')}
        aria-label="Add Text Box (T)"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <line x1="9" y1="9" x2="15" y2="9" />
          <line x1="12" y1="9" x2="12" y2="15" />
          <line x1="9" y1="15" x2="15" y2="15" />
        </svg>
        <span>box</span>
        <span className="tooltip">Add Card Node (T)</span>
      </button>

      {/* Arrow */}
      <button
        className={`tool-btn text-btn ${activeTool === 'arrow' ? 'active' : ''}`}
        onClick={() => setActiveTool('arrow')}
        aria-label="Draw Connector Arrow (A)"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="5" y1="12" x2="19" y2="12" />
          <polyline points="12 5 19 12 12 19" />
        </svg>
        <span>arrow</span>
        <span className="tooltip">Arrow Connector (A)</span>
      </button>
    </div>
  );
};
