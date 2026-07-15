import React from 'react';
import { createPortal } from 'react-dom';
import { useProjectSettings } from '../store/useProjectSettings';

interface StyleSettingsPopupProps {
  isOpen: boolean;
  onClose: () => void;
  setToast?: (toast: { message: string; type: 'success' | 'info' } | null) => void;
}

export const StyleSettingsPopup: React.FC<StyleSettingsPopupProps> = ({
  isOpen,
  onClose,
  setToast
}) => {
  const {
    resistorBorderPadding,
    wireBorderWidth,
    setResistorBorderPadding,
    setWireBorderWidth
  } = useProjectSettings();

  if (!isOpen) return null;

  const handleReset = () => {
    setResistorBorderPadding(12.5);
    setWireBorderWidth(35.5);
    if (setToast) {
      setToast({
        message: '🔄 Styles reset to default values!',
        type: 'success'
      });
    }
  };

  const modalAnimationStyles = `
    @keyframes portalFadeIn {
      from { opacity: 0; backdrop-filter: blur(0px); }
      to { opacity: 1; backdrop-filter: blur(12px); }
    }
    @keyframes portalScaleIn {
      from { transform: scale(0.95); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }
  `;

  return createPortal(
    <>
      <style>{modalAnimationStyles}</style>
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(12px)',
          animation: 'portalFadeIn 0.2s ease-out',
        }}
      >
        <div
          className="glass-panel"
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'relative',
            width: '420px',
            background: 'rgba(15, 23, 42, 0.93)',
            border: '1.5px solid var(--theme-coral)',
            boxShadow: '0 20px 45px rgba(0, 0, 0, 0.6), 0 0 20px var(--theme-coral-glow)',
            borderRadius: '16px',
            color: '#fff',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            animation: 'portalScaleIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
            boxSizing: 'border-box'
          }}
        >
          {/* Head */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', borderBottom: '1px solid var(--border-subtle)', background: 'rgba(255, 255, 255, 0.02)' }}>
            <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--theme-coral)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ stroke: 'var(--theme-coral)' }}>
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              🔧 Customize Visual Borders
            </h4>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', color: 'rgba(255, 255, 255, 0.4)', cursor: 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              &times;
            </button>
          </div>

          {/* Content */}
          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Resistor Border Slider */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Resistor Border Padding</span>
                <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', fontWeight: 'bold', color: 'var(--theme-amber)', background: 'rgba(255, 191, 0, 0.08)', padding: '2px 8px', borderRadius: '4px' }}>
                  {resistorBorderPadding}px
                </span>
              </div>
              <input
                type="range"
                min="4"
                max="40"
                step="0.5"
                value={resistorBorderPadding}
                onChange={(e) => setResistorBorderPadding(parseFloat(e.target.value))}
                style={{
                  width: '100%',
                  height: '6px',
                  borderRadius: '3px',
                  background: 'rgba(255,255,255,0.1)',
                  accentColor: 'var(--theme-amber)',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              />
              <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                Adjusts the outer margin of the dashed border surrounding resistors on hover/selection.
              </span>
            </div>

            <div style={{ height: '1px', background: 'var(--border-subtle)' }} />

            {/* Wire Border Slider */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Wire Selection Border Width</span>
                <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', fontWeight: 'bold', color: 'var(--theme-sapphire)', background: 'rgba(30, 144, 255, 0.08)', padding: '2px 8px', borderRadius: '4px' }}>
                  {wireBorderWidth}px
                </span>
              </div>
              <input
                type="range"
                min="10"
                max="80"
                step="0.5"
                value={wireBorderWidth}
                onChange={(e) => setWireBorderWidth(parseFloat(e.target.value))}
                style={{
                  width: '100%',
                  height: '6px',
                  borderRadius: '3px',
                  background: 'rgba(255,255,255,0.1)',
                  accentColor: 'var(--theme-sapphire)',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              />
              <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                Adjusts the width of the outer dashed selection border path for wires.
              </span>
            </div>
          </div>

          {/* Footer */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px', borderTop: '1px solid var(--border-subtle)', background: 'rgba(255, 255, 255, 0.01)' }}>
            <button
              onClick={handleReset}
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid var(--border-subtle)',
                color: '#fff',
                borderRadius: '8px',
                padding: '6px 14px',
                fontSize: '12px',
                cursor: 'pointer',
                fontWeight: 600,
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)'}
            >
              Reset to Defaults
            </button>
            <button
              onClick={onClose}
              style={{
                background: 'var(--theme-coral)',
                border: 'none',
                color: '#fff',
                borderRadius: '8px',
                padding: '6px 16px',
                fontSize: '12px',
                cursor: 'pointer',
                fontWeight: 600,
                boxShadow: '0 0 10px var(--theme-coral-glow)',
                transition: 'opacity 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
              onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
};
