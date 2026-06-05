import React, { useRef, useEffect } from 'react';
import type { Point, CanvasElement, CardElement, ArrowElement } from '../../dataTypes/AnotateType';
import { Electron, drawElectron, setupElectronStyles } from './Animation/Electron';
import { Segment, getPositionAlongPath, getPathLength, getWirePoints, getSocketPosition, mergePaths, getSpeedForCurrent } from './Animation/ElectronPath';

interface AnimationManagerProps {
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

export const AnimationManager: React.FC<AnimationManagerProps> = ({
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
  const segmentsRef = useRef<Segment[]>([]);
  const electronsRef = useRef<Electron[]>([]);

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

    // Map each root key to its resolved node voltage
    const rootVoltage: Record<string, number> = {};
    Object.keys(groups).forEach((root) => {
      const pin = groups[root].find((p) => {
        const lastDash = p.lastIndexOf('-');
        const cId = p.substring(0, lastDash);
        const card = cards.find((c) => c.id === cId);
        return card && card.componentType !== undefined;
      });

      if (pin) {
        const lastDash = pin.lastIndexOf('-');
        const cId = pin.substring(0, lastDash);
        const socket = pin.substring(lastDash + 1);
        const solved = solvedResults[cId];
        if (solved) {
          rootVoltage[root] = socket === 'left' ? (solved.vLeft ?? 0) : (solved.vRight ?? 0);
        } else {
          rootVoltage[root] = 0;
        }
      } else {
        rootVoltage[root] = 0;
      }
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

    const newSegments: Segment[] = [];

    const junctionPins = new Set<string>();
    cards.forEach((c) => {
      if (c.componentType === 'ground' || c.id.startsWith('join') || c.title === 'join') {
        const sockets: ('top' | 'right' | 'bottom' | 'left')[] = c.componentType === 'ground' ? ['top'] : ['top', 'right', 'bottom', 'left'];
        sockets.forEach((s) => junctionPins.add(`${c.id}-${s}`));
      }
    });

    const pinToWire = new Map<string, ArrowElement>();
    arrows.forEach((w) => {
      if (w.fromId && w.fromSocket) {
        pinToWire.set(`${w.fromId}-${w.fromSocket}`, w);
      }
      if (w.toId && w.toSocket) {
        pinToWire.set(`${w.toId}-${w.toSocket}`, w);
      }
    });

    const visitedWires = new Set<string>();
    const combinedCardIds = new Set<string>();

    const addChainSegment = (chain: { type: 'wire' | 'comp'; id: string; element: any }[]) => {
      if (chain.length === 0) return;

      // If the branch contains only 1 wire and it is a ground wire, skip it
      if (chain.length === 1 && chain[0].type === 'wire') {
        const w = chain[0].element as ArrowElement;
        const isGndWire = w.netName === '0.0' || 
                          cards.some((c) => c.componentType === 'ground' && (w.fromId === c.id || w.toId === c.id));
        if (isGndWire) {
          return;
        }
      }

      // Determine starting pin and ending pin of the chain
      const firstWire = (chain[0].type === 'wire' ? chain[0].element : chain[1].element) as ArrowElement;
      const lastWire = (chain[chain.length - 1].type === 'wire' ? chain[chain.length - 1].element : chain[chain.length - 2].element) as ArrowElement;
      
      const pinStart = `${firstWire.fromId}-${firstWire.fromSocket}`;
      const pinEnd = `${lastWire.toId}-${lastWire.toSocket}`;
      
      const rootStart = uf.find(pinStart);
      const rootEnd = uf.find(pinEnd);
      const vStart = rootVoltage[rootStart] ?? 0;
      const vEnd = rootVoltage[rootEnd] ?? 0;

      const hasSource = chain.some(
        (item) => item.type === 'comp' &&
                  ((item.element as CardElement).componentType === 'voltage' ||
                   (item.element as CardElement).componentType === 'current')
      );

      let reverseChain = false;
      if (Math.abs(vStart - vEnd) > 1e-6) {
        if (hasSource) {
          // For source-driven branches, flow goes from low voltage to high voltage
          reverseChain = vStart > vEnd;
        } else {
          // For passive branches, flow goes from high voltage to low voltage
          reverseChain = vStart < vEnd;
        }
      } else {
        // Fallback: use DSU BFS scoring if potentials are equal (e.g., zero current)
        const scoreStart = scoreMap[pinStart] ?? 0;
        const scoreEnd = scoreMap[pinEnd] ?? 0;
        reverseChain = scoreStart > scoreEnd;
      }
      
      if (reverseChain) {
        chain.reverse();
      }

      const elementPaths: Point[][] = [];
      chain.forEach((item) => {
        if (item.type === 'wire') {
          const w = item.element as ArrowElement;
          const sStart = `${w.fromId}-${w.fromSocket}`;
          const scoreStartW = scoreMap[sStart] ?? 0;
          const scoreEndW = scoreMap[`${w.toId}-${w.toSocket}`] ?? 0;
          const isForward = scoreStartW <= scoreEndW;
          
          const pathDirection = reverseChain ? !isForward : isForward;
          elementPaths.push(getWirePoints(w, pathDirection, cards));
        } else {
          const comp = item.element as CardElement;
          const ptLeft = getSocketPosition(comp, 'left');
          const ptRight = getSocketPosition(comp, 'right');
          const solved = solvedResults[comp.id];
          const vLeft = solved?.vLeft || 0;
          const vRight = solved?.vRight || 0;
          const signedI = solved?.signedCurrent || 0;
          
          let leftToRight = true;
          if (vLeft > vRight) {
            leftToRight = true;
          } else if (vRight > vLeft) {
            leftToRight = false;
          } else {
            leftToRight = signedI > 0;
          }
          
          const pathDirection = reverseChain ? !leftToRight : leftToRight;
          elementPaths.push(pathDirection ? [ptLeft, ptRight] : [ptRight, ptLeft]);
        }
      });
      
      const mergedPath = mergePaths(elementPaths);
      const length = getPathLength(mergedPath);
      
      let branchCurrentVal = 0;
      const compItem = chain.find((item) => item.type === 'comp');
      if (compItem) {
        const solved = solvedResults[compItem.id];
        branchCurrentVal = Math.abs(solved?.branchCurrent || 0);
      } else {
        const wireItem = chain.find((item) => item.type === 'wire');
        if (wireItem) {
          const w = wireItem.element as ArrowElement;
          const sStart = `${w.fromId}-${w.fromSocket}`;
          const root = uf.find(sStart);
          branchCurrentVal = nodeMaxCurrents[root] || 0;
          
          const connectedCard = cards.find((c) => c.componentType && (w.fromId === c.id || w.toId === c.id));
          if (connectedCard) {
            const solved = solvedResults[connectedCard.id];
            if (solved) {
              branchCurrentVal = solved.branchCurrent;
            }
          } else if (w.netName === '1' || w.netName?.startsWith('1.')) {
            const r2Card = cards.find((c) => c.componentType === 'resistor' && c.instanceNumber === 2);
            if (r2Card && solvedResults[r2Card.id]) {
              branchCurrentVal = solvedResults[r2Card.id].branchCurrent;
            }
          }
        }
      }
      const speed = getSpeedForCurrent(branchCurrentVal, maxI);

      newSegments.push({
        id: `${chain[0].id}-combined`,
        path: mergedPath,
        length,
        speed,
        spawnAccumulator: 0
      });
    };

    const traceChain = (startPin: string) => {
      const w = pinToWire.get(startPin);
      if (!w || visitedWires.has(w.id)) return;

      const chain: { type: 'wire' | 'comp'; id: string; element: any }[] = [];
      let currPin = startPin;
      let currWire = w;

      while (true) {
        visitedWires.add(currWire.id);
        chain.push({ type: 'wire', id: currWire.id, element: currWire });

        const otherPin = (currPin === `${currWire.fromId}-${currWire.fromSocket}`) 
          ? `${currWire.toId}-${currWire.toSocket}` 
          : `${currWire.fromId}-${currWire.fromSocket}`;

        const dashIdx = otherPin.lastIndexOf('-');
        const cardId = otherPin.substring(0, dashIdx);
        const socket = otherPin.substring(dashIdx + 1);

        const card = cards.find((c) => c.id === cardId);
        if (!card || junctionPins.has(otherPin)) {
          break;
        }

        chain.push({ type: 'comp', id: card.id, element: card });
        combinedCardIds.add(card.id);

        const oppositeSocket = (socket === 'left') ? 'right' : 'left';
        const nextPin = `${card.id}-${oppositeSocket}`;

        const nextWire = pinToWire.get(nextPin);
        if (!nextWire || visitedWires.has(nextWire.id)) {
          break;
        }

        currPin = nextPin;
        currWire = nextWire;
      }

      addChainSegment(chain);
    };

    // Trace branches starting from junctions
    junctionPins.forEach((pin) => {
      traceChain(pin);
    });

    // Trace any remaining untraced wires (loops)
    arrows.forEach((w) => {
      if (!w.fromId || !w.fromSocket || !w.toId || !w.toSocket) return;
      if (visitedWires.has(w.id)) return;
      traceChain(`${w.fromId}-${w.fromSocket}`);
    });

    // Add remaining Component segments (open components)
    compCards.forEach((card) => {
      if (
        card.componentType === 'ground' ||
        card.componentType === 'voltage' ||
        card.componentType === 'current'
      ) {
        return;
      }

      if (combinedCardIds.has(card.id)) {
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

      newSegments.push({ id: card.id, path, length, speed, spawnAccumulator: 0 });
    });

    // 5. Interpolate old electron progress values onto new segments
    const oldElectronsBySegment = new Map<string, number[]>();
    electronsRef.current.forEach((e) => {
      if (!oldElectronsBySegment.has(e.segmentId)) {
        oldElectronsBySegment.set(e.segmentId, []);
      }
      oldElectronsBySegment.get(e.segmentId)!.push(e.progress);
    });

    const newElectrons: Electron[] = [];
    newSegments.forEach((seg) => {
      const existing = segmentsRef.current.find((s) => s.id === seg.id);
      if (existing) {
        seg.spawnAccumulator = existing.spawnAccumulator;
      }

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

      // 1. Update positions and filter out completed electrons (delete on joints)
      const activeElectrons = electronsRef.current.filter((e) => {
        const seg = segmentMap.get(e.segmentId);
        if (!seg || seg.speed <= 0) return false;
        
        e.progress += seg.speed * dt;
        return e.progress < seg.length; // delete once it reaches the end joint
      });

      // 2. Spawn new electrons at the start joint based on distance traveled
      segments.forEach((seg) => {
        if (seg.speed <= 0) return;
        
        seg.spawnAccumulator = (seg.spawnAccumulator || 0) + seg.speed * dt;
        while (seg.spawnAccumulator >= 40) {
          seg.spawnAccumulator -= 40;
          activeElectrons.push({
            segmentId: seg.id,
            progress: seg.spawnAccumulator
          });
        }
      });

      electronsRef.current = activeElectrons;

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

          // Configure standard neon cyan style
          setupElectronStyles(ctx);

          electronsRef.current.forEach((e) => {
            const seg = segmentMap.get(e.segmentId);
            if (seg) {
              const pos = getPositionAlongPath(seg.path, e.progress);
              drawElectron(ctx, pos);
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
