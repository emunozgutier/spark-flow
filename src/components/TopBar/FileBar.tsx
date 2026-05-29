import React, { useRef } from 'react';
import type { CanvasElement } from '../../dataTypes/AnotateType';

interface FileBarProps {
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  clearCanvas: () => void;
  exportJSON: () => void;
  exportSVG: () => void;
  loadElements: (elements: CanvasElement[]) => void;
}

export const FileBar: React.FC<FileBarProps> = ({
  undo,
  redo,
  canUndo,
  canRedo,
  clearCanvas,
  exportJSON,
  exportSVG,
  loadElements,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileLoadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed && Array.isArray(parsed.elements)) {
          loadElements(parsed.elements);
          alert('Board loaded successfully!');
        } else {
          alert('Invalid board backup file format.');
        }
      } catch (err) {
        console.error(err);
        alert('Failed to read file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="interactive-panel glass-panel topbar-sub animate-slide-down">
      {/* Undo */}
      <button
        className="tool-btn text-btn"
        onClick={undo}
        disabled={!canUndo}
        style={{ opacity: canUndo ? 1 : 0.4, cursor: canUndo ? 'pointer' : 'not-allowed' }}
        aria-label="Undo"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="1 4 1 10 7 10" />
          <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
        </svg>
        <span>undo</span>
        <span className="tooltip">Undo (⌘Z)</span>
      </button>

      {/* Redo */}
      <button
        className="tool-btn text-btn"
        onClick={redo}
        disabled={!canRedo}
        style={{ opacity: canRedo ? 1 : 0.4, cursor: canRedo ? 'pointer' : 'not-allowed' }}
        aria-label="Redo"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="23 4 23 10 17 10" />
          <path d="M20.49 15a9 9 0 1 1-2.13-9.36L23 10" />
        </svg>
        <span>redo</span>
        <span className="tooltip">Redo (⌘⇧Z)</span>
      </button>

      <div className="toolbar-divider" />

      {/* Load JSON Backup */}
      <button className="tool-btn text-btn" onClick={handleFileLoadClick} aria-label="Load JSON">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        <span>load</span>
        <span className="tooltip">Import JSON Board</span>
      </button>
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        accept=".json"
        onChange={handleFileChange}
      />

      {/* Save (Export JSON) */}
      <button className="tool-btn text-btn" onClick={exportJSON} aria-label="Save JSON">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
          <polyline points="17 21 17 13 7 13 7 21" />
          <polyline points="7 3 7 8 15 8" />
        </svg>
        <span>save</span>
        <span className="tooltip">Save JSON Backup</span>
      </button>

      <div className="toolbar-divider" />

      {/* Export SVG */}
      <button className="tool-btn text-btn" onClick={exportSVG} aria-label="Export SVG">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <circle cx="12" cy="9" r="3" />
          <path d="M12 3v3" />
          <path d="M12 12v3" />
        </svg>
        <span>svg</span>
        <span className="tooltip">Export Vector SVG</span>
      </button>

      {/* Wipe / Clear canvas */}
      <button
        className="tool-btn text-btn"
        onClick={() => {
          if (window.confirm('Wipe the entire flow board? You will lose all cards and arrows.')) {
            clearCanvas();
          }
        }}
        aria-label="Clear Canvas"
        style={{ color: 'var(--theme-coral)' }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
        <span>wipe</span>
        <span className="tooltip" style={{ color: '#ffffff' }}>Wipe Board</span>
      </button>
    </div>
  );
};
