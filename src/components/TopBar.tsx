import React, { useState, useEffect } from 'react';
import type { ToolType, CanvasElement } from '../dataTypes/AnotateType';
import { FileBar } from './TopBar/FileBar';
import { ExamplesBar } from './TopBar/ExamplesBar';
import { Animation } from './TopBar/Animation';
import { DebugPopup } from './TopBar/DebugPopup';

import { Popup } from './Popup';
import { useCanvas } from '../store/useCanvas';
import { useTopBar } from '../store/useTopBar';
import './TopBar/TopBar.css';

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
  elements: CanvasElement[];
  setToast?: (toast: { message: string; type: 'success' | 'info' } | null) => void;
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
  elements,
  setToast,
}) => {
  const { activeMenu, setActiveMenu } = useTopBar();
  const [isDebug, setIsDebug] = useState(false);
  const { liveDCOn, setLiveDCOn } = useCanvas();

  // Disable liveDCOn when selecting annotations
  useEffect(() => {
    if (activeTool === 'text' || activeTool === 'arrow') {
      if (liveDCOn) {
        setLiveDCOn(false);
      }
    }
  }, [activeTool, liveDCOn, setLiveDCOn]);

  // Detect /debug URL segment or parameters on mount
  useEffect(() => {
    const hasDebugInPath = window.location.pathname.includes('/debug');
    const hasDebugInQuery = window.location.search.includes('debug');
    const hasDebugInHash = window.location.hash.includes('debug');

    if (hasDebugInPath || hasDebugInQuery || hasDebugInHash) {
      setIsDebug(true);
      setActiveMenu('debug');
    }
  }, [setActiveMenu]);

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
            className={`tool-btn tab-btn ${activeMenu === 'file' ? 'active' : ''}`}
            onClick={() => setActiveMenu('file')}
            aria-label="File Operations"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
            <span className="tooltip">File Options</span>
          </button>

          {/* Examples Tab */}
          <button
            className={`tool-btn tab-btn ${activeMenu === 'examples' ? 'active' : ''}`}
            onClick={() => setActiveMenu('examples')}
            aria-label="Example Circuits"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ stroke: activeMenu === 'examples' ? 'var(--theme-amber)' : 'currentColor' }}>
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
            </svg>
            <span className="tooltip" style={{ color: activeMenu === 'examples' ? 'var(--theme-amber)' : 'inherit' }}>Example Circuits</span>
          </button>


 
          {/* Simulate Tab */}
          <button
            className={`tool-btn tab-btn ${activeMenu === 'simulate' ? 'active' : ''}`}
            onClick={() => setActiveMenu('simulate')}
            aria-label="Run Simulation"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 3 19 12 5 21 5 3" fill={activeMenu === 'simulate' ? 'var(--theme-sapphire)' : 'none'} style={{ stroke: 'var(--theme-sapphire)' }} />
            </svg>
            <span className="tooltip">Simulate Circuit</span>
          </button>



          {/* Live DC Toggle Button */}
          <button
            className={`tool-btn tab-btn ${activeMenu === 'animation' ? 'active' : ''}`}
            onClick={() => {
              const nextLive = !liveDCOn;
              setLiveDCOn(nextLive);
              if (nextLive) {
                setActiveMenu('animation');
                if (activeTool === 'text' || activeTool === 'arrow') {
                  setActiveTool('select');
                }
              } else {
                setActiveMenu('file');
              }
              if (setToast) {
                setToast({
                  message: nextLive ? '⚡ Live DC Operating Point Solver enabled!' : '🔌 Live DC Operating Point Solver disabled.',
                  type: 'info'
                });
              }
            }}
            aria-label="Toggle Live DC Solver"
            style={{
              borderColor: liveDCOn ? 'var(--theme-emerald)' : 'rgba(255,255,255,0.08)',
              color: liveDCOn ? 'var(--theme-emerald)' : 'rgba(255,255,255,0.5)',
              boxShadow: liveDCOn ? '0 0 10px var(--theme-emerald-glow)' : 'none',
              marginLeft: '8px'
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ stroke: liveDCOn ? 'var(--theme-emerald)' : 'currentColor' }}>
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill={liveDCOn ? 'var(--theme-emerald)' : 'none'} />
            </svg>
            <span className="tooltip" style={{ color: liveDCOn ? 'var(--theme-emerald)' : 'inherit' }}>Live DC Operating Pt</span>
          </button>

          {/* Debug Tab (visible only in debug mode) */}
          {isDebug && (
            <button
              className={`tool-btn tab-btn ${activeMenu === 'debug' ? 'active' : ''}`}
              onClick={() => setActiveMenu('debug')}
              aria-label="Debug Options"
              style={{ borderLeft: '1px solid rgba(255, 255, 255, 0.1)', paddingLeft: '10px' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ stroke: 'var(--theme-coral)' }}>
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4" />
                <path d="M12 16h.01" />
              </svg>
              <span className="tooltip" style={{ color: 'var(--theme-coral)' }}>Debug Panel</span>
            </button>
          )}
        </div>
      </div>

      {/* Dynamic Sub-Bar / Sub-Toolbar */}
      <div className="topbar-sub-bar-container" style={{ gap: '10px' }}>
        {activeMenu === 'file' && (
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

        {activeMenu === 'examples' && (
          <ExamplesBar
            loadElements={loadElements}
            setToast={setToast}
          />
        )}
 

 
        {activeMenu === 'animation' && liveDCOn && (
          <Animation />
        )}


      </div>

      {/* Top-Level centered screen modal popup instead of a subbar */}
      {activeMenu === 'debug' && isDebug && (
        <DebugPopup
          isOpen={true}
          onClose={() => setActiveMenu('file')}
          elements={elements}
          loadElements={loadElements}
          setToast={setToast}
        />
      )}
 
      {/* Live Simulation Panel Dashboard overlay */}
      {activeMenu === 'simulate' && (
        <Popup
          isOpen={true}
          onClose={() => setActiveMenu('file')}
          elements={elements}
          setToast={setToast}
        />
      )}
    </div>
  );
};
