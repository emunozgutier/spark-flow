import React from 'react';
import { useCanvas } from '../../store/useCanvas';

export const ProbeBar: React.FC = () => {
  const {
    showVoltageProbes,
    showCurrentProbes,
    setShowVoltageProbes,
    setShowCurrentProbes,
    liveDCOn,
    setLiveDCOn,
  } = useCanvas();

  return (
    <div
      className="interactive-panel glass-panel topbar-sub animate-slide-down"
      style={{ gap: '12px', padding: '6px 12px' }}
    >
      {/* Live Solver Status Indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginRight: '4px' }}>
        <span
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: liveDCOn ? 'var(--theme-emerald)' : '#64748b',
            boxShadow: liveDCOn ? '0 0 8px var(--theme-emerald-glow)' : 'none',
            display: 'inline-block',
            transition: 'all 0.3s ease',
          }}
        />
        <span
          style={{
            fontSize: '11px',
            color: 'var(--text-secondary)',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            userSelect: 'none',
          }}
        >
          {liveDCOn ? 'Live Solver Active' : 'Solver Idle'}
        </span>
      </div>

      <div className="toolbar-divider" />

      {/* Voltage Probes Toggle */}
      <button
        className={`tool-btn text-btn ${showVoltageProbes ? 'active' : ''}`}
        onClick={() => setShowVoltageProbes(!showVoltageProbes)}
        aria-label="Toggle Voltage Probes"
        style={{
          color: showVoltageProbes ? 'var(--theme-emerald)' : 'var(--text-secondary)',
          borderColor: showVoltageProbes ? 'var(--theme-emerald)' : 'rgba(255,255,255,0.08)',
          boxShadow: showVoltageProbes ? '0 0 10px var(--theme-emerald-glow)' : 'none',
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="m16 12-4-4-4 8 4-4" />
        </svg>
        <span>Voltage Probes</span>
        <span className="tooltip">Toggle node voltage labels on wires</span>
      </button>

      {/* Current Probes Toggle */}
      <button
        className={`tool-btn text-btn ${showCurrentProbes ? 'active' : ''}`}
        onClick={() => setShowCurrentProbes(!showCurrentProbes)}
        aria-label="Toggle Current Probes"
        style={{
          color: showCurrentProbes ? 'var(--theme-amber)' : 'var(--text-secondary)',
          borderColor: showCurrentProbes ? 'var(--theme-amber)' : 'rgba(255,255,255,0.08)',
          boxShadow: showCurrentProbes ? '0 0 10px var(--theme-amber-glow)' : 'none',
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14" />
          <path d="m12 5 7 7-7 7" />
        </svg>
        <span>Current Probes</span>
        <span className="tooltip">Toggle branch current labels on wires</span>
      </button>

      <div className="toolbar-divider" />

      {/* Solver Master Toggle (Quick switch from Probes view) */}
      <button
        className="tool-btn text-btn"
        onClick={() => setLiveDCOn(!liveDCOn)}
        aria-label="Toggle Solver"
        style={{
          color: liveDCOn ? 'var(--theme-sapphire)' : 'var(--text-secondary)',
          borderColor: 'rgba(255,255,255,0.08)',
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
          <line x1="12" y1="2" x2="12" y2="12" />
        </svg>
        <span>{liveDCOn ? 'Stop Solver' : 'Start Solver'}</span>
        <span className="tooltip">Toggle live solver calculation state</span>
      </button>
    </div>
  );
};

export default ProbeBar;
