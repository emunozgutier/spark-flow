import React, { useState, useRef, useEffect } from 'react';
import { useEditMode } from '../../store/useEditMode';
import type { EditModeType, EditSubmodeType } from '../../store/useEditMode';

export const EditModeDropdowns: React.FC = () => {
  const { editMode, editSubmode, setEditMode, setEditSubmode } = useEditMode();
  const [modeOpen, setModeOpen] = useState(false);
  const [submodeOpen, setSubmodeOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setModeOpen(false);
        setSubmodeOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const modesList: { type: EditModeType; label: string; icon: React.ReactNode; tooltip: string; shortcut: string }[] = [
    {
      type: 'select',
      label: 'Select',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
          <path d="M13 13l6 6" />
        </svg>
      ),
      tooltip: 'Select Mode (S)',
      shortcut: '[S]'
    },
    {
      type: 'move',
      label: 'Move',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v5" />
          <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v6" />
          <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8.5" />
          <path d="M8 15.5V11a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v4.5" />
          <path d="M10 14.5a8.2 8.2 0 0 1-6-6" />
          <path d="M2 14c0 3 2.5 5 5 7h7c3-2 5-4.5 5-7V11" />
        </svg>
      ),
      tooltip: 'Move/Pan Canvas (M / Space)',
      shortcut: '[M]'
    },
    {
      type: 'delete',
      label: 'Delete',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 6h18" />
          <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
          <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
          <line x1="10" y1="11" x2="10" y2="17" />
          <line x1="14" y1="11" x2="14" y2="17" />
        </svg>
      ),
      tooltip: 'Delete Mode (D)',
      shortcut: '[D]'
    },
    {
      type: 'add',
      label: 'Add',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      ),
      tooltip: 'Add Mode (A)',
      shortcut: '[A]'
    },
    {
      type: 'annotate',
      label: 'Annotate',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 20h9"/>
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
        </svg>
      ),
      tooltip: 'Annotation Mode (N)',
      shortcut: '[N]'
    }
  ];

  const submodesList: { type: EditSubmodeType; label: string; icon: React.ReactNode; tooltip: string; shortcut: string }[] = [
    {
      type: 'resistor',
      label: 'Resistor',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M 2 12 L 6 12 L 8 6 L 12 18 L 16 6 L 18 12 L 22 12" />
        </svg>
      ),
      tooltip: 'Resistor (R)',
      shortcut: '[R]'
    },
    {
      type: 'wire',
      label: 'Wire',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="5" cy="12" r="2" fill="currentColor"/>
          <path d="M 7 12 L 17 12" />
          <circle cx="19" cy="12" r="2" fill="currentColor"/>
        </svg>
      ),
      tooltip: 'Wire (W)',
      shortcut: '[W]'
    },
    {
      type: 'capacitor',
      label: 'Capacitor',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M 2 12 L 10 12 M 14 12 L 22 12" />
          <path d="M 10 5 L 10 19 M 14 5 L 14 19" />
        </svg>
      ),
      tooltip: 'Capacitor (C)',
      shortcut: '[C]'
    },
    {
      type: 'inductor',
      label: 'Inductor',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M 2 12 L 6 12 C 6 4, 9.5 4, 9.5 12 C 9.5 4, 13 4, 13 12 C 13 4, 16.5 4, 16.5 12 C 16.5 4, 20 4, 20 12 L 22 12" />
        </svg>
      ),
      tooltip: 'Inductor (L)',
      shortcut: '[L]'
    },
    {
      type: 'ground',
      label: 'Ground',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M 12 4 L 12 14" />
          <path d="M 5 14 L 19 14" />
          <path d="M 8 18 L 16 18" />
          <path d="M 10 22 L 14 22" />
        </svg>
      ),
      tooltip: 'Ground (G)',
      shortcut: '[G]'
    },
    {
      type: 'voltage',
      label: 'Voltage Src',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M 8 12 H 12 M 10 10 V 14" strokeWidth="1.5" />
          <path d="M 13 12 H 16" strokeWidth="1.5" />
        </svg>
      ),
      tooltip: 'Voltage Source (V*)',
      shortcut: '[V*]'
    },
    {
      type: 'acvoltage',
      label: 'AC Volt Src',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M 8 12 Q 10 7, 12 12 T 16 12" strokeWidth="1.8" />
        </svg>
      ),
      tooltip: 'AC Voltage Source (V*)',
      shortcut: '[V*]'
    },
    {
      type: 'current',
      label: 'Current Src',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M 7 12 H 17" />
          <path d="M 13 8 L 17 12 L 13 16" />
        </svg>
      ),
      tooltip: 'Current Source (I)',
      shortcut: '[I]'
    },
    {
      type: 'diode',
      label: 'Diode',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="2" y1="12" x2="8" y2="12" />
          <polygon points="8,6 16,12 8,18" fill="none" />
          <line x1="16" y1="6" x2="16" y2="18" />
          <line x1="16" y1="12" x2="22" y2="12" />
        </svg>
      ),
      tooltip: 'Diode (A+D)',
      shortcut: '[A+D]'
    },
    {
      type: 'bjt',
      label: 'Transistor',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="3" y1="12" x2="10" y2="12" />
          <line x1="10" y1="7" x2="10" y2="17" strokeWidth="2.8" />
          <line x1="10" y1="10" x2="17" y2="5" />
          <line x1="10" y1="14" x2="17" y2="19" />
          <polygon points="12,15 15,18 14,13" fill="currentColor" stroke="none" />
        </svg>
      ),
      tooltip: 'NPN BJT Transistor (Q*)',
      shortcut: '[Q*]'
    },
    {
      type: 'mosfet',
      label: 'MOSFET',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M 3 12 L 8 12" />
          <path d="M 8 7 L 8 17" strokeWidth="2.8" />
          <path d="M 11 7 L 11 17" strokeWidth="2" />
          <path d="M 11 9 L 16 9 L 16 4" />
          <path d="M 11 15 L 16 15 L 16 20" />
          <polygon points="11,12 14,10 14,14" fill="currentColor" stroke="none" />
        </svg>
      ),
      tooltip: 'NMOS MOSFET (Q*)',
      shortcut: '[Q*]'
    },
    {
      type: 'box',
      label: 'Box',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <line x1="9" y1="9" x2="15" y2="9" />
          <line x1="12" y1="9" x2="12" y2="15" />
          <line x1="9" y1="15" x2="15" y2="15" />
        </svg>
      ),
      tooltip: 'Container Box (N*)',
      shortcut: '[N*]'
    },
    {
      type: 'arrow',
      label: 'Arrow',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="5" y1="12" x2="19" y2="12" />
          <polyline points="12 5 19 12 12 19" />
        </svg>
      ),
      tooltip: 'Arrow Connector (N*)',
      shortcut: '[N*]'
    },
    {
      type: 'text',
      label: 'Text',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="4 7 4 4 20 4 20 7" />
          <line x1="9" y1="20" x2="15" y2="20" />
          <line x1="12" y1="4" x2="12" y2="20" />
        </svg>
      ),
      tooltip: 'Free Text Note (N*)',
      shortcut: '[N*]'
    }
  ];

  const activeModeItem = modesList.find((m) => m.type === editMode) || modesList[0];
  const activeSubmodeItem = submodesList.find((s) => s.type === editSubmode) || submodesList[0];
  const visibleSubmodes = editMode === 'annotate' 
    ? submodesList.filter(s => s.type === 'box' || s.type === 'arrow' || s.type === 'text')
    : submodesList.filter(s => s.type !== 'box' && s.type !== 'arrow' && s.type !== 'text');

  const styles = `
    .edit-drop-up-container {
      display: flex;
      gap: 6px;
      position: relative;
    }
    .edit-drop-up {
      background: rgba(16, 18, 27, 0.96) !important;
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid var(--border-subtle);
      border-radius: 12px;
      padding: 6px;
      display: flex;
      flex-direction: column;
      gap: 2px;
      position: absolute;
      bottom: calc(100% + 8px);
      z-index: 1000;
      min-width: 155px;
      box-shadow: var(--shadow-glass);
      animation: dropUpEnter 0.15s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
    .edit-drop-up-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 12px;
      border-radius: 8px;
      color: var(--text-secondary);
      background: transparent;
      border: none;
      cursor: pointer;
      text-align: left;
      font-size: 12px;
      font-weight: 600;
      transition: all 0.15s ease;
      width: 100%;
    }
    .edit-drop-up-item:hover {
      background: var(--border-subtle);
      color: var(--text-primary);
      transform: translateX(2px);
    }
    .edit-drop-up-item.active {
      background: rgba(255, 255, 255, 0.08);
      color: #ffffff;
    }
    .shortcut-badge {
      margin-left: auto;
      font-size: 9px;
      font-weight: 500;
      color: var(--text-tertiary, rgba(255, 255, 255, 0.35));
      background: rgba(255, 255, 255, 0.05);
      padding: 1px 4px;
      border-radius: 3px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      transition: all 0.15s ease;
    }
    .edit-drop-up-item:hover .shortcut-badge {
      color: var(--text-secondary, rgba(255, 255, 255, 0.75));
      background: rgba(255, 255, 255, 0.12);
    }
    .dropdown-btn {
      height: 32px;
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 0 10px;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.05);
      color: var(--text-secondary);
      border: 1px solid var(--border-subtle);
      cursor: pointer;
      transition: all 0.2s ease;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    .dropdown-btn:hover {
      background: rgba(255, 255, 255, 0.08);
      color: #ffffff;
      border-color: var(--border-strong);
    }
    .dropdown-btn.active {
      background: rgba(255, 255, 255, 0.1);
      color: #ffffff;
      border-color: var(--border-strong);
    }
    @keyframes dropUpEnter {
      from {
        opacity: 0;
        transform: translateY(6px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `;

  return (
    <div ref={containerRef} className="edit-drop-up-container">
      <style>{styles}</style>
 
      {/* 1. Mode Dropdown */}
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => {
            setModeOpen(!modeOpen);
            setSubmodeOpen(false);
          }}
          className={`dropdown-btn ${modeOpen ? 'active' : ''}`}
          title="Change Editor Mode"
        >
          {activeModeItem.icon}
          <span>{activeModeItem.label}</span>
          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ transform: modeOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {modeOpen && (
          <div className="edit-drop-up">
            {modesList.map((m) => (
              <button
                key={m.type}
                className={`edit-drop-up-item ${editMode === m.type ? 'active' : ''}`}
                onClick={() => {
                  setEditMode(m.type);
                  setModeOpen(false);
                }}
                title={m.tooltip}
              >
                {m.icon}
                <span>{m.label}</span>
                {m.shortcut && (
                  <span className="shortcut-badge">{m.shortcut}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 2. Submode Dropdown (Visible only in ADD or ANNOTATE modes) */}
      {(editMode === 'add' || editMode === 'annotate') && (
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => {
              setSubmodeOpen(!submodeOpen);
              setModeOpen(false);
            }}
            className={`dropdown-btn ${submodeOpen ? 'active' : ''}`}
            title="Select Component to Place"
          >
            {activeSubmodeItem.icon}
            <span>{activeSubmodeItem.label}</span>
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ transform: submodeOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {submodeOpen && (
            <div className="edit-drop-up" style={{ maxHeight: '280px', overflowY: 'auto', minWidth: '165px' }}>
              {visibleSubmodes.map((sm) => (
                <button
                  key={sm.type}
                  className={`edit-drop-up-item ${editSubmode === sm.type ? 'active' : ''}`}
                  onClick={() => {
                    if (sm.type) {
                      setEditSubmode(sm.type);
                    }
                    setSubmodeOpen(false);
                  }}
                  title={sm.tooltip}
                >
                  {sm.icon}
                  <span>{sm.label}</span>
                  {sm.shortcut && (
                    <span className="shortcut-badge">{sm.shortcut}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
