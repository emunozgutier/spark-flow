import React from 'react';
import type { ToolType } from '../../dataTypes/AnotateType';

interface NavBarProps {
  activeTool: ToolType;
  setActiveTool: (tool: ToolType) => void;
}

export const NavBar: React.FC<NavBarProps> = ({ activeTool, setActiveTool }) => {
  return (
    <div className="interactive-panel glass-panel topbar-sub animate-slide-down">
      {/* Click (Select tool) */}
      <button
        className={`tool-btn text-btn ${activeTool === 'select' ? 'active' : ''}`}
        onClick={() => setActiveTool('select')}
        aria-label="Select Pointer (V)"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
          <path d="M13 13l6 6" />
        </svg>
        <span>click</span>
        <span className="tooltip">Select / Interact (V)</span>
      </button>

      {/* Pan (Hand tool) */}
      <button
        className={`tool-btn text-btn ${activeTool === 'hand' ? 'active' : ''}`}
        onClick={() => setActiveTool('hand')}
        aria-label="Hand Pan Tool (H)"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v5" />
          <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v6" />
          <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8.5" />
          <path d="M8 15.5V11a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v4.5" />
          <path d="M10 14.5a8.2 8.2 0 0 1-6-6" />
          <path d="M2 14c0 3 2.5 5 5 7h7c3-2 5-4.5 5-7V11" />
        </svg>
        <span>pan</span>
        <span className="tooltip">Hand Pan (H / Space)</span>
      </button>
    </div>
  );
};
