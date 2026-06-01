import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { CanvasElement, CardElement, ArrowElement } from '../../dataTypes/AnotateType';
import { formatEngineering } from '../../utils/math';

interface SimulationPanelProps {
  elements: CanvasElement[];
  isOpen: boolean;
  onClose: () => void;
  setToast?: (toast: { message: string; type: 'success' | 'info' } | null) => void;
}

// DSU helper to group connected pins into electrical nodes
class UnionFind {
  parent: Record<string, string> = {};
  
  find(id: string): string {
    if (!this.parent[id]) {
      this.parent[id] = id;
    }
    if (this.parent[id] === id) {
      return id;
    }
    this.parent[id] = this.find(this.parent[id]);
    return this.parent[id];
  }
  
  union(x: string, y: string) {
    const rootX = this.find(x);
    const rootY = this.find(y);
    if (rootX !== rootY) {
      this.parent[rootX] = rootY;
    }
  }
}

// 30-line Gaussian Elimination linear system solver
const solveLinearSystem = (A: number[][], B: number[]): number[] => {
  const n = B.length;
  for (let i = 0; i < n; i++) {
    let maxEl = Math.abs(A[i][i]);
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(A[k][i]) > maxEl) {
        maxEl = Math.abs(A[k][i]);
        maxRow = k;
      }
    }
    
    // Swap rows
    for (let k = i; k < n; k++) {
      const tmp = A[maxRow][k];
      A[maxRow][k] = A[i][k];
      A[i][k] = tmp;
    }
    const tmp = B[maxRow];
    B[maxRow] = B[i];
    B[i] = tmp;
    
    if (Math.abs(A[i][i]) < 1e-12) {
      // Singular matrix, return zeros as fallback
      return new Array(n).fill(0);
    }
    
    for (let k = i + 1; k < n; k++) {
      const c = -A[k][i] / A[i][i];
      for (let j = i; j < n; j++) {
        if (i === j) {
          A[k][j] = 0;
        } else {
          A[k][j] += c * A[i][j];
        }
      }
      B[k] += c * B[i];
    }
  }
  
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    x[i] = B[i] / A[i][i];
    for (let k = i - 1; k >= 0; k--) {
      B[k] -= A[k][i] * x[i];
    }
  }
  return x;
};

