import React from 'react';
import { useAnimation } from '../../store/useAnimation';

export const Animation: React.FC = () => {
  const { speedMultiplier, isPaused, setSpeedMultiplier, togglePlayPause } = useAnimation();

  return (
    <div className="interactive-panel glass-panel topbar-sub animate-slide-down" style={{ gap: '12px', padding: '6px 12px' }}>
      {/* Play / Pause Toggle */}
      <button
        className={`tool-btn text-btn ${!isPaused ? 'active' : ''}`}
        onClick={togglePlayPause}
        aria-label={isPaused ? "Play Animation" : "Pause Animation"}
        style={{
          color: !isPaused ? 'var(--theme-emerald)' : 'var(--text-secondary)',
          borderColor: !isPaused ? 'var(--theme-emerald)' : 'rgba(255,255,255,0.08)',
          boxShadow: !isPaused ? '0 0 10px var(--theme-emerald-glow)' : 'none',
        }}
      >
        {isPaused ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="5 3 19 12 5 21 5 3" fill="currentColor" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="6" y="4" width="4" height="16" fill="currentColor" />
            <rect x="14" y="4" width="4" height="16" fill="currentColor" />
          </svg>
        )}
        <span>{isPaused ? 'play' : 'pause'}</span>
        <span className="tooltip">{isPaused ? 'Resume electron flow' : 'Pause electron flow'}</span>
      </button>

      <div className="toolbar-divider" />

      {/* Speed Slider Label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, userSelect: 'none' }}>
        <span>speed:</span>
        <span style={{ fontFamily: 'monospace', color: 'var(--theme-sapphire)', minWidth: '32px', textAlign: 'right' }}>
          {speedMultiplier.toFixed(1)}x
        </span>
      </div>

      {/* Speed Slider Input */}
      <input
        type="range"
        min="0.1"
        max="5.0"
        step="0.1"
        value={speedMultiplier}
        onChange={(e) => setSpeedMultiplier(parseFloat(e.target.value))}
        style={{
          width: '80px',
          accentColor: 'var(--theme-sapphire)',
          cursor: 'pointer',
          background: 'rgba(255, 255, 255, 0.1)',
          height: '4px',
          borderRadius: '2px',
          outline: 'none',
          appearance: 'none',
          WebkitAppearance: 'none'
        }}
        aria-label="Animation speed multiplier"
      />

      {/* Quick Speed presets */}
      <div style={{ display: 'flex', gap: '4px' }}>
        {[0.5, 1.0, 2.0, 5.0].map((preset) => (
          <button
            key={preset}
            onClick={() => setSpeedMultiplier(preset)}
            style={{
              background: speedMultiplier === preset ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
              border: 'none',
              borderRadius: '4px',
              padding: '2px 6px',
              color: speedMultiplier === preset ? '#ffffff' : 'var(--text-muted)',
              fontSize: '10px',
              fontFamily: 'monospace',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)'
            }}
            className={speedMultiplier === preset ? 'active-preset' : ''}
          >
            {preset.toFixed(1)}x
          </button>
        ))}
      </div>
    </div>
  );
};
export default Animation;
