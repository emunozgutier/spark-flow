import React, { useState, useEffect } from 'react';
import type { ToolType, CanvasElement } from '../dataTypes/AnotateType';
import { FileBar } from './TopBar/FileBar';
import { AnotateBar } from './TopBar/AnotateBar';
import { PassivesBar } from './TopBar/PassivesBar';
import { SourcesBar } from './TopBar/SourcesBar';
import { ActiveBar } from './TopBar/ActiveBar';
import { Animation } from './TopBar/Animation';
import { DebugPopup } from './TopBar/DebugPopup';
import { Popup } from './Popup';
import { useCanvas } from '../store/useCanvas';
import { useTopBar } from '../store/useTopBar';

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

  // Sync activeMenu when the activeTool changes via global keyboard hotkeys
  useEffect(() => {
    if (activeTool === 'text' || activeTool === 'arrow') {
      setActiveMenu('anotate');
      if (liveDCOn) {
        setLiveDCOn(false);
      }
    } else if (activeTool === 'resistor' || activeTool === 'capacitor' || activeTool === 'inductor') {
      setActiveMenu('passives');
    } else if (activeTool === 'voltage' || activeTool === 'current' || activeTool === 'ground') {
      setActiveMenu('sources');
    } else if (activeTool === 'diode') {
      setActiveMenu('actives');
    }
  }, [activeTool, liveDCOn, setLiveDCOn, setActiveMenu]);

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

          {/* Anotate Tab */}
          <button
            className={`tool-btn tab-btn ${activeMenu === 'anotate' ? 'active' : ''}`}
            onClick={() => {
              setActiveMenu('anotate');
              if (liveDCOn) {
                setLiveDCOn(false);
                if (setToast) {
                  setToast({
                    message: '🔌 Live DC Operating Point Solver disabled.',
                    type: 'info'
                  });
                }
              }
            }}
            aria-label="Annotations"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9"/>
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
            </svg>
            <span className="tooltip">Annotation Tools</span>
          </button>

          {/* Passives Tab */}
          <button
            className={`tool-btn tab-btn ${activeMenu === 'passives' ? 'active' : ''}`}
            onClick={() => setActiveMenu('passives')}
            aria-label="Passive Elements"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="3"/>
              <path d="M9 12h6"/>
              <path d="M12 9v6"/>
              <circle cx="7" cy="7" r="1" fill="currentColor"/>
              <circle cx="17" cy="17" r="1" fill="currentColor"/>
            </svg>
            <span className="tooltip">Passive Elements</span>
          </button>

          {/* Active Elements Tab */}
          <button
            className={`tool-btn tab-btn ${activeMenu === 'actives' ? 'active' : ''}`}
            onClick={() => setActiveMenu('actives')}
            aria-label="Active Elements"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="6 4 18 12 6 20 6 4" />
              <line x1="18" y1="4" x2="18" y2="20" />
            </svg>
            <span className="tooltip">Active Elements</span>
          </button>
 
          {/* Sources Tab */}
          <button
            className={`tool-btn tab-btn ${activeMenu === 'sources' ? 'active' : ''}`}
            onClick={() => setActiveMenu('sources')}
            aria-label="Sources"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M 9 12 Q 10.5 8, 12 12 T 15 12" />
            </svg>
            <span className="tooltip">Sources & Ground</span>
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
                setActiveMenu('anotate');
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
 
        {activeMenu === 'anotate' && (
          <AnotateBar
            activeTool={activeTool}
            setActiveTool={setActiveTool}
          />
        )}
 
        {activeMenu === 'passives' && (
          <PassivesBar
            activeTool={activeTool}
            setActiveTool={setActiveTool}
          />
        )}
  
        {activeMenu === 'sources' && (
          <SourcesBar
            activeTool={activeTool}
            setActiveTool={setActiveTool}
          />
        )}

        {activeMenu === 'actives' && (
          <ActiveBar
            activeTool={activeTool}
            setActiveTool={setActiveTool}
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
          onClose={() => setActiveMenu('anotate')}
          elements={elements}
          loadElements={loadElements}
          setToast={setToast}
        />
      )}
 
      {/* Live Simulation Panel Dashboard overlay */}
      {activeMenu === 'simulate' && (
        <Popup
          isOpen={true}
          onClose={() => setActiveMenu('anotate')}
          elements={elements}
          setToast={setToast}
        />
      )}
    </div>
  );
};
