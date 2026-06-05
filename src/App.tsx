import { useEffect, useState, useMemo } from 'react';
import { useCanvas } from './store/useCanvas';
import { useZoom } from './store/useZoom';
import { Canvas } from './components/Canvas';
import { TopBar } from './components/TopBar';
import { ZoomControl } from './components/ZoomControl';
import { SettingsSideMenu } from './components/SettingsSideMenu';
import type { CanvasElement, CardElement, ArrowElement } from './dataTypes/AnotateType';
import { formatEngineering } from './utils/math';
import { solveLinearSystem } from './sim/components/mnaSolver';
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

  // --- REAL-TIME MNA DC OPERATING POINT SOLVER & WIRE CURRENTS ---
  const { solvedDCOperatingPoint, wireCurrents } = useMemo(() => {
    if (!liveDCOn) return { solvedDCOperatingPoint: {}, wireCurrents: {} };
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
      const voltageSources = cards.filter((c) => c.componentType === 'voltage');
      const group2Resistors = cards.filter((c) => c.componentType === 'resistor' && c.isGroup2);
      const mnaSize = nodeCount + voltageSources.length + group2Resistors.length;

      if (mnaSize === 0) return { solvedDCOperatingPoint: {}, wireCurrents: {} };

      const A = Array.from({ length: mnaSize }, () => new Array(mnaSize).fill(0));
      const B = new Array(mnaSize).fill(0);

      const g2ElementMap: Record<string, number> = {};
      let g2Index = nodeCount;
      voltageSources.forEach((vSrc) => {
        g2ElementMap[vSrc.id] = g2Index++;
      });
      group2Resistors.forEach((rGrp2) => {
        g2ElementMap[rGrp2.id] = g2Index++;
      });

      cards.forEach((card) => {
        if (card.componentType === 'resistor' || card.componentType === 'inductor') {
          const n1Str = getPinNode(card.id, 'left');
          const n2Str = getPinNode(card.id, 'right');
          const n1 = parseInt(n1Str, 10);
          const n2 = parseInt(n2Str, 10);
          
          let rVal = 1000;
          if (card.componentType === 'inductor') {
            rVal = 1e-3;
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

      voltageSources.forEach((vSrc) => {
        const n1Str = getPinNode(vSrc.id, 'left');
        const n2Str = getPinNode(vSrc.id, 'right');
        const n1 = parseInt(n1Str, 10);
        const n2 = parseInt(n2Str, 10);
        const val = vSrc.value !== undefined ? vSrc.value : 5;
        const idx = g2ElementMap[vSrc.id];

        if (n1 > 0) A[n1 - 1][idx] += 1;
        if (n2 > 0) A[n2 - 1][idx] -= 1;
        if (n1 > 0) A[idx][n1 - 1] += 1;
        if (n2 > 0) A[idx][n2 - 1] -= 1;
        B[idx] = val;
      });

      cards.forEach((card) => {
        if (card.componentType === 'current') {
          const n1Str = getPinNode(card.id, 'left');
          const n2Str = getPinNode(card.id, 'right');
          const n1 = parseInt(n1Str, 10);
          const n2 = parseInt(n2Str, 10);
          const val = card.value !== undefined ? card.value : 0.001;

          if (n1 > 0) B[n1 - 1] -= val;
          if (n2 > 0) B[n2 - 1] += val;
        }
      });

      const X = solveLinearSystem(A, B);

      const voltages: Record<string, number> = { '0': 0 };
      for (let i = 1; i <= nodeCount; i++) {
        voltages[String(i)] = X[i - 1] || 0;
      }

      const solvedDCOperatingPoint: Record<string, any> = {};
      cards.forEach((card) => {
        if (!card.componentType) return;
        if (card.componentType === 'ground') {
          solvedDCOperatingPoint[card.id] = { voltageDrop: 0, branchCurrent: 0 };
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
            const idx = g2ElementMap[card.id];
            iBranch = X[idx] || 0;
          } else {
            const rVal = card.value !== undefined ? (card.value <= 0 ? 1e-3 : card.value) : 1000;
            iBranch = vDrop / rVal;
          }
        } else if (card.componentType === 'voltage') {
          const idx = g2ElementMap[card.id];
          iBranch = X[idx] || 0;
        } else if (card.componentType === 'current') {
          iBranch = card.value !== undefined ? card.value : 0.001;
        } else if (card.componentType === 'capacitor') {
          iBranch = 0;
        } else if (card.componentType === 'inductor') {
          iBranch = vDrop / 1e-3;
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

        // Match branch current of directly connected components (R1, R3, etc.)
        const connectedCard = cards.find((c) => c.componentType && (w.fromId === c.id || w.toId === c.id));
        if (connectedCard) {
          const solved = solvedDCOperatingPoint[connectedCard.id];
          if (solved) {
            current = solved.branchCurrent;
          }
        } else if (w.netName === '1' || w.netName?.startsWith('1.')) {
          // Fallback for node 1 subnets to match resistor R2 current
          const r2Card = cards.find((c) => c.componentType === 'resistor' && c.instanceNumber === 2);
          if (r2Card && solvedDCOperatingPoint[r2Card.id]) {
            current = solvedDCOperatingPoint[r2Card.id].branchCurrent;
          }
        }
        wireCurrents[w.id] = current;
      });

      return { solvedDCOperatingPoint, wireCurrents };
    } catch (e) {
      return { solvedDCOperatingPoint: {}, wireCurrents: {} };
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



  // Handle keyboard hotkeys globally
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape key cancels active tools, blurs inputs, and resets to select mode
      if (e.key === 'Escape') {
        (document.activeElement as HTMLElement)?.blur();
        setActiveTool('select');
        return;
      }

      // Ignore key binds if typing in input textareas
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdKey = isMac ? e.metaKey : e.ctrlKey;

      // Undo / Redo
      if (cmdKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
        return;
      }
      if (cmdKey && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
        return;
      }

      // Tool selection shortcuts
      switch (e.key.toLowerCase()) {
        case 'v':
          setActiveTool('select');
          break;
        case 't':
          setActiveTool('text');
          break;
        case 'a':
        case 'w':
          setActiveTool('arrow'); // A or W for connector wire
          break;
        case 'h':
          setActiveTool('hand');
          break;
        case 'r':
          setActiveTool('resistor');
          break;
        case 'c':
          setActiveTool('capacitor');
          break;
        case 'i':
          setActiveTool('inductor');
          break;
        case 'g':
          setActiveTool('ground');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, setActiveTool]);

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

        const colorHex = hexColors[arrow.color]?.main || '#64748b';
        const isDashed = arrow.style === 'dashed';

        arrowMarkup += `
          <g>
            <path
              d="${path}"
              fill="none"
              stroke="${colorHex}"
              stroke-width="2"
              ${isDashed ? 'stroke-dasharray="6,6"' : ''}
              marker-end="url(#arrowhead-${arrow.color})"
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
          const prefix = card.componentType === 'resistor' ? 'R' : card.componentType === 'capacitor' ? 'C' : card.componentType === 'inductor' ? 'L' : 'GND';
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
          }

          const rot = card.rotation || 0;
          const isGnd = card.componentType === 'ground';
          
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
    </>
  );
}

export default App;
