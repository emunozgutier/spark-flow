import React, { useRef, useEffect } from 'react';
import type { Point, CanvasElement, CardElement, ArrowElement } from '../../dataTypes/AnotateType';
import { getAbsoluteDirection, getOrthogonalPathPoints } from './Connections';

interface ElectronManagerProps {
  elements: CanvasElement[];
  solvedResults: Record<
    string,
    {
      voltageDrop: number;
      branchCurrent: number;
      vLeft?: number;
      vRight?: number;
      signedCurrent?: number;
    }
  >;
  pan: Point;
  zoom: number;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

const MAX_SPEED = 180; // pixels per second
const MIN_SPEED = 2;  // pixels per second (for low but non-zero currents)

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

const getSocketPosition = (card: CardElement, socket: 'top' | 'right' | 'bottom' | 'left'): Point => {
  let basePt = { x: 0, y: 0 };
  const isPassive = !!card.componentType;
  switch (socket) {
    case 'top':
      basePt = { x: card.x + card.width / 2, y: card.y };
      break;
    case 'right':
      basePt = {
        x: card.x + card.width,
        y: isPassive && card.componentType !== 'ground' ? card.y + 20 : card.y + card.height / 2
      };
      break;
    case 'bottom':
      basePt = { x: card.x + card.width / 2, y: card.y + card.height };
      break;
    case 'left':
      basePt = {
        x: card.x,
        y: isPassive && card.componentType !== 'ground' ? card.y + 20 : card.y + card.height / 2
      };
      break;
  }

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

const getWirePoints = (
  wire: ArrowElement,
  isForward: boolean,
  cards: CardElement[]
): Point[] => {
  let startPt = wire.fromPoint || { x: 0, y: 0 };
  let endPt = wire.toPoint || { x: 0, y: 0 };

  const fromCard = cards.find((c) => c.id === wire.fromId);
  const toCard = cards.find((c) => c.id === wire.toId);

  if (wire.fromId && fromCard && wire.fromSocket) {
    startPt = getSocketPosition(fromCard, wire.fromSocket);
  }
  if (wire.toId && toCard && wire.toSocket) {
    endPt = getSocketPosition(toCard, wire.toSocket);
  }

  const absFromDir = getAbsoluteDirection(wire.fromSocket, fromCard?.rotation || 0);
  const absToDir = getAbsoluteDirection(wire.toSocket, toCard?.rotation || 0);
  const pathPoints = getOrthogonalPathPoints(startPt, endPt, absFromDir, absToDir, wire.id);

  return isForward ? pathPoints : [...pathPoints].reverse();
};

const getPathLength = (path: Point[]): number => {
  let len = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const p1 = path[i];
    const p2 = path[i + 1];
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    len += Math.sqrt(dx * dx + dy * dy);
  }
  return len;
};

const getPositionAlongPath = (path: Point[], progress: number): Point => {
  if (path.length === 0) return { x: 0, y: 0 };
  if (path.length === 1) return path[0];

  let remaining = progress;
  for (let i = 0; i < path.length - 1; i++) {
    const p1 = path[i];
    const p2 = path[i + 1];
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (remaining <= dist) {
      const ratio = dist > 0 ? remaining / dist : 0;
      return {
        x: p1.x + dx * ratio,
        y: p1.y + dy * ratio
      };
    }
    remaining -= dist;
  }
  return path[path.length - 1];
};

const getSpeedForCurrent = (current: number, maxI: number): number => {
  if (current < 1e-9) return 0;
  const ratio = Math.min(1.0, current / maxI);
  return MIN_SPEED + ratio * (MAX_SPEED - MIN_SPEED);
};

export const ElectronManager: React.FC<ElectronManagerProps> = ({
  elements,
  solvedResults,
  pan,
  zoom,
  containerRef
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Keep references to latest values to avoid recreating the animation frame loop
  const panRef = useRef(pan);
  const zoomRef = useRef(zoom);
  const elementsRef = useRef(elements);
  const solvedResultsRef = useRef(solvedResults);

  // Sync references
  useEffect(() => {
    panRef.current = pan;
    zoomRef.current = zoom;
    elementsRef.current = elements;
    solvedResultsRef.current = solvedResults;
  }, [pan, zoom, elements, solvedResults]);

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

  // Cache segments and electron progresses
  const segmentsRef = useRef<{
    id: string;
    path: Point[];
    length: number;
    speed: number;
  }[]>([]);

  const electronsRef = useRef<{
    segmentId: string;
    progress: number;
  }[]>([]);

  // Update segments and electrons when elements or solvedResults change
  useEffect(() => {
    const cards = elements.filter((el) => el.type === 'box') as CardElement[];
    const arrows = elements.filter((el) => el.type === 'arrow') as ArrowElement[];

    // 1. Group sockets into electrical nodes using Union-Find
    const uf = new UnionFind();
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

    joinCards.forEach((j) => {
      uf.union(`${j.id}-top`, `${j.id}-right`);
      uf.union(`${j.id}-top`, `${j.id}-bottom`);
      uf.union(`${j.id}-top`, `${j.id}-left`);
    });

    arrows.forEach((w) => {
      if (w.fromId && w.fromSocket && w.toId && w.toSocket) {
        uf.union(`${w.fromId}-${w.fromSocket}`, `${w.toId}-${w.toSocket}`);
      }
    });

    const groups: Record<string, string[]> = {};
    socketKeys.forEach((s) => {
      const root = uf.find(s);
      if (!groups[root]) groups[root] = [];
      groups[root].push(s);
    });

    // 2. Build local adjacency list for all connections
    const adj: Record<string, string[]> = {};
    const addEdge = (u: string, v: string) => {
      if (!adj[u]) adj[u] = [];
      if (!adj[v]) adj[v] = [];
      adj[u].push(v);
      adj[v].push(u);
    };

    arrows.forEach((w) => {
      if (w.fromId && w.fromSocket && w.toId && w.toSocket) {
        addEdge(`${w.fromId}-${w.fromSocket}`, `${w.toId}-${w.toSocket}`);
      }
    });

    joinCards.forEach((j) => {
      const ports = [`${j.id}-top`, `${j.id}-right`, `${j.id}-bottom`, `${j.id}-left`];
      for (let i = 0; i < ports.length; i++) {
        for (let k = i + 1; k < ports.length; k++) {
          addEdge(ports[i], ports[k]);
        }
      }
    });

    // 3. Determine roles (source/sink) and max branchCurrent for each group
    const scoreMap: Record<string, number> = {};
    const nodeMaxCurrents: Record<string, number> = {};

    const getSocketRole = (cardId: string, socket: string) => {
      const card = cards.find((c) => c.id === cardId);
      if (!card || !card.componentType) return { role: 'none', current: 0 };
      if (card.componentType === 'ground') {
        return { role: 'sink', current: 0 };
      }

      const solved = solvedResults[card.id];
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
      const groupSocketsSet = new Set(groupSockets);
      const groupSources: string[] = [];
      const groupSinks: string[] = [];
      let maxNodeCurrent = 0;

      groupSockets.forEach((s) => {
        const lastDash = s.lastIndexOf('-');
        const cardId = s.substring(0, lastDash);
        const socket = s.substring(lastDash + 1);

        const { role, current } = getSocketRole(cardId, socket);
        if (role === 'source') groupSources.push(s);
        if (role === 'sink') groupSinks.push(s);
        maxNodeCurrent = Math.max(maxNodeCurrent, current);
      });

      nodeMaxCurrents[root] = maxNodeCurrent;

      const runBFS = (starts: string[]): Record<string, number> => {
        const dist: Record<string, number> = {};
        const queue: string[] = [];
        starts.forEach((s) => {
          dist[s] = 0;
          queue.push(s);
        });

        let head = 0;
        while (head < queue.length) {
          const curr = queue[head++];
          const neighbors = adj[curr] || [];
          neighbors.forEach((n) => {
            if (groupSocketsSet.has(n) && dist[n] === undefined) {
              dist[n] = dist[curr] + 1;
              queue.push(n);
            }
          });
        }
        return dist;
      };

      const srcDist = runBFS(groupSources);
      const sinkDist = runBFS(groupSinks);

      groupSockets.forEach((s) => {
        const dSrc = srcDist[s];
        const dSink = sinkDist[s];
        scoreMap[s] = (dSrc !== undefined ? dSrc : 999) - (dSink !== undefined ? dSink : 999);
      });
    });

    // 4. Calculate maximum current in entire circuit for normalization
    let maxI = 1e-4;
    compCards.forEach((c) => {
      const solved = solvedResults[c.id];
      if (solved?.branchCurrent) {
        maxI = Math.max(maxI, solved.branchCurrent);
      }
    });

    const newSegments: { id: string; path: Point[]; length: number; speed: number }[] = [];

    // Add Component segments (excluding ground, voltage, and current sources)
    compCards.forEach((card) => {
      if (
        card.componentType === 'ground' ||
        card.componentType === 'voltage' ||
        card.componentType === 'current'
      ) {
        return;
      }

      const ptLeft = getSocketPosition(card, 'left');
      const ptRight = getSocketPosition(card, 'right');
      const solved = solvedResults[card.id];
      const vLeft = solved?.vLeft || 0;
      const vRight = solved?.vRight || 0;
      const signedI = solved?.signedCurrent || 0;
      const branchI = Math.abs(solved?.branchCurrent || 0);

      let startPt = ptLeft;
      let endPt = ptRight;
      if (vLeft > vRight) {
        startPt = ptLeft;
        endPt = ptRight;
      } else if (vRight > vLeft) {
        startPt = ptRight;
        endPt = ptLeft;
      } else {
        if (signedI > 0) {
          startPt = ptLeft;
          endPt = ptRight;
        } else {
          startPt = ptRight;
          endPt = ptLeft;
        }
      }

      const path = [startPt, endPt];
      const length = getPathLength(path);
      const speed = getSpeedForCurrent(branchI, maxI);

      newSegments.push({ id: card.id, path, length, speed });
    });

    // Add Wire segments
    arrows.forEach((w) => {
      if (!w.fromId || !w.fromSocket || !w.toId || !w.toSocket) return;

      const sStart = `${w.fromId}-${w.fromSocket}`;
      const sEnd = `${w.toId}-${w.toSocket}`;
      const scoreStart = scoreMap[sStart] ?? 0;
      const scoreEnd = scoreMap[sEnd] ?? 0;

      const isForward = scoreStart <= scoreEnd;
      const path = getWirePoints(w, isForward, cards);
      const length = getPathLength(path);

      const root = uf.find(sStart);
      let current = nodeMaxCurrents[root] || 0;

      // Override for node 1 subnets: subnet 1.2 matches resistor R3 current speed, others match R2
      if (w.netName === '1.2') {
        const r3Card = cards.find((c) => c.componentType === 'resistor' && c.instanceNumber === 3);
        if (r3Card && solvedResults[r3Card.id]) {
          current = solvedResults[r3Card.id].branchCurrent;
        }
      } else if (w.netName === '1' || w.netName?.startsWith('1.')) {
        const r2Card = cards.find((c) => c.componentType === 'resistor' && c.instanceNumber === 2);
        if (r2Card && solvedResults[r2Card.id]) {
          current = solvedResults[r2Card.id].branchCurrent;
        }
      }

      const speed = getSpeedForCurrent(current, maxI);

      newSegments.push({ id: w.id, path, length, speed });
    });

    // 5. Interpolate old electron progress values onto new segments
    const oldElectronsBySegment = new Map<string, number[]>();
    electronsRef.current.forEach((e) => {
      if (!oldElectronsBySegment.has(e.segmentId)) {
        oldElectronsBySegment.set(e.segmentId, []);
      }
      oldElectronsBySegment.get(e.segmentId)!.push(e.progress);
    });

    const newElectrons: { segmentId: string; progress: number }[] = [];
    newSegments.forEach((seg) => {
      const oldProgresses = oldElectronsBySegment.get(seg.id);
      const numElectrons = Math.max(1, Math.floor(seg.length / 40));

      if (oldProgresses && oldProgresses.length > 0) {
        for (let i = 0; i < numElectrons; i++) {
          if (i < oldProgresses.length) {
            newElectrons.push({ segmentId: seg.id, progress: oldProgresses[i] % seg.length });
          } else {
            newElectrons.push({ segmentId: seg.id, progress: (i / numElectrons) * seg.length });
          }
        }
      } else {
        for (let i = 0; i < numElectrons; i++) {
          newElectrons.push({ segmentId: seg.id, progress: (i / numElectrons) * seg.length });
        }
      }
    });

    segmentsRef.current = newSegments;
    electronsRef.current = newElectrons;
  }, [elements, solvedResults]);

  // Animation frame loop
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();

    const tick = (timestamp: number) => {
      const dt = (timestamp - lastTime) / 1000;
      lastTime = timestamp;

      const segments = segmentsRef.current;
      const segmentMap = new Map(segments.map((s) => [s.id, s]));

      // Update positions
      electronsRef.current.forEach((e) => {
        const seg = segmentMap.get(e.segmentId);
        if (seg && seg.speed > 0) {
          e.progress = (e.progress + seg.speed * dt) % seg.length;
        }
      });

      // Render
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          const dpr = window.devicePixelRatio || 1;
          ctx.save();
          ctx.scale(dpr, dpr);

          const panVal = panRef.current;
          const zoomVal = zoomRef.current;
          ctx.translate(panVal.x, panVal.y);
          ctx.scale(zoomVal, zoomVal);

          // Render Neon Blue glowing electrons
          ctx.fillStyle = '#67e8f9'; // Cyan core
          ctx.shadowBlur = 8;
          ctx.shadowColor = '#06b6d4'; // Cyan bloom glow

          electronsRef.current.forEach((e) => {
            const seg = segmentMap.get(e.segmentId);
            if (seg) {
              const pos = getPositionAlongPath(seg.path, e.progress);
              ctx.beginPath();
              ctx.arc(pos.x, pos.y, 3.5, 0, 2 * Math.PI);
              ctx.fill();
            }
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
        zIndex: 10
      }}
    />
  );
};
