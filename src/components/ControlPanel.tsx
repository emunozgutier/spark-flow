import React from 'react';

interface ControlPanelProps {
  zoom: number;
  zoomIn: () => void;
  zoomOut: () => void;
  resetView: () => void;
  fitView: () => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  zoom,
  zoomIn,
  zoomOut,
  resetView,
  fitView,
}) => {
  const percent = Math.round(zoom * 100);

  return (
    <>
      {/* Zoom and View Controllers */}
      <div className="floating-overlay bottom-left user-select-none">
        <div className="interactive-panel glass-panel zoom-controls animate-fade-in">
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
