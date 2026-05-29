import React from 'react';
import type { ToolType } from '../dataTypes/AnotateType';

interface TopBarProps {
  activeTool: ToolType;
  setActiveTool: (tool: ToolType) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  clearCanvas: () => void;
  exportJSON: () => void;
  exportSVG: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeTool,
  setActiveTool,
  undo,
  redo,
  canUndo,
  canRedo,
  clearCanvas,
  exportJSON,
  exportSVG,
}) => {
  return (
    <div className="floating-overlay top-center user-select-none">
      <div className="interactive-panel glass-panel animate-fade-in">
        {/* Brand Logo */}
        <div className="spark-logo">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '2px', filter: 'drop-shadow(0 0 4px var(--theme-amethyst))' }}>
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill="var(--theme-amethyst)"/>
          </svg>
          SparkFlow
        </div>

        <div className="toolbar-divider" />

        {/* Pointer / Select Tool */}
        <button
          className={`tool-btn ${activeTool === 'select' ? 'active' : ''}`}
          onClick={() => setActiveTool('select')}
          aria-label="Select Pointer (V)"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
            <path d="M13 13l6 6" />
          </svg>
          <span className="tooltip">Select (V)</span>
        </button>

        {/* Text Card Tool */}
        <button
          className={`tool-btn ${activeTool === 'text' ? 'active' : ''}`}
          onClick={() => setActiveTool('text')}
          aria-label="Add Text Box (T)"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <line x1="9" y1="9" x2="15" y2="9" />
            <line x1="12" y1="9" x2="12" y2="15" />
            <line x1="9" y1="15" x2="15" y2="15" />
          </svg>
          <span className="tooltip">Add Card (T)</span>
        </button>

        {/* Arrow Connector Tool */}
        <button
          className={`tool-btn ${activeTool === 'arrow' ? 'active' : ''}`}
          onClick={() => setActiveTool('arrow')}
          aria-label="Draw Connector Arrow (A)"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
          <span className="tooltip">Arrow (A)</span>
        </button>

        {/* Hand Viewport Pan Tool */}
        <button
          className={`tool-btn ${activeTool === 'hand' ? 'active' : ''}`}
          onClick={() => setActiveTool('hand')}
          aria-label="Hand Pan Tool (H)"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v5" />
            <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v6" />
            <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8.5" />
            <path d="M8 15.5V11a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v4.5" />
            <path d="M10 14.5a8.2 8.2 0 0 1-6-6" />
            <path d="M2 14c0 3 2.5 5 5 7h7c3-2 5-4.5 5-7V11" />
          </svg>
          <span className="tooltip">Hand Pan (H / Space)</span>
        </button>

        <div className="toolbar-divider" />

        {/* Undo Action */}
        <button
          className="tool-btn"
          onClick={undo}
          disabled={!canUndo}
          style={{ opacity: canUndo ? 1 : 0.4, cursor: canUndo ? 'pointer' : 'not-allowed' }}
          aria-label="Undo"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="1 4 1 10 7 10" />
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
          </svg>
          <span className="tooltip">Undo (⌘Z)</span>
        </button>

        {/* Redo Action */}
        <button
          className="tool-btn"
          onClick={redo}
          disabled={!canRedo}
          style={{ opacity: canRedo ? 1 : 0.4, cursor: canRedo ? 'pointer' : 'not-allowed' }}
          aria-label="Redo"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.13-9.36L23 10" />
          </svg>
          <span className="tooltip">Redo (⌘⇧Z)</span>
        </button>

        <div className="toolbar-divider" />

        {/* Export board */}
        <button className="tool-btn" onClick={exportJSON} aria-label="Backup JSON">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          <span className="tooltip">Export JSON</span>
        </button>

        {/* Export SVG */}
        <button className="tool-btn" onClick={exportSVG} aria-label="Export SVG">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <circle cx="12" cy="9" r="3" />
            <path d="M12 3v3" />
            <path d="M12 12v3" />
          </svg>
          <span className="tooltip">Export Vector SVG</span>
        </button>

        {/* Clear canvas */}
        <button
          className="tool-btn"
          onClick={() => {
            if (window.confirm('Wipe the entire flow board? You will lose all cards and arrows.')) {
              clearCanvas();
            }
          }}
          aria-label="Clear Canvas"
          style={{ color: 'var(--theme-coral)' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            <line x1="10" y1="11" x2="10" y2="17" />
            <line x1="14" y1="11" x2="14" y2="17" />
          </svg>
          <span className="tooltip" style={{ color: '#ffffff' }}>Wipe Canvas</span>
        </button>
      </div>
    </div>
  );
};
