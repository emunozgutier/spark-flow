import { useEffect } from 'react';
import { useCanvas } from './store/useCanvas';
import { useZoom } from './store/useZoom';
import { Canvas } from './components/Canvas';
import { Toolbar } from './components/Toolbar';
import { ZoomControl } from './components/ZoomControl';
import { Sidebar } from './components/Sidebar';
import type { CanvasElement, CardElement, ArrowElement } from './types';
import './App.css';

function App() {
  const {
    elements,
    selectedId,
    activeTool,
    setActiveTool,
    setSelectedId,
    addCard,
    addArrow,
    updateElement,
    updateCardPosition,
    updateCardSize,
    finalizeDrag,
    deleteElement,
    clearCanvas,
    undo,
    redo,
    canUndo,
    canRedo,
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

  // Handle keyboard hotkeys globally
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
          setActiveTool('arrow');
          break;
        case 'h':
          setActiveTool('hand');
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
      const cards = elements.filter((el: CanvasElement) => el.type === 'card') as CardElement[];
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
          if (socket === 'top') return { x: card.x + card.width / 2, y: card.y };
          if (socket === 'right') return { x: card.x + card.width, y: card.y + card.height / 2 };
          if (socket === 'bottom') return { x: card.x + card.width / 2, y: card.y + card.height };
          return { x: card.x, y: card.y + card.height / 2 }; // left
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
        
        // Wrap text to fit inside card layout limits
        const titleText = escapeXml(card.title);
        
        // Split content text into nice rows
        const maxChar = 24;
        const words = card.content.split(' ');
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
        activeTool={activeTool}
        setSelectedId={setSelectedId}
        setPan={setOffset}
        setZoom={setZoom}
        addCard={addCard}
        addArrow={addArrow}
        updateElement={updateElement}
        updateCardPosition={updateCardPosition}
        updateCardSize={updateCardSize}
        finalizeDrag={finalizeDrag}
        deleteElement={deleteElement}
      />

      {/* 2. Overlaid Floating Toolbar (top-center) */}
      <Toolbar
        activeTool={activeTool}
        setActiveTool={setActiveTool}
        undo={undo}
        redo={redo}
        canUndo={canUndo()}
        canRedo={canRedo()}
        clearCanvas={clearCanvas}
        exportJSON={handleExportJSON}
        exportSVG={handleExportSVG}
      />

      {/* 3. Bottom HUD zoom panel */}
      <ZoomControl
        zoom={zoom}
        zoomIn={zoomIn}
        zoomOut={zoomOut}
        resetView={resetView}
        fitView={() => fitView(elements)}
      />

      {/* 4. Slide out sidebar inspector (right-side) */}
      <Sidebar
        selectedElement={selectedElement}
        onUpdateElement={updateElement}
        onDeleteElement={deleteElement}
        onClose={() => setSelectedId(null)}
      />
    </>
  );
}

export default App;
