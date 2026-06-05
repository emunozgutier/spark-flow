import React, { useRef, useEffect } from 'react';
import type { Point, CanvasElement, CardElement, ArrowElement } from '../../dataTypes/AnotateType';
import { getAbsoluteDirection, getOrthogonalPathPoints } from './Connections';
import { Electron } from './ElectronManager/Electron';

interface ElectronManagerProps {
  elements: CanvasElement[];
  solvedResults: Record<string, { voltageDrop: number; branchCurrent: number }>;
  pan: Point;
  zoom: number;
  getSocketPosition: (card: CardElement, socket: 'top' | 'right' | 'bottom' | 'left') => Point;
  containerRef: React.RefObject<HTMLDivElement>;
}

const MAX_SPEED = 180; // pixels per second
const MIN_SPEED = 30;  // pixels per second (for low but non-zero currents)

export const ElectronManager: React.FC<ElectronManagerProps> = ({
  elements,
  solvedResults,
  pan,
  zoom,
  getSocketPosition,
  containerRef
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const electronsRef = useRef<Electron[]>([]);
  const lastSpawnTimes = useRef<Record<string, number>>({});

  // Keep references to latest values to avoid recreating the animation frame loop
  const panRef = useRef(pan);
  const zoomRef = useRef(zoom);
  const elementsRef = useRef(elements);
  const solvedResultsRef = useRef(solvedResults);
  const getSocketPositionRef = useRef(getSocketPosition);

  // Sync references
  useEffect(() => {
    panRef.current = pan;
    zoomRef.current = zoom;
    elementsRef.current = elements;
    solvedResultsRef.current = solvedResults;
    getSocketPositionRef.current = getSocketPosition;
  }, [pan, zoom, elements, solvedResults, getSocketPosition]);

  // Clear active electrons when circuit components or simulation results change
  useEffect(() => {
    electronsRef.current = [];
  }, [elements, solvedResults]);

  // Resize handler for Retina-sharp drawing context
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const dpr = window.devicePixelRatio || 1;
      canvas.width = container.clientWidth * dpr;
      canvas.height = container.clientHeight * dpr;
      canvas.style.width = `${container.clientWidth}px`;
      canvas.style.height = `${container.clientHeight}px`;
    };

    handleResize();

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [containerRef]);

  // Animation and physics update loop
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();

    const getWirePoints = (
      wire: ArrowElement,
      isForward: boolean,
      cards: CardElement[]
    ): Point[] => {
      let startPt = wire.fromPoint || { x: 0, y: 0 };
      let endPt = wire.toPoint || { x: 0, y: 0 };

      const fromCard = cards.find((c) => c.id === wire.fromId);
      const toCard = cards.find((c) => c.id === wire.toId);

      const getSocketPos = getSocketPositionRef.current;

      if (wire.fromId && fromCard && wire.fromSocket) {
        startPt = getSocketPos(fromCard, wire.fromSocket);
      }
      if (wire.toId && toCard && wire.toSocket) {
        endPt = getSocketPos(toCard, wire.toSocket);
      }

      const absFromDir = getAbsoluteDirection(wire.fromSocket, fromCard?.rotation || 0);
      const absToDir = getAbsoluteDirection(wire.toSocket, toCard?.rotation || 0);
      const pathPoints = getOrthogonalPathPoints(startPt, endPt, absFromDir, absToDir, wire.id);

      return isForward ? pathPoints : [...pathPoints].reverse();
    };

    const getWireCurrentRecursive = (
      wire: ArrowElement,
      cards: CardElement[],
      arrows: ArrowElement[],
      results: Record<string, { voltageDrop: number; branchCurrent: number }>,
      visitedJoins: Set<string> = new Set()
    ): number => {
      const c1 = cards.find((c) => c.id === wire.fromId);
      const c2 = cards.find((c) => c.id === wire.toId);

      const checkCard = (card: CardElement | undefined): number => {
        if (!card) return 0;
        if (card.componentType && card.componentType !== 'ground' && card.componentType !== 'join') {
          return Math.abs(results[card.id]?.branchCurrent || 0);
        }
        if (card.id.startsWith('join') || card.title === 'join') {
          if (visitedJoins.has(card.id)) return 0;
          visitedJoins.add(card.id);

          // Find other wires connected to this join and get their currents
          const otherWires = arrows.filter(
            (a) => a.id !== wire.id && (a.fromId === card.id || a.toId === card.id)
          );
          let subMax = 0;
          for (const ow of otherWires) {
            subMax = Math.max(subMax, getWireCurrentRecursive(ow, cards, arrows, results, visitedJoins));
          }
          return subMax;
        }
        return 0;
      };

      return Math.max(checkCard(c1), checkCard(c2));
    };

    const calculateSpeedForWire = (
      wire: ArrowElement,
      cards: CardElement[],
      arrows: ArrowElement[],
      results: Record<string, { voltageDrop: number; branchCurrent: number }>,
      maxI: number
    ): number => {
      const wireCurrent = getWireCurrentRecursive(wire, cards, arrows, results);
      if (wireCurrent < 1e-9) return 0;
      const ratio = Math.min(1.0, wireCurrent / maxI);
      return MIN_SPEED + ratio * (MAX_SPEED - MIN_SPEED);
    };

    const tick = (timestamp: number) => {
      const dt = (timestamp - lastTime) / 1000;
      lastTime = timestamp;

      const cards = elementsRef.current.filter((el) => el.type === 'box') as CardElement[];
      const arrows = elementsRef.current.filter((el) => el.type === 'arrow') as ArrowElement[];
      const results = solvedResultsRef.current;

      // Compute maximum branch current in circuit for normalized speeds
      let maxI = 0.0001;
      Object.values(results).forEach((res) => {
        if (res.branchCurrent !== undefined) {
          maxI = Math.max(maxI, Math.abs(res.branchCurrent));
        }
      });

      // 1. Particle Spawning Logic from Sources
      const sources = cards.filter(
        (c) => c.componentType === 'voltage' || c.componentType === 'current'
      );

      const now = performance.now();

      sources.forEach((src) => {
        const solved = results[src.id];
        if (!solved) return;

        const current = solved.branchCurrent || 0;
        const absI = Math.abs(current);

        if (absI < 1e-6) return; // Ignore inactive sources

        const ratio = absI / maxI;
        const spawnInterval = Math.max(120, Math.min(1500, 120 / ratio));

        const lastSpawn = lastSpawnTimes.current[src.id] || 0;
        if (now - lastSpawn >= spawnInterval) {
          lastSpawnTimes.current[src.id] = now;

          // Outflow port (conventional current leaves the positive node)
          // For voltage sources, current flows out of 'left' (positive) if branchCurrent <= 0
          // For current sources, current flows out of 'left' if branchCurrent >= 0
          const isVoltage = src.componentType === 'voltage';
          const outflowPort = isVoltage
            ? (current <= 0 ? 'left' : 'right')
            : (current >= 0 ? 'left' : 'right');

          const connectedWires = arrows.filter(
            (w) =>
              (w.fromId === src.id && w.fromSocket === outflowPort) ||
              (w.toId === src.id && w.toSocket === outflowPort)
          );

          connectedWires.forEach((w) => {
            const isForward = w.fromId === src.id;
            const otherCardId = isForward ? w.toId : w.fromId;
            const otherPort = isForward ? w.toSocket : w.fromSocket;

            const points = getWirePoints(w, isForward, cards);
            if (points.length < 2) return;

            const initialSpeed = calculateSpeedForWire(w, cards, arrows, results, maxI);
            if (initialSpeed < 5) return;

            if (electronsRef.current.length < 300) {
              const newEl = new Electron(
                points,
                initialSpeed,
                otherCardId,
                otherPort,
                new Set([src.id])
              );
              electronsRef.current.push(newEl);
            }
          });
        }
      });

      // 2. Physics & Routing Update
      const updatedElectrons: Electron[] = [];
      const getSocketPos = getSocketPositionRef.current;

      electronsRef.current.forEach((el) => {
        const active = el.update(
          dt,
          cards,
          arrows,
          results,
          maxI,
          getSocketPos,
          (wire, isFwd) => getWirePoints(wire, isFwd, cards),
          (wire) => calculateSpeedForWire(wire, cards, arrows, results, maxI),
          (splits) => updatedElectrons.push(...splits)
        );

        if (active) {
          updatedElectrons.push(el);
        }
      });

      electronsRef.current = updatedElectrons;

      // 3. Render Canvas Frame
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          const dpr = window.devicePixelRatio || 1;
          ctx.save();
          ctx.scale(dpr, dpr);

          // Apply global board pan & zoom transformations
          const panVal = panRef.current;
          const zoomVal = zoomRef.current;
          ctx.translate(panVal.x, panVal.y);
          ctx.scale(zoomVal, zoomVal);

          // Draw Glowing Neon Electron Particles
          ctx.fillStyle = '#67e8f9'; // High-intensity cyan-blue core
          ctx.shadowBlur = 8;
          ctx.shadowColor = '#06b6d4'; // Cyan glowing bloom outline

          electronsRef.current.forEach((el) => {
            el.draw(ctx);
          });

          ctx.restore();
        }
      }

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 10 // Above SVG connections, below the card interactive elements
      }}
    />
  );
};
