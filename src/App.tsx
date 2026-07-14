import { useEffect, useState, useMemo, useRef } from 'react';
import { useCanvas } from './store/useCanvas';
import { useZoom } from './store/useZoom';
import { KeyListner } from './components/ZoomControl/KeyListner';
import { Canvas } from './components/Canvas';
import { TopBar } from './components/TopBar';
import { ZoomControl } from './components/ZoomControl';
import { SettingsSideMenu } from './components/SettingsSideMenu';
import { Cursor } from './components/Cursor';
import type { CanvasElement, CardElement, ArrowElement } from './dataTypes/AnotateType';
import { formatEngineering } from './utils/math';
import { Spice } from './sim/Spice';
import './App.css';

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


function App() {
  const {
    elements,
    selectedId,
    selectedIds,
    activeTool,
    setActiveTool,
    setSelectedId,
    setSelectedIds,
    addCard,
    addArrow,
    updateElement,
    updateCardPosition,
    updateCardSize,
    finalizeDrag,
    deleteElement,
    clearCanvas,
    loadElements,
    undo,
    redo,
    canUndo,
    canRedo,
    liveDCOn,
  } = useCanvas();

  const {
    zoom,
    offset,
    setZoom,
    setOffset,
    zoomIn,
    zoomOut,
    resetView,
    fitView,
  } = useZoom();

  const selectedElement = elements.find((el: CanvasElement) => el.id === selectedId) || null;
  const lastShiftLeft = useRef<number>(0);

  // Auto-shift components horizontally to prevent sidebar coverage
  useEffect(() => {
    if (selectedId) {
      const selected = elements.find((el) => el.id === selectedId);
      if (selected && selected.type === 'box') {
        const card = selected as CardElement;
        
        // Calculate the card's right edge in screen coordinates
        const cardRightLocal = card.x + card.width;
        const cardRightScreen = cardRightLocal * zoom + offset.x;

        // Left edge of the sidebar on screen (320px sidebar + 24px right spacing + 16px safety margin)
        const sidebarLeft = window.innerWidth - 360;

        if (cardRightScreen > sidebarLeft) {
          const shift = cardRightScreen - sidebarLeft;
          lastShiftLeft.current = shift;
          setOffset({ x: offset.x - shift, y: offset.y });
        } else {
          lastShiftLeft.current = 0;
        }
      }
    } else if (lastShiftLeft.current > 0) {
      // Shift back to the right when deselected
      setOffset({ x: offset.x + lastShiftLeft.current, y: offset.y });
      lastShiftLeft.current = 0;
    }
  }, [selectedId]);

  // --- REAL-TIME MNA DC OPERATING POINT SOLVER & WIRE CURRENTS & VOLTAGES ---
  const { solvedDCOperatingPoint, wireCurrents, wireVoltages } = useMemo(() => {
    if (!liveDCOn) return { solvedDCOperatingPoint: {} as Record<string, any>, wireCurrents: {} as Record<string, number>, wireVoltages: {} as Record<string, number> };
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
        const isJoin = card.id.startsWith('join') || card.title === 'join';
        const isBjt = card.componentType === 'bjt' || card.componentType === 'mosfet';
        const portsList = isGround ? ['top'] : (isJoin ? ['top', 'right', 'bottom', 'left'] : (isBjt ? ['left', 'top', 'bottom'] : ['left', 'right']));
        
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

      const rootToNodeName: Record<string, string> = {};
      let nodeCounter = 1;
      
      gndRoots.forEach((root) => {
        rootToNodeName[root] = '0';
      });

      if (gndRoots.size === 0 && Object.keys(groups).length > 0) {
        const defaultGnd = Object.keys(groups)[0];
        rootToNodeName[defaultGnd] = '0';
        gndRoots.add(defaultGnd);
      }

      Object.keys(groups).forEach((root) => {
        if (gndRoots.has(root)) return;
        rootToNodeName[root] = String(nodeCounter++);
      });

      const getPinNode = (cardId: string, socket: string): string => {
        const root = uf.find(`${cardId}-${socket}`);
        return rootToNodeName[root] || '0';
      };

      const nodeCount = nodeCounter - 1;

      // Compile netlist string
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
        } else if (card.componentType === 'acvoltage') {
          netlist += `Vac${card.instanceNumber || 1} ${getPinNode(card.id, 'left')} ${getPinNode(card.id, 'right')} AC ${formatEngineering(card.value)} ${formatEngineering(card.frequency ?? 60)}\n`;
        } else if (card.componentType === 'current') {
          netlist += `I${card.instanceNumber || 1} ${getPinNode(card.id, 'left')} ${getPinNode(card.id, 'right')} DC ${formatEngineering(card.value)}\n`;
        } else if (card.componentType === 'diode') {
          netlist += `D${card.instanceNumber || 1} ${getPinNode(card.id, 'left')} ${getPinNode(card.id, 'right')} 1N4148\n`;
        } else if (card.componentType === 'bjt') {
          netlist += `Q${card.instanceNumber || 1} ${getPinNode(card.id, 'top')} ${getPinNode(card.id, 'left')} ${getPinNode(card.id, 'bottom')} NPN\n`;
        } else if (card.componentType === 'mosfet') {
          netlist += `M${card.instanceNumber || 1} ${getPinNode(card.id, 'top')} ${getPinNode(card.id, 'left')} ${getPinNode(card.id, 'bottom')} ${getPinNode(card.id, 'bottom')} NMOS\n`;
        }
      });
      netlist += `.op\n.backanno\n.end\n`;

      let voltages: Record<string, number> = { '0': 0 };
      for (let i = 1; i <= nodeCount; i++) {
        voltages[String(i)] = 0.0;
      }

      const hasNonLinear = cards.some(c => c.componentType === 'diode' || c.componentType === 'bjt' || c.componentType === 'mosfet');
      const maxIterations = hasNonLinear ? 50 : 1;
      const tolerance = 1e-5;
      let solutionVector: any = null;

      for (let iter = 0; iter < maxIterations; iter++) {
        const sim = new Spice(netlist);
        solutionVector = sim.solve(voltages);

        let maxDiff = 0;
        const nextVoltages: Record<string, number> = { '0': 0 };
        for (const dim of solutionVector.dimensions) {
          if (dim.startsWith('V')) {
            const nodeName = dim.substring(1);
            const vOld = voltages[nodeName] || 0;
            const vNew = solutionVector.get(dim);
            nextVoltages[nodeName] = vNew;
            const diff = Math.abs(vNew - vOld);
            if (diff > maxDiff) {
              maxDiff = diff;
            }
          }
        }

        voltages = nextVoltages;

        if (!hasNonLinear || maxDiff < tolerance) {
          break;
        }
      }

      const solvedDCOperatingPoint: Record<string, any> = {};
      cards.forEach((card) => {
        if (!card.componentType) return;
        if (card.componentType === 'ground') {
          solvedDCOperatingPoint[card.id] = { voltageDrop: 0, branchCurrent: 0 };
          return;
        }
        if (card.componentType === 'bjt') {
          const nCStr = getPinNode(card.id, 'top');
          const nBStr = getPinNode(card.id, 'left');
          const nEStr = getPinNode(card.id, 'bottom');
          const vC = voltages[nCStr] || 0;
          const vB = voltages[nBStr] || 0;
          const vE = voltages[nEStr] || 0;
          const vbe = vB - vE;
          const vbc = vB - vC;
          const vbeClamped = Math.max(-1.0, Math.min(0.8, vbe));
          const vbcClamped = Math.max(-1.0, Math.min(0.8, vbc));
          const Is = 1e-14;
          const Vt = 0.026;
          const If = Is * (Math.exp(vbeClamped / Vt) - 1);
          const Ir = Is * (Math.exp(vbcClamped / Vt) - 1);
          const betaF = card.value !== undefined ? card.value : 100;
          const betaR = 1;
          const Ic = If - Ir - Ir / betaR;
          const Ib = If / betaF + Ir / betaR;
          const Ie = -(If + If / betaF - Ir);

          solvedDCOperatingPoint[card.id] = {
            voltageDrop: vC - vE,
            branchCurrent: Math.abs(Ic),
            vLeft: vB,
            vRight: vC,
            vBase: vB,
            vCollector: vC,
            vEmitter: vE,
            iCollector: Ic,
            iBase: Ib,
            iEmitter: Ie,
            signedCurrent: Ic
          };
          return;
        }
        if (card.componentType === 'mosfet') {
          const nDStr = getPinNode(card.id, 'top');
          const nGStr = getPinNode(card.id, 'left');
          const nSStr = getPinNode(card.id, 'bottom');
          const vD = voltages[nDStr] || 0;
          const vG = voltages[nGStr] || 0;
          const vS = voltages[nSStr] || 0;

          const Vth = card.value !== undefined ? card.value : 2.0;
          const beta = 1e-3;
          let Id = 0;

          if (vD >= vS) {
            const vgs = Math.max(-10, Math.min(10, vG - vS));
            const vds = Math.max(0, Math.min(10, vD - vS));
            if (vgs >= Vth) {
              if (vds < vgs - Vth) {
                Id = beta * ((vgs - Vth) * vds - 0.5 * vds * vds);
              } else {
                Id = 0.5 * beta * (vgs - Vth) * (vgs - Vth);
              }
            }
          } else {
            const vgd = Math.max(-10, Math.min(10, vG - vD));
            const vsd = Math.max(0, Math.min(10, vS - vD));
            if (vgd >= Vth) {
              if (vsd < vgd - Vth) {
                Id = -beta * ((vgd - Vth) * vsd - 0.5 * vsd * vsd);
              } else {
                Id = -0.5 * beta * (vgd - Vth) * (vgd - Vth);
              }
            }
          }

          solvedDCOperatingPoint[card.id] = {
            voltageDrop: vD - vS,
            branchCurrent: Math.abs(Id),
            vLeft: vG,
            vRight: vD,
            vGate: vG,
            vDrain: vD,
            vSource: vS,
            iDrain: Id,
            signedCurrent: Id
          };
          return;
        }

        const n1Str = getPinNode(card.id, 'left');
        const n2Str = getPinNode(card.id, 'right');
        const v1 = voltages[n1Str] || 0;
        const v2 = voltages[n2Str] || 0;
        const vDrop = v1 - v2;

        let iBranch = 0;
        if (card.componentType === 'resistor') {
          if (card.isGroup2) {
            const varName = `i_R${card.instanceNumber || 1}`;
            iBranch = solutionVector.get(varName) || 0;
          } else {
            const rVal = card.value !== undefined ? (card.value <= 0 ? 1e-3 : card.value) : 1000;
            iBranch = vDrop / rVal;
          }
        } else if (card.componentType === 'voltage') {
          const varName = `i_V${card.instanceNumber || 1}`;
          iBranch = solutionVector.get(varName) || 0;
        } else if (card.componentType === 'acvoltage') {
          const varName = `i_Vac${card.instanceNumber || 1}`;
          iBranch = solutionVector.get(varName) || 0;
        } else if (card.componentType === 'current') {
          iBranch = card.value !== undefined ? card.value : 0.001;
        } else if (card.componentType === 'capacitor') {
          iBranch = 0;
        } else if (card.componentType === 'inductor') {
          const varName = `i_L${card.instanceNumber || 1}`;
          iBranch = solutionVector.get(varName) || 0;
        } else if (card.componentType === 'diode') {
          const Is = 1e-14;
          const Vt = 0.026;
          const vDropClamped = Math.max(-1.0, Math.min(0.8, vDrop));
          iBranch = Is * (Math.exp(vDropClamped / Vt) - 1);
        }

        const displayVDrop = card.componentType === 'voltage' ? vDrop : Math.abs(vDrop);
        const displayIBranch = Math.abs(iBranch);

        solvedDCOperatingPoint[card.id] = {
          voltageDrop: displayVDrop,
          branchCurrent: displayIBranch,
          vLeft: v1,
          vRight: v2,
          signedCurrent: iBranch
        };
      });

      const joinCards = cards.filter((c) => c.id.startsWith('join') || c.title === 'join');
      const compCards = cards.filter((c) => c.componentType !== undefined);

      const socketKeys: string[] = [];
      compCards.forEach((c) => {
        if (c.componentType === 'ground') {
          socketKeys.push(`${c.id}-top`);
        } else if (c.componentType === 'bjt' || c.componentType === 'mosfet') {
          socketKeys.push(`${c.id}-left`, `${c.id}-top`, `${c.id}-bottom`);
        } else {
          socketKeys.push(`${c.id}-left`, `${c.id}-right`);
        }
      });
      joinCards.forEach((j) => {
        socketKeys.push(`${j.id}-top`, `${j.id}-right`, `${j.id}-bottom`, `${j.id}-left`);
      });

      const nodeMaxCurrents: Record<string, number> = {};
      const getSocketRole = (cardId: string, socket: string) => {
        const card = cards.find((c) => c.id === cardId);
        if (!card || !card.componentType) return { role: 'none', current: 0 };
        if (card.componentType === 'ground') {
          return { role: 'sink', current: 0 };
        }
        if (card.componentType === 'bjt') {
          const solved = solvedDCOperatingPoint[card.id];
          const Ic = solved?.iCollector || 0;
          const Ib = solved?.iBase || 0;
          const Ie = solved?.iEmitter || 0;

          if (socket === 'left') {
            return { role: Ib >= 0 ? 'sink' : 'source', current: Math.abs(Ib) };
          } else if (socket === 'top') {
            return { role: Ic >= 0 ? 'sink' : 'source', current: Math.abs(Ic) };
          } else if (socket === 'bottom') {
            return { role: Ie <= 0 ? 'source' : 'sink', current: Math.abs(Ie) };
          }
          return { role: 'none', current: 0 };
        }
        if (card.componentType === 'mosfet') {
          const solved = solvedDCOperatingPoint[card.id];
          const Id = solved?.iDrain || 0;
          const Is = -Id;

          if (socket === 'left') {
            return { role: 'none', current: 0 };
          } else if (socket === 'top') {
            return { role: Id >= 0 ? 'sink' : 'source', current: Math.abs(Id) };
          } else if (socket === 'bottom') {
            return { role: Is >= 0 ? 'sink' : 'source', current: Math.abs(Is) };
          }
          return { role: 'none', current: 0 };
        }

        const solved = solvedDCOperatingPoint[card.id];
        const signedI = solved?.signedCurrent || 0;
        const branchI = Math.abs(solved?.branchCurrent || 0);

        if (card.componentType === 'capacitor') {
          return { role: 'none', current: 0 };
        }

        if (socket === 'left') {
          return {
            role: signedI > 0 ? 'sink' : signedI < 0 ? 'source' : 'none',
            current: branchI
          };
        } else if (socket === 'right') {
          return {
            role: signedI > 0 ? 'source' : signedI < 0 ? 'sink' : 'none',
            current: branchI
          };
        }
        return { role: 'none', current: 0 };
      };

      Object.keys(groups).forEach((root) => {
        const groupSockets = groups[root];
        let maxNodeCurrent = 0;

        groupSockets.forEach((s) => {
          const lastDash = s.lastIndexOf('-');
          const cardId = s.substring(0, lastDash);
          const socket = s.substring(lastDash + 1);

          const { current } = getSocketRole(cardId, socket);
          maxNodeCurrent = Math.max(maxNodeCurrent, current);
        });

        nodeMaxCurrents[root] = maxNodeCurrent;
      });

      const wireCurrents: Record<string, number> = {};
      arrows.forEach((w) => {
        if (!w.fromId || !w.fromSocket) return;
        const sStart = `${w.fromId}-${w.fromSocket}`;
        const root = uf.find(sStart);
        let current = nodeMaxCurrents[root] || 0;

        const connectedCard = cards.find((c) => c.componentType && (w.fromId === c.id || w.toId === c.id));
        if (connectedCard) {
          const solved = solvedDCOperatingPoint[connectedCard.id];
          if (solved) {
            current = solved.branchCurrent;
          }
        } else if (w.netName === '1' || w.netName?.startsWith('1.')) {
          const r2Card = cards.find((c) => c.componentType === 'resistor' && c.instanceNumber === 2);
          if (r2Card && solvedDCOperatingPoint[r2Card.id]) {
            current = solvedDCOperatingPoint[r2Card.id].branchCurrent;
          }
        }
        wireCurrents[w.id] = current;
      });

      const wireVoltages: Record<string, number> = {};
      arrows.forEach((w) => {
        let pin = '';
        if (w.fromId && w.fromSocket) {
          pin = `${w.fromId}-${w.fromSocket}`;
        } else if (w.toId && w.toSocket) {
          pin = `${w.toId}-${w.toSocket}`;
        }
        if (pin) {
          const root = uf.find(pin);
          const nodeName = rootToNodeName[root] || '0';
          wireVoltages[w.id] = voltages[nodeName] || 0;
        } else {
          wireVoltages[w.id] = 0;
        }
      });

      return { solvedDCOperatingPoint, wireCurrents, wireVoltages };
    } catch (e) {
      console.error("Live DC Solver failed:", e);
      return {
        solvedDCOperatingPoint: {} as Record<string, any>,
        wireCurrents: {} as Record<string, number>,
        wireVoltages: {} as Record<string, number>
      };
    }
  }, [elements, liveDCOn]);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  // Auto-dismiss toast notification after 6 seconds
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [toast]);



  // Keyboard listener is now managed in ZoomControl/KeyListner

  // Export board data as a JSON document
  const handleExportJSON = () => {
    try {
      const dataStr = JSON.stringify(
        {
          elements,
          zoom,
          pan: offset // Kept 'pan' key for backwards-compatibility of backups
        },
        null,
        2
      );
      const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
      
      const exportFileDefaultName = `spark-flow-board-${Date.now()}.json`;
      
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
    } catch (e) {
      console.error('Failed to export JSON:', e);
      alert('Could not export board configuration.');
    }
  };

  // Compile standalone static SVG vector representation of the flow board
  const handleExportSVG = () => {
    try {

      const cards = elements.filter((el: CanvasElement) => el.type === 'box') as CardElement[];
      const arrows = elements.filter((el: CanvasElement) => el.type === 'arrow') as ArrowElement[];

      if (cards.length === 0) {
        alert('Your board is empty. Add some cards before exporting!');
        return;
      }

      // 1. Calculate boundaries of all content to make a perfect viewbox bounding box
      let minX = Infinity, minY = Infinity;
      let maxX = -Infinity, maxY = -Infinity;

      cards.forEach((c) => {
        minX = Math.min(minX, c.x);
        minY = Math.min(minY, c.y);
        maxX = Math.max(maxX, c.x + c.width);
        maxY = Math.max(maxY, c.y + c.height);
      });

      // Expand boundary margins slightly
      const margin = 80;
      minX -= margin;
      minY -= margin;
      maxX += margin;
      maxY += margin;

      const width = maxX - minX;
      const height = maxY - minY;

      // Hex definitions mapping for SVG background rendering
      const hexColors: Record<string, { main: string; glow: string; text: string; bg: string }> = {
        slate: { main: '#64748b', glow: 'rgba(100,116,139,0.3)', text: '#94a3b8', bg: '#10121a' },
        amethyst: { main: '#a855f7', glow: 'rgba(168,85,247,0.3)', text: '#d8b4fe', bg: '#14101a' },
        sapphire: { main: '#3b82f6', glow: 'rgba(59,130,246,0.3)', text: '#93c5fd', bg: '#10141a' },
        emerald: { main: '#10b981', glow: 'rgba(16,185,129,0.3)', text: '#6ee7b7', bg: '#101a14' },
        coral: { main: '#f43f5e', glow: 'rgba(244,63,94,0.3)', text: '#fda4af', bg: '#1a1012' },
        amber: { main: '#f59e0b', glow: 'rgba(245,158,11,0.3)', text: '#fde047', bg: '#1a1810' },
      };

      // Helper function to escape XML text characters
      const escapeXml = (str: string) => {
        return str
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&apos;');
      };

      // 2. Generate SVG items markup
      let arrowMarkup = '';
      arrows.forEach((arrow) => {
        let startPt = arrow.fromPoint || { x: 0, y: 0 };
        let endPt = arrow.toPoint || { x: 0, y: 0 };

        const fromCard = cards.find((c) => c.id === arrow.fromId);
        const toCard = cards.find((c) => c.id === arrow.toId);

        const getSocketPt = (card: CardElement, socket: string) => {
          let basePt = { x: 0, y: 0 };
          if (socket === 'top') basePt = { x: card.x + card.width / 2, y: card.y };
          else if (socket === 'right') basePt = { x: card.x + card.width, y: card.y + card.height / 2 };
          else if (socket === 'bottom') basePt = { x: card.x + card.width / 2, y: card.y + card.height };
          else basePt = { x: card.x, y: card.y + card.height / 2 }; // left

          if (card.rotation && card.rotation !== 0) {
            const cx = card.x + card.width / 2;
            const cy = card.y + card.height / 2;
            const rad = (card.rotation * Math.PI) / 180;
            const cos = Math.cos(rad);
            const sin = Math.sin(rad);
            const dx = basePt.x - cx;
            const dy = basePt.y - cy;
            return {
              x: cx + dx * cos - dy * sin,
              y: cy + dx * sin + dy * cos
            };
          }
          return basePt;
        };

        if (arrow.fromId && fromCard && arrow.fromSocket) {
          startPt = getSocketPt(fromCard, arrow.fromSocket);
        }
        if (arrow.toId && toCard && arrow.toSocket) {
          endPt = getSocketPt(toCard, arrow.toSocket);
        }

        // Curved coordinates logic
        let path = '';
        if (arrow.style === 'straight' || arrow.style === 'dashed') {
          path = `M ${startPt.x} ${startPt.y} L ${endPt.x} ${endPt.y}`;
        } else {
          const dx = Math.abs(endPt.x - startPt.x);
          const dy = Math.abs(endPt.y - startPt.y);
          const offsetDist = Math.max(Math.min(dx, dy) * 0.75, 45);
          
          let cp1 = { ...startPt };
          let cp2 = { ...endPt };
          if (arrow.fromSocket === 'right') cp1.x += offsetDist;
          else if (arrow.fromSocket === 'left') cp1.x -= offsetDist;
          else if (arrow.fromSocket === 'bottom') cp1.y += offsetDist;
          else if (arrow.fromSocket === 'top') cp1.y -= offsetDist;
          else cp1.x += offsetDist;

          if (arrow.toSocket === 'right') cp2.x += offsetDist;
          else if (arrow.toSocket === 'left') cp2.x -= offsetDist;
          else if (arrow.toSocket === 'bottom') cp2.y += offsetDist;
          else if (arrow.toSocket === 'top') cp2.y -= offsetDist;
          else cp2.x -= offsetDist;

          path = `M ${startPt.x} ${startPt.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${endPt.x} ${endPt.y}`;
        }

        let colorHex = hexColors[arrow.color]?.main || '#64748b';
        let arrowheadColor = arrow.color;
        
        if (liveDCOn) {
          const volt = wireVoltages[arrow.id] || 0;
          const maxVolt = Math.max(...Object.values(wireVoltages).map(Math.abs), 1e-5);
          const ratio = Math.min(Math.abs(volt) / maxVolt, 1.0);
          
          const blendColor = (r: number, color1: number[], color2: number[]) => {
            const rgb = color1.map((c, i) => Math.round(c * r + color2[i] * (1 - r)));
            return '#' + rgb.map((x) => x.toString(16).padStart(2, '0')).join('');
          };

          const greyRgb = [100, 116, 139]; // #64748b
          const greenRgb = [16, 185, 129]; // #10b981
          const redRgb = [244, 63, 94];   // #f43f5e

          const blendRatio = 0.35 + Math.sqrt(ratio) * 0.65;

          if (volt > 1e-5) {
            colorHex = blendColor(blendRatio, greenRgb, greyRgb);
            arrowheadColor = 'emerald';
          } else if (volt < -1e-5) {
            colorHex = blendColor(blendRatio, redRgb, greyRgb);
            arrowheadColor = 'coral';
          } else {
            colorHex = '#64748b';
            arrowheadColor = 'slate';
          }
        }

        const isDashed = arrow.style === 'dashed';

        arrowMarkup += `
          <g>
            <path
              d="${path}"
              fill="none"
              stroke="${colorHex}"
              stroke-width="2"
              ${isDashed ? 'stroke-dasharray="6,6"' : ''}
              marker-end="url(#arrowhead-${arrowheadColor})"
            />`;

        if (arrow.label) {
          const midX = (startPt.x + endPt.x) / 2;
          const midY = (startPt.y + endPt.y) / 2;
          const w = (arrow.label.length * 7.5) + 12;
          arrowMarkup += `
            <g>
              <rect x="${midX - w/2}" y="${midY - 8}" width="${w}" height="16" rx="4" fill="#06070a" stroke="#2e303a" stroke-width="1"/>
              <text x="${midX}" y="${midY + 4}" fill="#9ca3af" font-size="10" font-weight="bold" font-family="system-ui, sans-serif" text-anchor="middle">
                ${escapeXml(arrow.label)}
              </text>
            </g>`;
        }
        
        arrowMarkup += `</g>`;
      });

      let cardMarkup = '';
      cards.forEach((card) => {
        const theme = hexColors[card.color] || hexColors.slate;
        
        if (card.componentType) {
          const prefix = card.componentType === 'resistor' ? 'R' : card.componentType === 'capacitor' ? 'C' : card.componentType === 'inductor' ? 'L' : card.componentType === 'voltage' ? 'V' : card.componentType === 'acvoltage' ? 'Vac' : card.componentType === 'current' ? 'I' : card.componentType === 'diode' ? 'D' : card.componentType === 'bjt' ? 'Q' : card.componentType === 'mosfet' ? 'M' : 'GND';
          const compName = `${prefix}${card.instanceNumber || 1}`;
          const compVal = formatEngineering(card.value);

          let symbolPathMarkup = '';
          if (card.componentType === 'resistor') {
            symbolPathMarkup = `<path d="M 0 15 L 20 15 L 25 5 L 35 25 L 45 5 L 55 25 L 65 5 L 75 25 L 80 15 L 100 15" fill="none" stroke="${theme.main}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
          } else if (card.componentType === 'capacitor') {
            symbolPathMarkup = `<path d="M 0 15 L 45 15 M 55 15 L 100 15" fill="none" stroke="${theme.main}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
                                <path d="M 45 5 L 45 25 M 55 5 L 55 25" fill="none" stroke="${theme.main}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
          } else if (card.componentType === 'inductor') {
            symbolPathMarkup = `<path d="M 0 15 L 20 15 C 20 5, 32 5, 32 15 C 32 5, 44 5, 44 15 C 44 5, 56 5, 56 15 C 56 5, 68 5, 68 15 C 68 5, 80 5, 80 15 L 100 15" fill="none" stroke="${theme.main}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
          } else if (card.componentType === 'ground') {
            symbolPathMarkup = `<path d="M 30 0 L 30 25" fill="none" stroke="${theme.main}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
                                <path d="M 20 25 L 40 25" fill="none" stroke="${theme.main}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
                                <path d="M 24 33 L 36 33" fill="none" stroke="${theme.main}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
                                <path d="M 28 41 L 32 41" fill="none" stroke="${theme.main}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`;
          } else if (card.componentType === 'voltage') {
            symbolPathMarkup = `<path d="M 0 15 L 35 15 M 65 15 L 100 15" fill="none" stroke="${theme.main}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
                                <circle cx="50" cy="15" r="15" fill="none" stroke="${theme.main}" stroke-width="3"/>
                                <path d="M 40 15 H 46 M 43 12 V 18" stroke="${theme.main}" stroke-width="2" stroke-linecap="round"/>
                                <path d="M 54 15 H 60" stroke="${theme.main}" stroke-width="2" stroke-linecap="round"/>`;
          } else if (card.componentType === 'acvoltage') {
            symbolPathMarkup = `<path d="M 0 15 L 35 15 M 65 15 L 100 15" fill="none" stroke="${theme.main}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
                                <circle cx="50" cy="15" r="15" fill="none" stroke="${theme.main}" stroke-width="3"/>
                                <path d="M 44 15 Q 47 8, 50 15 T 56 15" fill="none" stroke="${theme.main}" stroke-width="2" stroke-linecap="round"/>
                                <path d="M 38 15 H 42 M 40 13 V 17" stroke="${theme.main}" stroke-width="1.5" stroke-linecap="round"/>
                                <path d="M 58 15 H 62" stroke="${theme.main}" stroke-width="1.5" stroke-linecap="round"/>`;
          } else if (card.componentType === 'current') {
            symbolPathMarkup = `<path d="M 0 15 L 35 15 M 65 15 L 100 15" fill="none" stroke="${theme.main}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
                                <circle cx="50" cy="15" r="15" fill="none" stroke="${theme.main}" stroke-width="3"/>
                                <path d="M 42 15 H 58" stroke="${theme.main}" stroke-width="2" stroke-linecap="round"/>
                                <path d="M 52 10 L 58 15 L 52 20" fill="none" stroke="${theme.main}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
          } else if (card.componentType === 'diode') {
            symbolPathMarkup = `<path d="M 0 15 L 38 15 M 55 15 L 100 15" fill="none" stroke="${theme.main}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
                                <path d="M 38 5 L 38 25 L 55 15 Z" fill="${theme.main}" stroke="${theme.main}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                <path d="M 55 5 L 55 25" fill="none" stroke="${theme.main}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
          } else if (card.componentType === 'bjt') {
            symbolPathMarkup = `<path d="M 0 30 L 22 30" fill="none" stroke="${theme.main}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
                                <path d="M 22 16 L 22 44" fill="none" stroke="${theme.main}" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/>
                                <path d="M 30 0 L 30 16 L 22 23" fill="none" stroke="${theme.main}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
                                <path d="M 22 37 L 30 44 L 30 60" fill="none" stroke="${theme.main}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
                                <polygon points="25,43 30,44 28,38" fill="${theme.main}" stroke="none"/>`;
          } else if (card.componentType === 'mosfet') {
            symbolPathMarkup = `<path d="M 0 30 L 20 30" fill="none" stroke="${theme.main}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
                                <path d="M 20 18 L 20 42" fill="none" stroke="${theme.main}" stroke-width="5.5" stroke-linecap="round"/>
                                <path d="M 25 18 L 25 42" fill="none" stroke="${theme.main}" stroke-width="4" stroke-linecap="round"/>
                                <path d="M 30 0 L 30 18 L 25 18" fill="none" stroke="${theme.main}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
                                <path d="M 25 42 L 30 42 L 30 60" fill="none" stroke="${theme.main}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
                                <polygon points="21,33 25,30 21,27" fill="${theme.main}" stroke="none"/>`;
          }

          const rot = card.rotation || 0;
          const isGnd = card.componentType === 'ground' || card.componentType === 'bjt' || card.componentType === 'mosfet';
          
          cardMarkup += `
            <g transform="translate(${card.x}, ${card.y}) rotate(${rot}, ${card.width / 2}, ${card.height / 2})">
              <g transform="${isGnd ? 'translate(0, 0)' : 'translate(0, 15)'}">
                ${symbolPathMarkup}
              </g>
              <g transform="rotate(${-rot}, ${card.width / 2}, ${isGnd ? '52' : '76.5'})">
                <text x="${card.width / 2}" y="${isGnd ? '52' : '70'}" fill="#ffffff" font-size="11" font-weight="bold" font-family="system-ui, sans-serif" text-anchor="middle">
                  ${escapeXml(compName)}
                </text>
                ${!isGnd ? `
                <text x="${card.width / 2}" y="83" fill="${theme.main}" font-size="10" font-weight="bold" font-family="system-ui, sans-serif" text-anchor="middle">
                  ${escapeXml(compVal)}
                </text>` : ''}
              </g>
            </g>`;
          return;
        }

        // Wrap text to fit inside card layout limits
        const titleText = escapeXml(card.title || '');
        
        // Split content text into nice rows
        const maxChar = 24;
        const words = (card.content || '').split(' ');
        const lines: string[] = [];
        let curLine = '';
        
        words.forEach(w => {
          if ((curLine + ' ' + w).trim().length <= maxChar) {
            curLine = (curLine + ' ' + w).trim();
          } else {
            if (curLine) lines.push(curLine);
            curLine = w;
          }
        });
        if (curLine) lines.push(curLine);

        // SVG markup block for glass cards
        cardMarkup += `
          <g transform="translate(${card.x}, ${card.y})">
            <!-- Box Card Outline Shadow Glow -->
            <rect
              x="-2" y="-2"
              width="${card.width + 4}" height="${card.height + 4}"
              rx="14"
              fill="none"
              stroke="${theme.main}"
              stroke-width="1.5"
              opacity="0.3"
            />
            <!-- Base Card Box -->
            <rect
              width="${card.width}" height="${card.height}"
              rx="12"
              fill="${theme.bg}"
              stroke="${theme.main}"
              stroke-width="2.2"
            />
            <!-- Title Line Divider -->
            <line x1="12" y1="36" x2="${card.width - 12}" y2="36" stroke="#222533" stroke-width="1"/>
            
            <!-- Title text -->
            <text x="14" y="24" fill="#ffffff" font-size="14" font-weight="bold" font-family="system-ui, sans-serif">
              ${titleText}
            </text>
            <!-- Body texts -->
            <g transform="translate(14, 52)">
              ${lines.slice(0, 5).map((l, idx) => `
                <text y="${idx * 16}" fill="#9ca3af" font-size="12" font-family="system-ui, sans-serif">
                  ${escapeXml(l)}
                </text>
              `).join('')}
            </g>
          </g>`;
      });

      // 3. Compile everything into a unified SVG string
      const svgContent = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="${minX} ${minY} ${width} ${height}"
  width="${width}"
  height="${height}"
  style="background-color: #06070a;"
>
  <defs>
    ${Object.keys(hexColors).map((name) => `
      <marker
        id="arrowhead-${name}"
        markerWidth="8"
        markerHeight="7"
        refX="7.5"
        refY="3.5"
        orient="auto"
      >
        <polygon points="0 0, 8 3.5, 0 7" fill="${hexColors[name].main}" />
      </marker>
    `).join('')}
  </defs>

  <!-- Title Indicator -->
  <text x="${minX + 30}" y="${minY + 40}" fill="#ffffff" font-size="18" font-weight="bold" font-family="system-ui, sans-serif" opacity="0.65">
    ⚡ Spark Flow Board — Exported Layout
  </text>

  <!-- Connectors -->
  ${arrowMarkup}

  <!-- Card Nodes -->
  ${cardMarkup}
</svg>`;

      // 4. Download file trigger
      const dataUri = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgContent);
      const exportFileDefaultName = `spark-flow-vector-${Date.now()}.svg`;

      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
    } catch (e) {
      console.error('Failed to export SVG vector:', e);
      alert('Could not export SVG file.');
    }
  };

  return (
    <>
      {/* 1. Main Viewport Canvas */}
      <Canvas
        elements={elements}
        pan={offset}
        zoom={zoom}
        selectedId={selectedId}
        selectedIds={selectedIds}
        activeTool={activeTool}
        setSelectedId={setSelectedId}
        setSelectedIds={setSelectedIds}
        setPan={setOffset}
        setZoom={setZoom}
        addCard={addCard}
        addArrow={addArrow}
        updateElement={updateElement}
        updateCardPosition={updateCardPosition}
        updateCardSize={updateCardSize}
        finalizeDrag={finalizeDrag}
        deleteElement={deleteElement}
        setToast={setToast}
        solvedDCOperatingPoint={solvedDCOperatingPoint}
        wireVoltages={wireVoltages}
        wireCurrents={wireCurrents}
      />

      {/* 2. Overlaid Floating TopBar (top-center) */}
      <TopBar
        activeTool={activeTool}
        setActiveTool={setActiveTool}
        undo={undo}
        redo={redo}
        canUndo={canUndo()}
        canRedo={canRedo()}
        clearCanvas={clearCanvas}
        exportJSON={handleExportJSON}
        exportSVG={handleExportSVG}
        loadElements={loadElements}
        elements={elements}
        setToast={setToast}
      />

      {/* 3. Bottom HUD zoom panel */}
      <ZoomControl
        zoom={zoom}
        zoomIn={zoomIn}
        zoomOut={zoomOut}
        resetView={resetView}
        fitView={() => fitView(elements)}
        activeTool={activeTool}
        setActiveTool={setActiveTool}
      />

      {/* 4. Slide out element settings inspector (right-side) */}
      <SettingsSideMenu
        selectedElement={selectedElement}
        onUpdateElement={updateElement}
        onDeleteElement={deleteElement}
        onClose={() => setSelectedId(null)}
        arrowCurrent={selectedElement && selectedElement.type === 'arrow' ? wireCurrents[selectedElement.id] : undefined}
      />

      {/* Premium Glassmorphic Floating Toast */}
      {toast && (
        <div
          className="glass-panel animate-fade-in"
          style={{
            position: 'fixed',
            bottom: '80px',
            right: '24px',
            padding: '12px 18px',
            borderRadius: '12px',
            background: 'rgba(16, 18, 27, 0.9)',
            border: '1.5px solid var(--theme-amethyst)',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.5), 0 0 15px var(--theme-amethyst-glow)',
            color: '#ffffff',
            fontSize: '13px',
            fontWeight: 600,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            maxWidth: '380px',
            pointerEvents: 'auto',
            animation: 'slideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1) reverse'
          }}
        >
          <span style={{ fontSize: '16px' }}>⚡</span>
          <span>{toast.message}</span>
        </div>
      )}
      <Cursor />
      <KeyListner undo={undo} redo={redo} />
    </>
  );
}

export default App;