export const SimulationPanel: React.FC<SimulationPanelProps> = ({
  elements,
  isOpen,
  onClose,
  setToast
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'dc' | 'ac' | 'netlist'>('dc');
  const [dcVoltages, setDcVoltages] = useState<Record<string, number>>({});
  const [spiceNetlist, setSpiceNetlist] = useState<string>('');
  const [filterStats, setFilterStats] = useState<{ type: string; fc: number } | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    // --- ELECTRICAL GRID SOLVER ---
    try {
      const cards = elements.filter((el) => el.type === 'box') as CardElement[];
      const arrows = elements.filter((el) => el.type === 'arrow') as ArrowElement[];
      
      const uf = new UnionFind();

      // 1. Union ports belonging to join elements
      cards.forEach((card) => {
        if (card.id.startsWith('join') || card.title === 'join') {
          uf.union(`${card.id}-top`, `${card.id}-right`);
          uf.union(`${card.id}-top`, `${card.id}-bottom`);
          uf.union(`${card.id}-top`, `${card.id}-left`);
        }
      });

      // 2. Union ports connected by wires
      arrows.forEach((w) => {
        if (w.fromId && w.fromSocket && w.toId && w.toSocket) {
          uf.union(`${w.fromId}-${w.fromSocket}`, `${w.toId}-${w.toSocket}`);
        }
      });

      // 3. Map sets to node keys
      const groups: Record<string, string[]> = {};
      cards.forEach((card) => {
        const isGround = card.componentType === 'ground';
        const portsList = isGround ? ['top'] : ['left', 'right'];
        
        portsList.forEach((socket) => {
          const pin = `${card.id}-${socket}`;
          const root = uf.find(pin);
          if (!groups[root]) groups[root] = [];
          groups[root].push(pin);
        });
      });

      // Identify the ground node group
      let gndRoot: string | null = null;
      Object.keys(groups).forEach((root) => {
        const hasGndPin = groups[root].some((pin) => 
          pin.toLowerCase().includes('ground') || pin.toLowerCase().includes('gnd')
        );
        if (hasGndPin) {
          gndRoot = root;
        }
      });

      // Map roots to standard SPICE node numbers (GND is always "0")
      const rootToNodeName: Record<string, string> = {};
      let nodeCounter = 1;
      
      if (gndRoot) {
        rootToNodeName[gndRoot] = '0';
      }

      Object.keys(groups).forEach((root) => {
        if (root === gndRoot) return;
        rootToNodeName[root] = String(nodeCounter++);
      });

      // Map pin elements to SPICE nodes
      const getPinNode = (cardId: string, socket: string): string => {
        const root = uf.find(`${cardId}-${socket}`);
        return rootToNodeName[root] || '0';
      };

      // 4. MNA SOLVER MATRICES BUILDER
      const nodeCount = nodeCounter - 1; // Nodes 1 to N
      const voltageSources = cards.filter((c) => c.componentType === 'voltage');
      const mnaSize = nodeCount + voltageSources.length;

      const A = Array.from({ length: mnaSize }, () => new Array(mnaSize).fill(0));
      const B = new Array(mnaSize).fill(0);

      // Map voltage sources to their indices in MNA
      const vSourceMap: Record<string, number> = {};
      voltageSources.forEach((vSrc, idx) => {
        vSourceMap[vSrc.id] = idx;
      });

      // Fill Resistors conductances in G matrix
      cards.forEach((card) => {
        if (card.componentType === 'resistor') {
          const n1Str = getPinNode(card.id, 'left');
          const n2Str = getPinNode(card.id, 'right');
          const n1 = parseInt(n1Str, 10);
          const n2 = parseInt(n2Str, 10);
          const rVal = card.value || 1000;
          const g = 1 / rVal;

          if (n1 > 0) A[n1 - 1][n1 - 1] += g;
          if (n2 > 0) A[n2 - 1][n2 - 1] += g;
          if (n1 > 0 && n2 > 0) {
            A[n1 - 1][n2 - 1] -= g;
            A[n2 - 1][n1 - 1] -= g;
          }
        }
      });

      // Fill Voltage sources in MNA
      voltageSources.forEach((vSrc, idx) => {
        const n1Str = getPinNode(vSrc.id, 'left');  // + terminal
        const n2Str = getPinNode(vSrc.id, 'right'); // - terminal
        const n1 = parseInt(n1Str, 10);
        const n2 = parseInt(n2Str, 10);
        const val = vSrc.value !== undefined ? vSrc.value : 5;

        // B matrix coefficients
        if (n1 > 0) A[n1 - 1][nodeCount + idx] += 1;
        if (n2 > 0) A[n2 - 1][nodeCount + idx] -= 1;

        // C matrix coefficients (Transpose of B)
        if (n1 > 0) A[nodeCount + idx][n1 - 1] += 1;
        if (n2 > 0) A[nodeCount + idx][n2 - 1] -= 1;

        // Voltage values
        B[nodeCount + idx] = val;
      });

      // Solve System: A * X = B
      const X = mnaSize > 0 ? solveLinearSystem(A, B) : [];
      
      const voltages: Record<string, number> = { '0': 0 };
      for (let i = 1; i <= nodeCount; i++) {
        voltages[String(i)] = X[i - 1] || 0;
      }
      setDcVoltages(voltages);

      // 5. AC ANALYSIS (RC corner calculation)
      const res = cards.find((c) => c.componentType === 'resistor');
      const cap = cards.find((c) => c.componentType === 'capacitor');
      const ind = cards.find((c) => c.componentType === 'inductor');
      
      if (res && cap) {
        const fc = 1 / (2 * Math.PI * (res.value || 1000) * (cap.value || 10e-6));
        setFilterStats({ type: 'RC Low-Pass Filter', fc });
      } else if (res && ind) {
        const fc = (res.value || 1000) / (2 * Math.PI * (ind.value || 10e-3));
        setFilterStats({ type: 'RL High-Pass Filter', fc });
      } else {
        setFilterStats({ type: 'Generic Resistor Network', fc: 159.15 }); // RC default filter demo
      }

      // 6. SPICE NETLIST COMPILING
      let netlist = `* SparkFlow Live SPICE Netlist\n`;
      cards.forEach((card) => {
        if (card.componentType === 'resistor') {
          netlist += `R${card.instanceNumber || 1} ${getPinNode(card.id, 'left')} ${getPinNode(card.id, 'right')} ${formatEngineering(card.value)}\n`;
        } else if (card.componentType === 'capacitor') {
          netlist += `C${card.instanceNumber || 1} ${getPinNode(card.id, 'left')} ${getPinNode(card.id, 'right')} ${formatEngineering(card.value)}\n`;
        } else if (card.componentType === 'inductor') {
          netlist += `L${card.instanceNumber || 1} ${getPinNode(card.id, 'left')} ${getPinNode(card.id, 'right')} ${formatEngineering(card.value)}\n`;
        } else if (card.componentType === 'voltage') {
          netlist += `V${card.instanceNumber || 1} ${getPinNode(card.id, 'left')} ${getPinNode(card.id, 'right')} DC ${formatEngineering(card.value)}\n`;
        }
      });
      netlist += `.op\n.backanno\n.end\n`;
      setSpiceNetlist(netlist);

    } catch (err) {
      console.error('Failed to run SPICE simulation:', err);
    }
  }, [elements, isOpen]);

  const handleCopyNetlist = () => {
    try {
      navigator.clipboard.writeText(spiceNetlist);
      if (setToast) {
        setToast({ message: '📋 SPICE Netlist copied to clipboard!', type: 'success' });
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (!isOpen) return null;

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
            width: '460px',
            height: '380px',
            background: 'rgba(15, 23, 42, 0.93)',
            border: '1.5px solid var(--theme-sapphire)',
            boxShadow: '0 20px 45px rgba(0, 0, 0, 0.6), 0 0 20px var(--theme-sapphire-glow)',
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px', borderBottom: '1px solid var(--border-subtle)', background: 'rgba(255, 255, 255, 0.02)' }}>
            <h4 style={{ margin: 0, fontSize: '13.5px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--theme-sapphire)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ stroke: 'var(--theme-sapphire)' }}>
                <polygon points="12 2 2 22 22 22 12 2"/>
                <path d="M12 17v-4"/>
                <path d="M12 9h.01"/>
              </svg>
              ⚡ Live Simulation Engine
            </h4>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', color: 'rgba(255, 255, 255, 0.4)', cursor: 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              &times;
            </button>
          </div>

          {/* Sub tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', padding: '0 12px', background: 'rgba(0, 0, 0, 0.15)' }}>
            <button
              onClick={() => setActiveSubTab('dc')}
              style={{
                padding: '8px 12px',
                background: 'none',
                border: 'none',
                color: activeSubTab === 'dc' ? 'var(--theme-sapphire)' : 'rgba(255,255,255,0.5)',
                fontWeight: activeSubTab === 'dc' ? 'bold' : 'normal',
                fontSize: '11px',
                cursor: 'pointer',
                borderBottom: activeSubTab === 'dc' ? '2px solid var(--theme-sapphire)' : 'none'
              }}
            >
              DC Operating Pt
            </button>
            <button
              onClick={() => setActiveSubTab('ac')}
              style={{
                padding: '8px 12px',
                background: 'none',
                border: 'none',
                color: activeSubTab === 'ac' ? 'var(--theme-sapphire)' : 'rgba(255,255,255,0.5)',
                fontWeight: activeSubTab === 'ac' ? 'bold' : 'normal',
                fontSize: '11px',
                cursor: 'pointer',
                borderBottom: activeSubTab === 'ac' ? '2px solid var(--theme-sapphire)' : 'none'
              }}
            >
              AC Bode Plot
            </button>
            <button
              onClick={() => setActiveSubTab('netlist')}
              style={{
                padding: '8px 12px',
                background: 'none',
                border: 'none',
                color: activeSubTab === 'netlist' ? 'var(--theme-sapphire)' : 'rgba(255,255,255,0.5)',
                fontWeight: activeSubTab === 'netlist' ? 'bold' : 'normal',
                fontSize: '11px',
                cursor: 'pointer',
                borderBottom: activeSubTab === 'netlist' ? '2px solid var(--theme-sapphire)' : 'none'
              }}
            >
              SPICE Netlist
            </button>
          </div>

          {/* Tab Contents */}
          <div style={{ flex: 1, padding: '16px', overflowY: 'auto', minHeight: 0 }}>
            {activeSubTab === 'dc' && (
              <div>
                <div style={{ fontSize: '11.5px', color: 'rgba(255,255,255,0.5)', marginBottom: '12px' }}>
                  Modified Nodal Analysis (MNA) matrix solver results:
                </div>
                
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)', textAlign: 'left' }}>
                      <th style={{ padding: '6px 8px' }}>Electrical Node</th>
                      <th style={{ padding: '6px 8px' }}>DC Voltage</th>
                      <th style={{ padding: '6px 8px' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.keys(dcVoltages).map((node) => (
                      <tr key={node} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', color: '#ffffff' }}>
                        <td style={{ padding: '6px 8px', fontWeight: 'bold' }}>
                          Node {node} {node === '0' && <span style={{ fontSize: '10px', color: 'var(--theme-emerald)' }}>(GND)</span>}
                        </td>
                        <td style={{ padding: '6px 8px', fontFamily: 'monospace', color: 'var(--theme-amber)' }}>
                          {dcVoltages[node].toFixed(3)} V
                        </td>
                        <td style={{ padding: '6px 8px', fontSize: '10.5px', color: 'rgba(255,255,255,0.4)' }}>
                          {node === '0' ? 'Reference' : 'Active'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeSubTab === 'ac' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {filterStats && (
                  <div style={{ fontSize: '12px', background: 'rgba(255,255,255,0.03)', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ fontWeight: 'bold', color: 'var(--theme-sapphire)' }}>{filterStats.type}</div>
                    <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', marginTop: '2px' }}>
                      Corner Frequency ($f_c$): <span style={{ color: 'var(--theme-amber)', fontFamily: 'monospace' }}>{filterStats.fc.toFixed(2)} Hz</span>
                    </div>
                  </div>
                )}

                {/* Custom SVG Bode Plot (1Hz to 1MHz) */}
                <div style={{ width: '100%', height: '140px', background: '#0a0d14', border: '1.5px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', padding: '10px', boxSizing: 'border-box', position: 'relative' }}>
                  <svg width="100%" height="100%" viewBox="0 0 350 120" style={{ overflow: 'visible' }}>
                    {/* Grid Lines */}
                    <line x1="20" y1="10" x2="330" y2="10" stroke="rgba(255,255,255,0.08)" strokeDasharray="2,2" />
                    <line x1="20" y1="60" x2="330" y2="60" stroke="rgba(255,255,255,0.08)" strokeDasharray="2,2" />
                    <line x1="20" y1="110" x2="330" y2="110" stroke="rgba(255,255,255,0.15)" />
                    <line x1="20" y1="10" x2="20" y2="110" stroke="rgba(255,255,255,0.15)" />

                    {/* Magnitude Curve (Log scale approximation) */}
                    <path
                      d="M 20 15 Q 120 15 200 45 T 330 108"
                      fill="none"
                      stroke="var(--theme-sapphire)"
                      strokeWidth="2.2"
                    />
                    
                    {/* Phase Curve */}
                    <path
                      d="M 20 60 C 100 60 160 80 200 100 T 330 110"
                      fill="none"
                      stroke="var(--theme-coral)"
                      strokeWidth="1.5"
                      strokeDasharray="4,2"
                    />

                    {/* Corner Marker */}
                    <circle cx="200" cy="45" r="4.5" fill="var(--theme-amber)" />
                    <line x1="200" y1="10" x2="200" y2="110" stroke="rgba(245, 158, 11, 0.3)" strokeDasharray="2,2" />

                    {/* X labels */}
                    <text x="20" y="120" fill="rgba(255,255,255,0.4)" fontSize="8">1Hz</text>
                    <text x="200" y="120" fill="var(--theme-amber)" fontSize="8" fontWeight="bold">fc</text>
                    <text x="330" y="120" fill="rgba(255,255,255,0.4)" fontSize="8" textAnchor="end">1MHz</text>

                    {/* Y labels */}
                    <text x="15" y="14" fill="var(--theme-sapphire)" fontSize="8" textAnchor="end">0dB</text>
                    <text x="15" y="63" fill="var(--theme-sapphire)" fontSize="8" textAnchor="end">-3dB</text>
                    <text x="15" y="112" fill="var(--theme-sapphire)" fontSize="8" textAnchor="end">-40dB</text>
                  </svg>
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', fontSize: '10px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--theme-sapphire)' }}>
                    <span style={{ width: '10px', height: '2px', background: 'var(--theme-sapphire)', display: 'inline-block' }} /> Magnitude (dB)
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--theme-coral)' }}>
                    <span style={{ width: '10px', height: '2px', background: 'var(--theme-coral)', borderStyle: 'dashed', display: 'inline-block' }} /> Phase (&deg;)
                  </span>
                </div>
              </div>
            )}

            {activeSubTab === 'netlist' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', height: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>SPICE Deck Netlist format:</div>
                  <button
                    onClick={handleCopyNetlist}
                    style={{
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: 'none',
                      borderRadius: '4px',
                      color: '#fff',
                      fontSize: '10px',
                      padding: '4px 8px',
                      cursor: 'pointer',
                      fontWeight: 500,
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'}
                  >
                    Copy netlist
                  </button>
                </div>
                
                <textarea
                  readOnly
                  value={spiceNetlist}
                  style={{
                    width: '100%',
                    flex: 1,
                    minHeight: '120px',
                    background: '#090a0f',
                    border: '1.5px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '8px',
                    padding: '12px',
                    color: '#34d399',
                    fontFamily: 'monospace',
                    fontSize: '11px',
                    resize: 'none',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </>,
    document.body
  );
};
