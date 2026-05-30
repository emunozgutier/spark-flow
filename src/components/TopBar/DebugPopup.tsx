import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { CanvasElement } from '../../dataTypes/AnotateType';
import { serializeElements, deserializeElements } from '../../url';

interface DebugPopupProps {
  isOpen: boolean;
  onClose: () => void;
  elements: CanvasElement[];
  loadElements: (elements: CanvasElement[]) => void;
  setToast?: (toast: { message: string; type: 'success' | 'info' } | null) => void;
}

export const DebugPopup: React.FC<DebugPopupProps> = ({
  isOpen,
  onClose,
  elements,
  loadElements,
  setToast
}) => {
  const [stateText, setStateText] = useState('');
  const [copied, setCopied] = useState(false);

  // Synchronize textarea state with live elements whenever the modal opens
  useEffect(() => {
    if (!isOpen) return;
    try {
      const liveState = serializeElements(elements);
      setStateText(liveState);
    } catch (err) {
      console.error('Failed to serialize elements for portal popup:', err);
    }
  }, [elements, isOpen]);

  const handleCopy = () => {
    try {
      navigator.clipboard.writeText(stateText);
      setCopied(true);
      if (setToast) {
        setToast({
          message: '📋 State code copied to clipboard!',
          type: 'success'
        });
      }
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy state:', err);
    }
  };

  const handleApply = () => {
    try {
      const trimmedText = stateText.trim();
      if (!trimmedText) {
        if (setToast) {
          setToast({
            message: '⚠️ Please paste a valid compact state string first.',
            type: 'info'
          });
        }
        return;
      }

      const decodedElements = deserializeElements(trimmedText);
      if (Array.isArray(decodedElements) && decodedElements.length > 0) {
        loadElements(decodedElements);
        onClose(); // Close popup modal and reset tab
        if (setToast) {
          setToast({
            message: '🎉 Board successfully updated with new state code!',
            type: 'success'
          });
        }
      } else {
        if (setToast) {
          setToast({
            message: '❌ Invalid state code format or empty board state.',
            type: 'info'
          });
        }
      }
    } catch (err) {
      console.error(err);
      if (setToast) {
        setToast({
          message: '❌ Failed to parse or apply state. Check console.',
          type: 'info'
        });
      }
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

  if (!isOpen) return null;

  return createPortal(
    <>
      <style>{modalAnimationStyles}</style>

      {/* 80% Screen Width & Height Modal Popup Overlay centered in window */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(15, 23, 42, 0.75)',
          animation: 'portalFadeIn 0.2s ease-out',
          backdropFilter: 'blur(12px)',
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            width: '80vw',
            height: '80vh',
            background: 'rgba(30, 41, 59, 0.9)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '16px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
            display: 'flex',
            flexDirection: 'column',
            padding: '24px 32px',
            color: '#fff',
            animation: 'portalScaleIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
            boxSizing: 'border-box'
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '12px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: 'var(--theme-coral)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ stroke: 'var(--theme-coral)' }}>
                  <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/>
                  <path d="M12 16v-4"/>
                  <path d="M12 8h.01"/>
                </svg>
                SparkFlow State Portal
              </h3>
              <span style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)', marginTop: '4px', display: 'block' }}>
                Copy the code below to share your circuit, or paste a new state code and click &ldquo;Apply State Code&rdquo; to update your board.
              </span>
            </div>
            
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: 'rgba(255, 255, 255, 0.4)',
                fontSize: '22px',
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'color 0.2s, background 0.2s',
                lineHeight: '1'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#fff';
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'rgba(255, 255, 255, 0.4)';
                e.currentTarget.style.background = 'none';
              }}
            >
              &times;
            </button>
          </div>

          {/* Textarea Area (80% box) */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', marginBottom: '20px', minHeight: 0 }}>
            <textarea
              value={stateText}
              onChange={(e) => setStateText(e.target.value)}
              placeholder="Paste compact state code here to render a board..."
              style={{
                flex: 1,
                background: 'rgba(15, 23, 42, 0.65)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '8px',
                padding: '16px',
                color: '#fff',
                fontFamily: 'monospace',
                fontSize: '13px',
                lineHeight: '1.6',
                outline: 'none',
                resize: 'none',
                boxSizing: 'border-box',
                overflowY: 'auto'
              }}
              onFocus={(e) => e.target.select()}
            />
          </div>

          {/* Actions Footer */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '16px' }}>
            <button
              onClick={onClose}
              style={{
                padding: '8px 18px',
                borderRadius: '6px',
                background: 'transparent',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: 'rgba(255, 255, 255, 0.7)',
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'background 0.2s, color 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                e.currentTarget.style.color = '#fff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)';
              }}
            >
              Cancel
            </button>

            <button
              onClick={handleCopy}
              style={{
                padding: '8px 18px',
                borderRadius: '6px',
                background: copied ? 'var(--theme-emerald)' : 'rgba(255, 255, 255, 0.08)',
                border: 'none',
                color: '#fff',
                fontSize: '13px',
                fontWeight: '500',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'background 0.2s'
              }}
            >
              {copied ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                  <span>Copy State Code</span>
                </>
              )}
            </button>

            <button
              onClick={handleApply}
              style={{
                padding: '8px 24px',
                borderRadius: '6px',
                background: 'var(--theme-coral)',
                border: 'none',
                color: '#fff',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(244, 63, 94, 0.25)',
                transition: 'background 0.2s, transform 0.1s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#e11d48';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--theme-coral)';
              }}
            >
              Apply State Code
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
};
