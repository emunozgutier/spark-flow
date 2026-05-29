import React from 'react';
import type { CanvasElement, CardElement, ArrowElement, ThemeColor } from '../dataTypes/AnotateType';

// Engineering notation and designator helpers
const formatEngineering = (val: number | undefined): string => {
  if (val === undefined || isNaN(val)) return '';
  if (val === 0) return '0';
  
  const absVal = Math.abs(val);
  const prefixes = [
    { value: 1e9, symbol: 'G' },
    { value: 1e6, symbol: 'M' },
    { value: 1e3, symbol: 'k' },
    { value: 1, symbol: '' },
    { value: 1e-3, symbol: 'm' },
    { value: 1e-6, symbol: 'u' },
    { value: 1e-9, symbol: 'n' },
    { value: 1e-12, symbol: 'p' },
    { value: 1e-15, symbol: 'f' }
  ];

  for (let i = 0; i < prefixes.length; i++) {
    const p = prefixes[i];
    if (absVal >= p.value) {
      const num = val / p.value;
      const formattedNum = parseFloat(num.toFixed(3));
      return `${formattedNum}${p.symbol}`;
    }
  }
  
  return val.toExponential(2);
};

const parseEngineering = (str: string): number => {
  const trimmed = str.trim();
  if (!trimmed) return 0;
  
  const match = trimmed.match(/^([+-]?\d*(?:\.\d+)?)\s*([a-zA-Zµ]?)$/);
  if (!match) return parseFloat(trimmed) || 0;
  
  const [_, numStr, suffix] = match;
  const num = parseFloat(numStr);
  if (isNaN(num)) return 0;
  
  switch (suffix) {
    case 'f': return num * 1e-15;
    case 'p': return num * 1e-12;
    case 'n': return num * 1e-9;
    case 'u':
    case 'µ': return num * 1e-6;
    case 'm': return num * 1e-3;
    case 'k': return num * 1e3;
    case 'M': return num * 1e6;
    case 'G': return num * 1e9;
    default: return num;
  }
};

const parseInstanceNumber = (str: string, prefixChar: string): number => {
  const numStr = str.replace(new RegExp(`^${prefixChar}`, 'i'), '').trim();
  const parsed = parseInt(numStr, 10);
  return isNaN(parsed) ? 1 : parsed;
};

interface ElementSettingsProps {
  selectedElement: CanvasElement | null;
  onUpdateElement: (id: string, updates: Partial<any>) => void;
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

export const ElementSettings: React.FC<ElementSettingsProps> = ({
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

  const isCard = selectedElement.type === 'box';
  
  // Cast types safely based on element type mapping
  const card = selectedElement as CardElement;
  const arrow = selectedElement as ArrowElement;

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
          {card.componentType ? (
            <>
              {/* Passive Component Designator */}
              <div className="sidebar-section">
                <label className="sidebar-section-title" htmlFor="comp-designator">Instance Designator</label>
                <input
                  id="comp-designator"
                  type="text"
                  className="inspector-input"
                  value={`${card.componentType === 'resistor' ? 'R' : card.componentType === 'capacitor' ? 'C' : 'L'}${card.instanceNumber || 1}`}
                  onChange={(e) => {
                    const prefix = card.componentType === 'resistor' ? 'R' : card.componentType === 'capacitor' ? 'C' : 'L';
                    const num = parseInstanceNumber(e.target.value, prefix);
                    onUpdateElement(card.id, { instanceNumber: num });
                  }}
                  placeholder="e.g. C1"
                />
              </div>

              {/* Passive Component Value */}
              <div className="sidebar-section">
                <label className="sidebar-section-title" htmlFor="comp-value">Component Value</label>
                <input
                  id="comp-value"
                  type="text"
                  className="inspector-input"
                  value={formatEngineering(card.value)}
                  onChange={(e) => {
                    const val = parseEngineering(e.target.value);
                    onUpdateElement(card.id, { value: val });
                  }}
                  placeholder="e.g. 10u"
                />
              </div>

              {/* Passive Component Rotation */}
              <div className="sidebar-section">
                <label className="sidebar-section-title">Component Rotation</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {[0, 90, 180, 270].map((angle) => (
                    <button
                      key={angle}
                      className={`style-option-btn ${((card.rotation || 0) % 360) === angle ? 'active' : ''}`}
                      onClick={() => onUpdateElement(card.id, { rotation: angle })}
                      style={{ flex: 1, padding: '6px 0', fontSize: '12px' }}
                    >
                      {angle}°
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Card Title */}
              <div className="sidebar-section">
                <label className="sidebar-section-title" htmlFor="card-title">Card Header</label>
                <input
                  id="card-title"
                  type="text"
                  className="inspector-input"
                  value={card.title || ''}
                  onChange={(e) => onUpdateElement(card.id, { title: e.target.value })}
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
                  value={card.content || ''}
                  onChange={(e) => onUpdateElement(card.id, { content: e.target.value })}
                  placeholder="Write core description..."
                />
              </div>
            </>
          )}

          {/* Card Theme Picker */}
          <div className="sidebar-section">
            <label className="sidebar-section-title">Color Palette Theme</label>
            <div className="color-grid">
              {COLOR_THEMES.map((theme) => (
                <button
                  key={theme.name}
                  className={`color-option ${card.color === theme.name ? 'active' : ''}`}
                  style={{ backgroundColor: theme.value }}
                  onClick={() => onUpdateElement(card.id, { color: theme.name })}
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
              <div>X: {Math.round(card.x)}px</div>
              <div>Y: {Math.round(card.y)}px</div>
              <div>W: {card.width}px</div>
              <div>H: {card.height}px</div>
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
              value={arrow.label || ''}
              onChange={(e) => onUpdateElement(arrow.id, { label: e.target.value })}
              placeholder="e.g. Next Step / Triggers"
            />
          </div>

          {/* Arrow Style Segment */}
          <div className="sidebar-section">
            <label className="sidebar-section-title">Link Geometry Style</label>
            <div className="style-select">
              <button
                className={`style-option-btn ${arrow.style === 'curved' ? 'active' : ''}`}
                onClick={() => onUpdateElement(arrow.id, { style: 'curved' })}
              >
                Curved
              </button>
              <button
                className={`style-option-btn ${arrow.style === 'straight' ? 'active' : ''}`}
                onClick={() => onUpdateElement(arrow.id, { style: 'straight' })}
              >
                Straight
              </button>
              <button
                className={`style-option-btn ${arrow.style === 'dashed' ? 'active' : ''}`}
                onClick={() => onUpdateElement(arrow.id, { style: 'dashed' })}
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
                  className={`color-option ${arrow.color === theme.name ? 'active' : ''}`}
                  style={{ backgroundColor: theme.value }}
                  onClick={() => onUpdateElement(arrow.id, { color: theme.name })}
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
