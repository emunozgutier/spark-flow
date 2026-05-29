import React from 'react';
import type { CanvasElement, ThemeColor } from '../types';

interface SidebarProps {
  selectedElement: CanvasElement | null;
  onUpdateElement: (id: string, updates: Partial<CanvasElement>) => void;
  onDeleteElement: (id: string) => void;
  onClose: () => void;
}

const COLOR_THEMES: { name: ThemeColor; value: string; display: string }[] = [
  { name: 'slate', value: 'var(--theme-slate)', display: 'Slate' },
  { name: 'amethyst', value: 'var(--theme-amethyst)', display: 'Amethyst' },
  { name: 'sapphire', value: 'var(--theme-sapphire)', display: 'Sapphire' },
  { name: 'emerald', value: 'var(--theme-emerald)', display: 'Emerald' },
  { name: 'coral', value: 'var(--theme-coral)', display: 'Coral' },
  { name: 'amber', value: 'var(--theme-amber)', display: 'Amber' },
];

export const Sidebar: React.FC<SidebarProps> = ({
  selectedElement,
  onUpdateElement,
  onDeleteElement,
  onClose,
}) => {
  const isOpen = selectedElement !== null;

  if (!isOpen || !selectedElement) {
    return (
      <div className="sidebar-panel glass-panel">
        <div className="sidebar-header">
          <span className="sidebar-title">Inspector</span>
        </div>
      </div>
    );
  }

  const isCard = selectedElement.type === 'card';

  return (
    <div className={`sidebar-panel glass-panel ${isOpen ? 'open' : ''} user-select-none`}>
      {/* Header */}
      <div className="sidebar-header">
        <span className="sidebar-title">
          {isCard ? '📝 Card Inspector' : '🔗 Link Inspector'}
        </span>
        <button className="sidebar-close-btn" onClick={onClose} aria-label="Close Inspector">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Card Form Controls */}
      {isCard ? (
        <div className="sidebar-content">
          {/* Card Title */}
          <div className="sidebar-section">
            <label className="sidebar-section-title" htmlFor="card-title">Card Header</label>
            <input
              id="card-title"
              type="text"
              className="inspector-input"
              value={selectedElement.title}
              onChange={(e) => onUpdateElement(selectedElement.id, { title: e.target.value })}
              placeholder="e.g. Brainstorming"
            />
          </div>

          {/* Card Body content */}
          <div className="sidebar-section">
            <label className="sidebar-section-title" htmlFor="card-body">Card Contents</label>
            <textarea
              id="card-body"
              className="inspector-input"
              style={{ minHeight: '120px', resize: 'vertical', lineHeight: '1.4' }}
              value={selectedElement.content}
              onChange={(e) => onUpdateElement(selectedElement.id, { content: e.target.value })}
              placeholder="Write core description..."
            />
          </div>

          {/* Card Theme Picker */}
          <div className="sidebar-section">
            <label className="sidebar-section-title">Color Palette Theme</label>
            <div className="color-grid">
              {COLOR_THEMES.map((theme) => (
                <button
                  key={theme.name}
                  className={`color-option ${selectedElement.color === theme.name ? 'active' : ''}`}
                  style={{ backgroundColor: theme.value }}
                  onClick={() => onUpdateElement(selectedElement.id, { color: theme.name })}
                  title={theme.display}
                  aria-label={`Select ${theme.display} theme`}
                />
              ))}
            </div>
          </div>

          {/* Card Dimensions */}
          <div className="sidebar-section" style={{ background: 'rgba(0,0,0,0.15)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
            <span className="sidebar-section-title" style={{ margin: 0, fontSize: '10px' }}>Geometries</span>
            <div style={{ display: 'flex', gap: '12px', marginTop: '6px', fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
              <div>X: {Math.round(selectedElement.x)}px</div>
              <div>Y: {Math.round(selectedElement.y)}px</div>
              <div>W: {selectedElement.width}px</div>
              <div>H: {selectedElement.height}px</div>
            </div>
          </div>
        </div>
      ) : (
        /* Arrow Link Form Controls */
        <div className="sidebar-content">
          {/* Arrow Label */}
          <div className="sidebar-section">
            <label className="sidebar-section-title" htmlFor="arrow-label">Link Label</label>
            <input
              id="arrow-label"
              type="text"
              className="inspector-input"
              value={selectedElement.label || ''}
              onChange={(e) => onUpdateElement(selectedElement.id, { label: e.target.value })}
              placeholder="e.g. Next Step / Triggers"
            />
          </div>

          {/* Arrow Style Segment */}
          <div className="sidebar-section">
            <label className="sidebar-section-title">Link Geometry Style</label>
            <div className="style-select">
              <button
                className={`style-option-btn ${selectedElement.style === 'curved' ? 'active' : ''}`}
                onClick={() => onUpdateElement(selectedElement.id, { style: 'curved' })}
              >
                Curved
              </button>
              <button
                className={`style-option-btn ${selectedElement.style === 'straight' ? 'active' : ''}`}
                onClick={() => onUpdateElement(selectedElement.id, { style: 'straight' })}
              >
                Straight
              </button>
              <button
                className={`style-option-btn ${selectedElement.style === 'dashed' ? 'active' : ''}`}
                onClick={() => onUpdateElement(selectedElement.id, { style: 'dashed' })}
              >
                Dashed
              </button>
            </div>
          </div>

          {/* Arrow Line Color Theme */}
          <div className="sidebar-section">
            <label className="sidebar-section-title">Link Vector Color</label>
            <div className="color-grid">
              {COLOR_THEMES.map((theme) => (
                <button
                  key={theme.name}
                  className={`color-option ${selectedElement.color === theme.name ? 'active' : ''}`}
                  style={{ backgroundColor: theme.value }}
                  onClick={() => onUpdateElement(selectedElement.id, { color: theme.name })}
                  title={theme.display}
                  aria-label={`Select ${theme.display} theme`}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Delete / Footer */}
      <div style={{ marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid var(--border-subtle)' }}>
        <button className="delete-btn" onClick={() => onDeleteElement(selectedElement.id)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
          Delete Element
        </button>
      </div>
    </div>
  );
};
