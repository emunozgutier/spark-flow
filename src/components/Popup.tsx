import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { CanvasElement, CardElement, ArrowElement } from '../dataTypes/AnotateType';
import { formatEngineering } from '../utils/math';
import { solveLinearSystem } from '../sim/components/mnaSolver';
import { SimlationTabs } from './Popup/SimlationTabs';

interface PopupProps {
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

export const Popup: React.FC<PopupProps> = ({
  elements,
  isOpen,
  onClose,
  setToast
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'dc' | 'netlist' | 'nma'>('dc');
  const [dcVoltages, setDcVoltages] = useState<Record<string, number>>({});
  const [spiceNetlist, setSpiceNetlist] = useState<string>('');

  useEffect(() => {
    if (!isOpen) return;

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
      const isJoin = card.id.startsWith('join') || card.title === 'join';
      const portsList = isGround ? ['top'] : (isJoin ? ['top', 'right', 'bottom', 'left'] : ['left', 'right']);
      
      portsList.forEach((socket) => {
        const pin = `${card.id}-${socket}`;
        const root = uf.find(pin);
        if (!groups[root]) groups[root] = [];
        groups[root].push(pin);
      });
    });

    // Identify all ground roots
    const gndRoots = new Set<string>();
    Object.keys(groups).forEach((root) => {
      const hasGndPin = groups[root].some((pin) => {
        const cardId = pin.substring(0, pin.lastIndexOf('-'));
        const card = cards.find((c) => c.id === cardId);
        return card?.componentType === 'ground';
      });
      if (hasGndPin) {
        gndRoots.add(root);
      }
    });

    // Map roots to standard SPICE node numbers (GND is always "0")
    const rootToNodeName: Record<string, string> = {};
    let nodeCounter = 1;
    
    gndRoots.forEach((root) => {
      rootToNodeName[root] = '0';
    });

    // Fallback: If no ground component is present, use the first node group as virtual ground
    if (gndRoots.size === 0 && Object.keys(groups).length > 0) {
      const defaultGnd = Object.keys(groups)[0];
      rootToNodeName[defaultGnd] = '0';
      gndRoots.add(defaultGnd);
    }

    // Map remaining nodes
    Object.keys(groups).forEach((root) => {
      if (gndRoots.has(root)) return;
      rootToNodeName[root] = String(nodeCounter++);
    });

    // Map pin elements to SPICE nodes
    const getPinNode = (cardId: string, socket: string): string => {
      const root = uf.find(`${cardId}-${socket}`);
      return rootToNodeName[root] || '0';
    };

    // --- 1. SPICE NETLIST COMPILING ---
    try {
      let netlist = `* SparkFlow Live SPICE Netlist\n`;
      cards.forEach((card) => {
        if (card.componentType === 'resistor') {
          const g2Str = card.isGroup2 ? ' G2' : '';
          netlist += `R${card.instanceNumber || 1} ${getPinNode(card.id, 'left')} ${getPinNode(card.id, 'right')} ${formatEngineering(card.value)}${g2Str}\n`;
        } else if (card.componentType === 'capacitor') {
          netlist += `C${card.instanceNumber || 1} ${getPinNode(card.id, 'left')} ${getPinNode(card.id, 'right')} ${formatEngineering(card.value)}\n`;
        } else if (card.componentType === 'inductor') {
          netlist += `L${card.instanceNumber || 1} ${getPinNode(card.id, 'left')} ${getPinNode(card.id, 'right')} ${formatEngineering(card.value)}\n`;
        } else if (card.componentType === 'voltage') {
          netlist += `V${card.instanceNumber || 1} ${getPinNode(card.id, 'left')} ${getPinNode(card.id, 'right')} DC ${formatEngineering(card.value)}\n`;
        } else if (card.componentType === 'current') {
          netlist += `I${card.instanceNumber || 1} ${getPinNode(card.id, 'left')} ${getPinNode(card.id, 'right')} DC ${formatEngineering(card.value)}\n`;
        }
      });
      netlist += `.op\n.backanno\n.end\n`;
      setSpiceNetlist(netlist);
    } catch (netlistErr) {
      console.error('Failed to compile SPICE Netlist:', netlistErr);
    }

    // --- 2. ELECTRICAL GRID SOLVER ---
    try {
      const nodeCount = nodeCounter - 1; // Nodes 1 to N
      const voltageSources = cards.filter((c) => c.componentType === 'voltage');
      const group2Resistors = cards.filter((c) => c.componentType === 'resistor' && c.isGroup2);
      const mnaSize = nodeCount + voltageSources.length + group2Resistors.length;

      const A = Array.from({ length: mnaSize }, () => new Array(mnaSize).fill(0));
      const B = new Array(mnaSize).fill(0);

      // Map Group 2 elements to their indices in MNA
      const g2ElementMap: Record<string, number> = {};
      let g2Index = nodeCount;
      voltageSources.forEach((vSrc) => {
        g2ElementMap[vSrc.id] = g2Index++;
      });
      group2Resistors.forEach((rGrp2) => {
        g2ElementMap[rGrp2.id] = g2Index++;
      });

      // Fill Resistors and Inductors conductances in G matrix
      cards.forEach((card) => {
        if (card.componentType === 'resistor' || card.componentType === 'inductor') {
          const n1Str = getPinNode(card.id, 'left');
          const n2Str = getPinNode(card.id, 'right');
          const n1 = parseInt(n1Str, 10);
          const n2 = parseInt(n2Str, 10);
          
          let rVal = 1000;
          if (card.componentType === 'inductor') {
            rVal = 1e-3; // Inductor acts as a short circuit in DC
          } else {
            rVal = card.value !== undefined ? (card.value <= 0 ? 1e-3 : card.value) : 1000;
          }

          if (card.componentType === 'resistor' && card.isGroup2) {
            const idx = g2ElementMap[card.id];
            if (n1 > 0) A[n1 - 1][idx] += 1;
            if (n2 > 0) A[n2 - 1][idx] -= 1;
            if (n1 > 0) A[idx][n1 - 1] += 1;
            if (n2 > 0) A[idx][n2 - 1] -= 1;
            A[idx][idx] -= rVal;
          } else {
            const g = 1 / rVal;
            if (n1 > 0) A[n1 - 1][n1 - 1] += g;
            if (n2 > 0) A[n2 - 1][n2 - 1] += g;
            if (n1 > 0 && n2 > 0) {
              A[n1 - 1][n2 - 1] -= g;
              A[n2 - 1][n1 - 1] -= g;
            }
          }
        }
      });

      // Fill Voltage sources in MNA
      voltageSources.forEach((vSrc) => {
        const n1Str = getPinNode(vSrc.id, 'left');  // + terminal
        const n2Str = getPinNode(vSrc.id, 'right'); // - terminal
        const n1 = parseInt(n1Str, 10);
        const n2 = parseInt(n2Str, 10);
        const val = vSrc.value !== undefined ? vSrc.value : 5;
        const idx = g2ElementMap[vSrc.id];

        // B matrix coefficients
        if (n1 > 0) A[n1 - 1][idx] += 1;
        if (n2 > 0) A[n2 - 1][idx] -= 1;

        // C matrix coefficients (Transpose of B)
        if (n1 > 0) A[idx][n1 - 1] += 1;
        if (n2 > 0) A[idx][n2 - 1] -= 1;

        // Voltage values
        B[idx] = val;
      });

      // Fill Current sources in MNA (Group 1 - stamp RHS only)
      cards.forEach((card) => {
        if (card.componentType === 'current') {
          const n1Str = getPinNode(card.id, 'left');  // positive node (leaves)
          const n2Str = getPinNode(card.id, 'right'); // negative node (enters)
          const n1 = parseInt(n1Str, 10);
          const n2 = parseInt(n2Str, 10);
          const val = card.value !== undefined ? card.value : 0.001; // default 1mA

          if (n1 > 0) B[n1 - 1] -= val;
          if (n2 > 0) B[n2 - 1] += val;
        }
      });

      // Solve System: A * X = B
      const X = mnaSize > 0 ? solveLinearSystem(A, B) : [];
      
      const voltages: Record<string, number> = { '0': 0 };
      for (let i = 1; i <= nodeCount; i++) {
        voltages[String(i)] = X[i - 1] || 0;
      }
      setDcVoltages(voltages);
    } catch (err) {
      console.error('Failed to run SPICE simulation:', err);
    }
  }, [elements, isOpen]);

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

          {/* Sub tabs navigation & contents */}
          <SimlationTabs
            activeSubTab={activeSubTab}
            setActiveSubTab={setActiveSubTab}
            dcVoltages={dcVoltages}
            spiceNetlist={spiceNetlist}
            elements={elements}
            setToast={setToast}
          />
        </div>
      </div>
    </>,
    document.body
  );
};
