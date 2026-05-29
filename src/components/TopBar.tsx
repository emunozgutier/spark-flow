import React, { useState, useEffect } from 'react';
import type { ToolType, CanvasElement } from '../dataTypes/AnotateType';
import { FileBar } from './TopBar/FileBar';
import { NavBar } from './TopBar/NavBar';
import { AnotateBar } from './TopBar/AnotateBar';

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
  loadElements: (elements: CanvasElement[]) => void;
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
  loadElements,
}) => {
  const [activeTab, setActiveTab] = useState<'file' | 'nav' | 'anotate'>('nav');

  // Sync activeTab when the activeTool changes via global keyboard hotkeys
  useEffect(() => {
    if (activeTool === 'select' || activeTool === 'hand') {
      setActiveTab('nav');
    } else if (activeTool === 'text' || activeTool === 'arrow') {
      setActiveTab('anotate');
    }
  }, [activeTool]);

  return (
    <div className="floating-overlay top-center user-select-none topbar-wrapper">
      {/* Primary Tab Bar */}
      <div className="interactive-panel glass-panel topbar-main animate-fade-in">
        {/* Brand Logo */}
        <div className="spark-logo" style={{ marginRight: '8px' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '2px', filter: 'drop-shadow(0 0 4px var(--theme-amethyst))' }}>
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill="var(--theme-amethyst)"/>
          </svg>
          SparkFlow
        </div>

        <div className="toolbar-divider" />

        {/* Tab Buttons as Icons */}
        <div className="topbar-tabs">
          {/* File Tab */}
          <button
            className={`tool-btn tab-btn ${activeTab === 'file' ? 'active' : ''}`}
            onClick={() => setActiveTab('file')}
            aria-label="File Operations"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
            <span className="tooltip">File Options</span>
          </button>

          {/* Nav Tab */}
          <button
            className={`tool-btn tab-btn ${activeTab === 'nav' ? 'active' : ''}`}
            onClick={() => setActiveTab('nav')}
            aria-label="Navigation & Select"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="3 11 22 2 13 21 11 13 3 11"/>
            </svg>
            <span className="tooltip">Navigation Tools</span>
          </button>

          {/* Anotate Tab */}
          <button
            className={`tool-btn tab-btn ${activeTab === 'anotate' ? 'active' : ''}`}
            onClick={() => setActiveTab('anotate')}
            aria-label="Annotations"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9"/>
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
            </svg>
            <span className="tooltip">Annotation Tools</span>
          </button>
        </div>
      </div>

      {/* Dynamic Sub-Bar / Sub-Toolbar */}
      <div className="topbar-sub-bar-container">
        {activeTab === 'file' && (
          <FileBar
            undo={undo}
            redo={redo}
            canUndo={canUndo}
            canRedo={canRedo}
            clearCanvas={clearCanvas}
            exportJSON={exportJSON}
            exportSVG={exportSVG}
            loadElements={loadElements}
          />
        )}

        {activeTab === 'nav' && (
          <NavBar
            activeTool={activeTool}
            setActiveTool={setActiveTool}
          />
        )}

        {activeTab === 'anotate' && (
          <AnotateBar
            activeTool={activeTool}
            setActiveTool={setActiveTool}
          />
        )}
      </div>
    </div>
  );
};
