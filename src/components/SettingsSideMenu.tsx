import React from 'react';
import type { CanvasElement, CardElement, ArrowElement, ThemeColor } from '../dataTypes/AnotateType';
import { formatEngineering, parseEngineering, parseInstanceNumber } from '../utils/math';
import { useCanvas } from '../store/useCanvas';

interface SettingsSideMenuProps {
  selectedElement: CanvasElement | null;
  onUpdateElement: (id: string, updates: Partial<any>) => void;
  onDeleteElement: (id: string) => void;
  onClose: () => void;
  arrowCurrent?: number;
}

const COLOR_THEMES: { name: ThemeColor; value: string; display: string }[] = [
  { name: 'slate', value: 'var(--theme-slate)', display: 'Slate' },
  { name: 'amethyst', value: 'var(--theme-amethyst)', display: 'Amethyst' },
  { name: 'sapphire', value: 'var(--theme-sapphire)', display: 'Sapphire' },
  { name: 'emerald', value: 'var(--theme-emerald)', display: 'Emerald' },
  { name: 'coral', value: 'var(--theme-coral)', display: 'Coral' },
  { name: 'amber', value: 'var(--theme-amber)', display: 'Amber' },
];

export const SettingsSideMenu: React.FC<SettingsSideMenuProps> = ({
  selectedElement,
  onUpdateElement,
  onDeleteElement,
  onClose,
  arrowCurrent,
}) => {
  const { liveDCOn } = useCanvas();
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
          {isCard ? (
            (card.id.startsWith('join') || card.title === 'join')
              ? '🔗 Joint Inspector'
              : card.componentType
              ? '⚡ Component Inspector'
              : '📝 Card Inspector'
          ) : '🔗 Link Inspector'}
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
                  value={`${card.componentType === 'resistor' ? 'R' : card.componentType === 'capacitor' ? 'C' : card.componentType === 'inductor' ? 'L' : card.componentType === 'voltage' ? 'V' : card.componentType === 'acvoltage' ? 'Vac' : card.componentType === 'current' ? 'I' : card.componentType === 'diode' ? 'D' : card.componentType === 'bjt' ? 'Q' : 'GND'}${card.instanceNumber || 1}`}
                  onChange={(e) => {
                    const prefix = card.componentType === 'resistor' ? 'R' : card.componentType === 'capacitor' ? 'C' : card.componentType === 'inductor' ? 'L' : card.componentType === 'voltage' ? 'V' : card.componentType === 'acvoltage' ? 'Vac' : card.componentType === 'current' ? 'I' : card.componentType === 'diode' ? 'D' : card.componentType === 'bjt' ? 'Q' : 'GND';
                    const num = parseInstanceNumber(e.target.value, prefix);
                    onUpdateElement(card.id, { instanceNumber: num });
                  }}
                  placeholder="e.g. GND1"
                />
              </div>

              {/* Passive Component Value */}
              {card.componentType !== 'ground' && card.componentType !== 'diode' && (
                <div className="sidebar-section">
                  <label className="sidebar-section-title" htmlFor="comp-value">
                    {card.componentType === 'bjt' ? 'Current Gain (Beta)' : 'Component Value'}
                  </label>
                  <input
                    id="comp-value"
                    type="text"
                    className="inspector-input"
                    value={card.componentType === 'bjt' ? String(card.value ?? 100) : formatEngineering(card.value)}
                    onChange={(e) => {
                      const val = card.componentType === 'bjt' ? (parseFloat(e.target.value) || 100) : parseEngineering(e.target.value);
                      onUpdateElement(card.id, { value: val });
                    }}
                    placeholder={card.componentType === 'bjt' ? 'e.g. 100' : 'e.g. 10u'}
                  />
                </div>
              )}

              {/* AC Frequency (For AC Voltage Source) */}
              {card.componentType === 'acvoltage' && (
                <div className="sidebar-section">
                  <label className="sidebar-section-title" htmlFor="comp-frequency">Source Frequency (Hz)</label>
                  <input
                    id="comp-frequency"
                    type="text"
                    className="inspector-input"
                    value={formatEngineering(card.frequency ?? 60)}
                    onChange={(e) => {
                      const val = parseEngineering(e.target.value);
                      onUpdateElement(card.id, { frequency: val });
                    }}
                    placeholder="e.g. 60"
                  />
                </div>
              )}

              {/* Group 2 Toggle (For Resistors) */}
              {card.componentType === 'resistor' && (
                <div className="sidebar-section" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: '12px' }}>
                  <label className="sidebar-section-title" style={{ margin: 0, cursor: 'pointer' }} htmlFor="comp-g2">
                    MNA Group 2 (i_res)
                  </label>
                  <input
                    id="comp-g2"
                    type="checkbox"
                    checked={!!card.isGroup2}
                    onChange={(e) => {
                      onUpdateElement(card.id, { isGroup2: e.target.checked });
                    }}
                    style={{
                      width: '16px',
                      height: '16px',
                      accentColor: 'var(--theme-sapphire)',
                      cursor: 'pointer'
                    }}
                  />
                </div>
              )}

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
          ) : (card.id.startsWith('join') || card.title === 'join') ? (
            <>
              {/* Joint Info */}
              <div className="sidebar-section">
                <label className="sidebar-section-title">Joint Node Number</label>
                <div style={{
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: '1.2px solid var(--theme-amber)',
                  boxShadow: '0 0 8px var(--theme-amber-glow)',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  fontFamily: 'monospace',
                  fontSize: '13px',
                  fontWeight: 'bold',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <span style={{ color: 'var(--theme-amber)' }}>🔗</span>
                  <span>{card.jointNumber || 'Unassigned'}</span>
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
              {COLOR_THEMES.filter(
                (theme) => !card.componentType || (theme.name !== 'slate' && theme.name !== 'emerald' && theme.name !== 'coral')
              ).map((theme) => (
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
          {/* Net Name */}
          <div className="sidebar-section">
            <label className="sidebar-section-title">Net Name</label>
            <div style={{
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1.2px solid var(--theme-sapphire)',
              boxShadow: '0 0 8px var(--theme-sapphire-glow)',
              borderRadius: '6px',
              padding: '8px 12px',
              fontFamily: 'monospace',
              fontSize: '13px',
              fontWeight: 'bold',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <span style={{ color: 'var(--theme-sapphire)' }}>🔌</span>
              <span>{arrow.netName ? (arrow.netName.includes('.') ? arrow.netName.split('.')[0] : arrow.netName) : 'Unassigned'}</span>
            </div>
          </div>

          {/* Subnet Name */}
          {arrow.netName && arrow.netName.includes('.') && (
            <div className="sidebar-section">
              <label className="sidebar-section-title">Subnet Name</label>
              <div style={{
                background: 'rgba(15, 23, 42, 0.6)',
                border: '1.2px solid var(--theme-sapphire)',
                boxShadow: '0 0 8px var(--theme-sapphire-glow)',
                borderRadius: '6px',
                padding: '8px 12px',
                fontFamily: 'monospace',
                fontSize: '13px',
                fontWeight: 'bold',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <span style={{ color: 'var(--theme-sapphire)' }}>🔗</span>
                <span>{arrow.netName}</span>
              </div>
            </div>
          )}

          {/* Link Current */}
          {liveDCOn && arrowCurrent !== undefined && (
            <div className="sidebar-section">
              <label className="sidebar-section-title">Link Current (I)</label>
              <div style={{
                background: 'rgba(15, 23, 42, 0.6)',
                border: '1.2px solid var(--theme-emerald)',
                boxShadow: '0 0 8px var(--theme-emerald-glow)',
                borderRadius: '6px',
                padding: '8px 12px',
                fontFamily: 'monospace',
                fontSize: '13px',
                fontWeight: 'bold',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <span style={{ color: 'var(--theme-emerald)' }}>⚡</span>
                <span style={{ color: 'var(--theme-emerald)' }}>{formatEngineering(arrowCurrent)}A</span>
              </div>
            </div>
          )}

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
