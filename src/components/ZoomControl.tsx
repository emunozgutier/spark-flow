import React from 'react';
import type { ToolType } from '../dataTypes/AnotateType';

interface ZoomControlProps {
  zoom: number;
  zoomIn: () => void;
  zoomOut: () => void;
  resetView: () => void;
  fitView: () => void;
  activeTool: ToolType;
  setActiveTool: (tool: ToolType) => void;
}

export const ZoomControl: React.FC<ZoomControlProps> = ({
  zoom,
  zoomIn,
  zoomOut,
  resetView,
  fitView,
  activeTool,
  setActiveTool,
}) => {
  const percent = Math.round(zoom * 100);

  return (
    <>
      {/* Zoom and View Controllers */}
      <div className="floating-overlay bottom-left user-select-none">
        <div className="interactive-panel glass-panel zoom-controls animate-fade-in">
          {/* Navigation Tools */}
          {/* Click (Select tool) */}
          <button
            className={`tool-btn ${activeTool === 'select' ? 'active' : ''}`}
            onClick={() => setActiveTool('select')}
            style={{ width: '32px', height: '32px' }}
            aria-label="Select Pointer (V)"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
              <path d="M13 13l6 6" />
            </svg>
            <span className="tooltip">Select (V)</span>
          </button>

          {/* Pan (Hand tool) */}
          <button
            className={`tool-btn ${activeTool === 'hand' ? 'active' : ''}`}
            onClick={() => setActiveTool('hand')}
            style={{ width: '32px', height: '32px' }}
            aria-label="Hand Pan Tool (H)"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v5" />
              <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v6" />
              <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8.5" />
              <path d="M8 15.5V11a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v4.5" />
              <path d="M10 14.5a8.2 8.2 0 0 1-6-6" />
              <path d="M2 14c0 3 2.5 5 5 7h7c3-2 5-4.5 5-7V11" />
            </svg>
            <span className="tooltip">Hand Pan (H / Space)</span>
          </button>

          <div className="toolbar-divider" style={{ height: '18px' }} />

          {/* Zoom Out */}
          <button className="tool-btn" onClick={zoomOut} style={{ width: '32px', height: '32px' }} aria-label="Zoom Out">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span className="tooltip">Zoom Out (-)</span>
          </button>

          {/* Zoom Percent Indicator */}
          <span className="zoom-percent">{percent}%</span>

          {/* Zoom In */}
          <button className="tool-btn" onClick={zoomIn} style={{ width: '32px', height: '32px' }} aria-label="Zoom In">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span className="tooltip">Zoom In (+)</span>
          </button>

          <div className="toolbar-divider" style={{ height: '18px' }} />

          {/* Reset 1:1 Zoom */}
          <button className="tool-btn" onClick={resetView} style={{ width: '56px', height: '32px', fontSize: '11px', fontWeight: 'bold' }} aria-label="Reset View">
            1:1
            <span className="tooltip">Reset View</span>
          </button>

          {/* Fit to Content */}
          <button className="tool-btn" onClick={fitView} style={{ width: '32px', height: '32px' }} aria-label="Fit Screen">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h6v6" />
              <path d="M9 21H3v-6" />
              <path d="M21 3l-7 7" />
              <path d="M3 21l7-7" />
            </svg>
            <span className="tooltip">Fit Elements</span>
          </button>
        </div>
      </div>
    </>
  );
};
