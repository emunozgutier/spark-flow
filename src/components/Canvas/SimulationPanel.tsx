import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { CanvasElement, CardElement, ArrowElement } from '../../dataTypes/AnotateType';
import { formatEngineering } from '../../utils/math';
import { solveLinearSystem } from '../../sim/components/mnaSolver';

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


export const SimulationPanel: React.FC<SimulationPanelProps> = ({
  elements,
  isOpen,
  onClose,
  setToast
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'dc' | 'ac' | 'netlist' | 'nma'>('dc');
  const [dcVoltages, setDcVoltages] = useState<Record<string, number>>({});
  const [spiceNetlist, setSpiceNetlist] = useState<string>('');
  const [filterStats, setFilterStats] = useState<{ type: string; fc: number } | null>(null);
  const [nmaStep, setNmaStep] = useState<number>(0);

  // Fetch values from elements for educational MNA walkthrough
  const r1Card = elements.find(
    (el) => el.type === 'box' && (el as CardElement).componentType === 'resistor' && (el as CardElement).instanceNumber === 1
  ) as CardElement | undefined;
  const r2Card = elements.find(
    (el) => el.type === 'box' && (el as CardElement).componentType === 'resistor' && (el as CardElement).instanceNumber === 2
  ) as CardElement | undefined;
  const v1Card = elements.find(
    (el) => el.type === 'box' && (el as CardElement).componentType === 'voltage' && (el as CardElement).instanceNumber === 1
  ) as CardElement | undefined;

  const r1Val = r1Card?.value !== undefined ? r1Card.value : 190.0;
  const r2Val = r2Card?.value !== undefined ? r2Card.value : 300.0;
  const v1Val = v1Card?.value !== undefined ? v1Card.value : 5.0;

  const solvedV1 = (r1Val / (r1Val + r2Val)) * v1Val;
  const solvedIV1mA = -(v1Val / (r1Val + r2Val)) * 1000;
  const g1 = 1 / r1Val;
  const g2 = 1 / r2Val;


  const variableLabels = nmaStep === 5
    ? [
        '0.00 V',
        `${solvedV1.toFixed(2)} V`,
        `${v1Val.toFixed(2)} V`,
        `${solvedIV1mA.toFixed(2)}mA`
      ]
    : ['V0', 'V1', 'V2', 'i(V1)'];

  const nmaSteps = [
    {
      title: 'Step 1: Size & Labels',
      desc: `We construct a 4x4 Modified Nodal Analysis (MNA) matrix system to solve for the unknown node voltages V0, V1, V2, and the voltage source branch current i(V1). The variables vector is [V0, V1, V2, i(V1)]. All cells start at 0.`,
      matrix: [
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0]
      ],
      rhs: [0, 0, 0, 0],
      highlights: [] as string[]
    },
    {
      title: 'Step 2a: Add R1 Stamp',
      desc: `Resistor R1 (${r1Val} ohms, conductance g1 = ${g1.toFixed(5)} S) connects Node 1 and Node 0. We apply the standard resistor stamp: +g1 on diagonals (Row 0 Col 0, Row 1 Col 1) and -g1 on cross-terms (Row 0 Col 1, Row 1 Col 0).`,
      matrix: [
        [g1, -g1, 0, 0],
        [-g1, g1, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0]
      ],
      rhs: [0, 0, 0, 0],
      highlights: ['0-0', '0-1', '1-0', '1-1']
    },
    {
      title: 'Step 2b: Add R2 Stamp',
      desc: `Resistor R2 (${r2Val} ohms, conductance g2 = ${g2.toFixed(5)} S) connects Node 1 and Node 2. We apply the resistor stamp: +g2 on diagonals (Row 1 Col 1, Row 2 Col 2) and -g2 on cross-terms (Row 1 Col 2, Row 2 Col 1).`,
      matrix: [
        [g1, -g1, 0, 0],
        [-g1, g1 + g2, -g2, 0],
        [0, -g2, g2, 0],
        [0, 0, 0, 0]
      ],
      rhs: [0, 0, 0, 0],
      highlights: ['1-1', '1-2', '2-1', '2-2']
    },
    {
      title: 'Step 2c: Add V1 MNA Stamp',
      desc: `Voltage source V1 (${v1Val}V) connects Node 2 (+) to Node 0 (-) introducing branch current i(V1). It stamps: m[v+][i] = +1 (Row 2 Col 3) and m[v-][i] = -1 (Row 0 Col 3) in KCL, and m[i][v+] = 1 (Row 3 Col 2) and m[i][v-] = -1 (Row 3 Col 0) in the branch relation V2 - V0 = ${v1Val}V, with RHS Row 3 = ${v1Val}.`,
      matrix: [
        [g1, -g1, 0, -1],
        [-g1, g1 + g2, -g2, 0],
        [0, -g2, g2, 1],
        [-1, 0, 1, 0]
      ],
      rhs: [0, 0, 0, v1Val],
      highlights: ['0-3', '2-3', '3-0', '3-2', 'rhs-3']
    },
    {
      title: 'Step 3: Ground Constraint',
      desc: `To solve the singular system, we substitute Ground V0 = 0, overwriting Row 0 with [1, 0, 0, 0] and RHS Row 0 with 0 (enforcing the equation 1*V0 = 0).`,
      matrix: [
        [1, 0, 0, 0],
        [-g1, g1 + g2, -g2, 0],
        [0, -g2, g2, 1],
        [-1, 0, 1, 0]
      ],
      rhs: [0, 0, 0, v1Val],
      highlights: ['0-0', '0-1', '0-2', '0-3', 'rhs-0']
    },
    {
      title: 'Step 4: Solved Variables',
      desc: `Solving the complete 4x4 matrix equation yields the exact electrical values for all of our unknown variables: voltages V0, V1, V2, and the branch current i(V1). The solved values are populated in the variables vector below.`,
      matrix: [
        [1, 0, 0, 0],
        [-g1, g1 + g2, -g2, 0],
        [0, -g2, g2, 1],
        [-1, 0, 1, 0]
      ],
      rhs: [0, 0, 0, v1Val],
      highlights: [] as string[]
    }
  ];



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
            width: '680px',
            height: '480px',
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
            <button
              onClick={() => setActiveSubTab('nma')}
              style={{
                padding: '8px 12px',
                background: 'none',
                border: 'none',
                color: activeSubTab === 'nma' ? 'var(--theme-sapphire)' : 'rgba(255,255,255,0.5)',
                fontWeight: activeSubTab === 'nma' ? 'bold' : 'normal',
                fontSize: '11px',
                cursor: 'pointer',
                borderBottom: activeSubTab === 'nma' ? '2px solid var(--theme-sapphire)' : 'none'
              }}
            >
              MNA Walkthrough
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

            {activeSubTab === 'nma' && (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '12px' }}>
                {/* Step selector progress bar */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '6px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--theme-sapphire)' }}>
                    {nmaSteps[nmaStep].title}
                  </span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {nmaSteps.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setNmaStep(idx)}
                        style={{
                          width: '22px',
                          height: '22px',
                          borderRadius: '50%',
                          border: 'none',
                          background: nmaStep === idx ? 'var(--theme-sapphire)' : 'rgba(255,255,255,0.08)',
                          color: '#fff',
                          fontSize: '10px',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: nmaStep === idx ? '0 0 8px var(--theme-sapphire-glow)' : 'none',
                          transition: 'background 0.2s, box-shadow 0.2s'
                        }}
                      >
                        {idx + 1}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Explanation Box */}
                <div style={{
                  fontSize: '11px',
                  lineHeight: '1.5',
                  color: 'rgba(255, 255, 255, 0.75)',
                  background: 'rgba(15, 23, 42, 0.4)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  height: '66px',
                  overflowY: 'auto'
                }}>
                  {nmaSteps[nmaStep].desc}
                </div>

                {/* Grid bracket math equations viewer */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  margin: '8px 0',
                  fontFamily: 'monospace',
                  fontSize: '11px',
                  background: 'rgba(0,0,0,0.1)',
                  padding: '12px 10px',
                  borderRadius: '10px',
                  border: '1px solid rgba(255,255,255,0.03)'
                }}>
                  {/* Matrix A with Brackets */}
                  <div style={{
                    display: 'flex',
                    borderLeft: '1.5px solid rgba(255,255,255,0.3)',
                    borderRight: '1.5px solid rgba(255,255,255,0.3)',
                    borderRadius: '4px',
                    padding: '2px 6px',
                    background: 'rgba(255, 255, 255, 0.01)'
                  }}>
                    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${nmaSteps[nmaStep].matrix[0].length}, 56px)`, gap: '4px', textAlign: 'center' }}>
                      {nmaSteps[nmaStep].matrix.map((row, rIdx) =>
                        row.map((val, cIdx) => {
                          const isHighlighted = nmaSteps[nmaStep].highlights.includes(`${rIdx}-${cIdx}`);
                          return (
                            <div
                              key={`${rIdx}-${cIdx}`}
                              style={{
                                padding: '5px 2px',
                                background: isHighlighted ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255,255,255,0.02)',
                                border: isHighlighted ? '1px solid var(--theme-amber)' : '1px solid rgba(255,255,255,0.04)',
                                borderRadius: '4px',
                                color: isHighlighted ? 'var(--theme-amber)' : '#ffffff',
                                fontWeight: isHighlighted ? 'bold' : 'normal',
                                fontSize: '10.5px'
                              }}
                            >
                              {val.toFixed(4)}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  <div style={{ color: 'rgba(255,255,255,0.4)', padding: '0 2px', fontSize: '12px' }}>&bull;</div>

                  {/* Variables Vector X with Brackets */}
                  <div style={{
                    display: 'flex',
                    borderLeft: '1.5px solid rgba(255,255,255,0.3)',
                    borderRight: '1.5px solid rgba(255,255,255,0.3)',
                    borderRadius: '4px',
                    padding: '2px 6px',
                    background: 'rgba(255, 255, 255, 0.01)'
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', justifyContent: 'center' }}>
                      {variableLabels.map((vLabel) => (
                        <div
                          key={vLabel}
                          style={{
                            width: nmaStep === 5 ? '60px' : '42px',
                            padding: '5px 0',
                            background: nmaStep === 5 ? 'rgba(52, 211, 153, 0.1)' : 'rgba(255,255,255,0.03)',
                            border: nmaStep === 5 ? '1px solid var(--theme-emerald)' : '1px solid rgba(255,255,255,0.06)',
                            borderRadius: '4px',
                            color: nmaStep === 5 ? 'var(--theme-emerald)' : 'var(--theme-sapphire)',
                            textAlign: 'center',
                            fontWeight: 'bold',
                            fontSize: nmaStep === 5 ? '9px' : '10px'
                          }}
                        >
                          {vLabel}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ color: 'rgba(255,255,255,0.4)', padding: '0 2px', fontSize: '12px' }}>=</div>

                  {/* RHS Vector B with Brackets */}
                  <div style={{
                    display: 'flex',
                    borderLeft: '1.5px solid rgba(255,255,255,0.3)',
                    borderRight: '1.5px solid rgba(255,255,255,0.3)',
                    borderRadius: '4px',
                    padding: '2px 6px',
                    background: 'rgba(255, 255, 255, 0.01)'
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', justifyContent: 'center' }}>
                      {nmaSteps[nmaStep].rhs.map((rhsVal, rIdx) => {
                        const isHighlighted = nmaSteps[nmaStep].highlights.includes(`rhs-${rIdx}`);
                        return (
                          <div
                            key={rIdx}
                            style={{
                              width: '46px',
                              padding: '5px 0',
                              background: isHighlighted ? 'rgba(244, 63, 94, 0.15)' : 'rgba(255,255,255,0.02)',
                              border: isHighlighted ? '1px solid var(--theme-coral)' : '1px solid rgba(255,255,255,0.04)',
                              borderRadius: '4px',
                              color: isHighlighted ? 'var(--theme-coral)' : '#ffffff',
                              textAlign: 'center',
                              fontWeight: isHighlighted ? 'bold' : 'normal',
                              fontSize: '10.5px'
                            }}
                          >
                            {rhsVal.toFixed(2)}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Final step voltage divider numerical solutions */}
                {nmaStep === 5 && (
                  <div style={{
                    background: 'rgba(52, 211, 153, 0.04)',
                    border: '1px solid rgba(52, 211, 153, 0.12)',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    fontSize: '10.5px'
                  }}>
                    <div style={{ color: 'var(--theme-emerald)', fontWeight: 'bold', marginBottom: '4px', fontSize: '11px' }}>
                      🏁 Complete MNA Solutions (Voltage & Branch Current):
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'rgba(255,255,255,0.85)', fontFamily: 'monospace', marginBottom: '4px' }}>
                      <div>V0 (GND) = <span style={{ color: '#fff', fontWeight: 'bold' }}>0.000 V</span></div>
                      <div>V2 (Source) = <span style={{ color: '#fff', fontWeight: 'bold' }}>{v1Val.toFixed(3)} V</span></div>
                      <div>V1 (Divider) = <span style={{ color: '#fff', fontWeight: 'bold' }}>{((r1Val / (r1Val + r2Val)) * v1Val).toFixed(3)} V</span></div>
                    </div>
                    <div style={{ color: 'rgba(255,255,255,0.85)', fontFamily: 'monospace', fontSize: '10.5px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '4px', textAlign: 'center' }}>
                      i(V1) Branch Current = <span style={{ color: 'var(--theme-coral)', fontWeight: 'bold' }}>-{((v1Val / (r1Val + r2Val)) * 1000).toFixed(3)} mA</span> ({(-v1Val / (r1Val + r2Val)).toExponential(3)} A)
                    </div>
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '8.5px', marginTop: '4px', textAlign: 'center' }}>
                      Formulas: V1 = V2 * R1 / (R1 + R2), i(V1) = -V2 / (R1 + R2)
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>,
    document.body
  );
};
