import React, { useState } from 'react';
import type { CanvasElement, CardElement, ArrowElement } from '../../../dataTypes/AnotateType';
import { solveLinearSystem } from '../../../sim/components/mnaSolver';
import { formatEngineering } from '../../../utils/math';


interface MNAWalkthroughProps {
  elements: CanvasElement[];
}

export const MNAWalkthrough: React.FC<MNAWalkthroughProps> = ({ elements }) => {
  const cards = elements.filter((el) => el.type === 'box') as CardElement[];
  const arrows = elements.filter((el) => el.type === 'arrow') as ArrowElement[];

  // 1. UnionFind helper to find electrical nodes
  class UF {
    parent: Record<string, string> = {};
    find(id: string): string {
      if (!this.parent[id]) this.parent[id] = id;
      if (this.parent[id] === id) return id;
      this.parent[id] = this.find(this.parent[id]);
      return this.parent[id];
    }
    union(x: string, y: string) {
      const rootX = this.find(x);
      const rootY = this.find(y);
      if (rootX !== rootY) this.parent[rootX] = rootY;
    }
  }

  const uf = new UF();
  cards.forEach((card) => {
    if (card.id.startsWith('join') || card.title === 'join') {
      uf.union(`${card.id}-top`, `${card.id}-right`);
      uf.union(`${card.id}-top`, `${card.id}-bottom`);
      uf.union(`${card.id}-top`, `${card.id}-left`);
    }
  });

  arrows.forEach((w) => {
    if (w.fromId && w.fromSocket && w.toId && w.toSocket) {
      uf.union(`${w.fromId}-${w.fromSocket}`, `${w.toId}-${w.toSocket}`);
    }
  });

  const groups: Record<string, string[]> = {};
  cards.forEach((card) => {
    const isGround = card.componentType === 'ground';
    const isJoin = card.id.startsWith('join') || card.title === 'join';
    const isBjt = card.componentType === 'bjt';
    const portsList = isGround ? ['top'] : (isJoin ? ['top', 'right', 'bottom', 'left'] : (isBjt ? ['left', 'top', 'bottom'] : ['left', 'right']));
    
    portsList.forEach((socket) => {
      const pin = `${card.id}-${socket}`;
      const root = uf.find(pin);
      if (!groups[root]) groups[root] = [];
      groups[root].push(pin);
    });
  });

  const gndRoots = new Set<string>();
  Object.keys(groups).forEach((root) => {
    const hasGndPin = groups[root].some((pin) => {
      const cardId = pin.substring(0, pin.lastIndexOf('-'));
      const card = cards.find((c) => c.id === cardId);
      return card?.componentType === 'ground';
    });
    if (hasGndPin) gndRoots.add(root);
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
  const voltageSources = cards.filter((c) => c.componentType === 'voltage' || c.componentType === 'acvoltage');
  const group2Resistors = cards.filter((c) => c.componentType === 'resistor' && c.isGroup2);
  const inductors = cards.filter((c) => c.componentType === 'inductor');
  
  // In MNA formulation, voltage sources, inductors, and Group 2 resistors introduce branch current variables
  const group2Elements = [...voltageSources, ...inductors, ...group2Resistors];
  const mnaSize = nodeCount + group2Elements.length;

  // Render a placeholder if the circuit is empty or invalid
  if (mnaSize === 0) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        padding: '24px',
        color: 'rgba(255, 255, 255, 0.6)',
        fontSize: '12px',
        textAlign: 'center',
        background: 'rgba(15, 23, 42, 0.2)',
        borderRadius: '12px',
        border: '1px dashed rgba(255,255,255,0.1)'
      }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '8px', opacity: 0.5 }}>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M9 12h6" />
          <path d="M12 9v6" />
        </svg>
        <div>Please add some components (like a voltage source, resistor, and ground) on the canvas to see the MNA Walkthrough for the actual circuit.</div>
      </div>
    );
  }

  const getDesignator = (card: CardElement) => {
    const prefix = card.componentType === 'resistor' ? 'R' : card.componentType === 'capacitor' ? 'C' : card.componentType === 'inductor' ? 'L' : card.componentType === 'voltage' ? 'V' : card.componentType === 'acvoltage' ? 'Vac' : card.componentType === 'current' ? 'I' : card.componentType === 'diode' ? 'D' : card.componentType === 'bjt' ? 'Q' : 'GND';
    return `${prefix}${card.instanceNumber || 1}`;
  };

  const g2ElementMap: Record<string, number> = {};
  let g2Index = nodeCount;
  group2Elements.forEach((el) => {
    g2ElementMap[el.id] = g2Index++;
  });

  const variableLabels: string[] = [];
  for (let i = 1; i <= nodeCount; i++) {
    variableLabels.push(`v(${i})`);
  }
  group2Elements.forEach((el) => {
    variableLabels.push(`i(${getDesignator(el)})`);
  });

  // 2. Solve operating point system
  let solvedVoltages: Record<string, number> = { '0': 0 };
  let solvedX = new Array(mnaSize).fill(0);
  const hasNonLinear = cards.some((c) => c.componentType === 'diode' || c.componentType === 'bjt');

  const compileSystemWalkthrough = (voltages: Record<string, number>) => {
    const A_sys = Array.from({ length: mnaSize }, () => new Array(mnaSize).fill(0));
    const B_sys = new Array(mnaSize).fill(0);

    // Resistors, Inductors
    cards.forEach((card) => {
      if (card.componentType === 'resistor' || card.componentType === 'inductor') {
        const n1Str = getPinNode(card.id, 'left');
        const n2Str = getPinNode(card.id, 'right');
        const n1 = parseInt(n1Str, 10);
        const n2 = parseInt(n2Str, 10);
        let rVal = card.componentType === 'inductor' ? 1e-3 : (card.value !== undefined ? (card.value <= 0 ? 1e-3 : card.value) : 1000);

        if (card.componentType === 'resistor' && card.isGroup2) {
          const idx = g2ElementMap[card.id];
          if (n1 > 0) A_sys[n1 - 1][idx] += 1;
          if (n2 > 0) A_sys[n2 - 1][idx] -= 1;
          if (n1 > 0) A_sys[idx][n1 - 1] += 1;
          if (n2 > 0) A_sys[idx][n2 - 1] -= 1;
          A_sys[idx][idx] -= rVal;
        } else {
          const g = 1 / rVal;
          if (n1 > 0) A_sys[n1 - 1][n1 - 1] += g;
          if (n2 > 0) A_sys[n2 - 1][n2 - 1] += g;
          if (n1 > 0 && n2 > 0) {
            A_sys[n1 - 1][n2 - 1] -= g;
            A_sys[n2 - 1][n1 - 1] -= g;
          }
        }
      }
    });

    // Sources
    voltageSources.forEach((vSrc) => {
      const n1Str = getPinNode(vSrc.id, 'left');
      const n2Str = getPinNode(vSrc.id, 'right');
      const n1 = parseInt(n1Str, 10);
      const n2 = parseInt(n2Str, 10);
      const val = vSrc.value !== undefined ? vSrc.value : 5;
      const idx = g2ElementMap[vSrc.id];
      if (n1 > 0) A_sys[n1 - 1][idx] += 1;
      if (n2 > 0) A_sys[n2 - 1][idx] -= 1;
      if (n1 > 0) A_sys[idx][n1 - 1] += 1;
      if (n2 > 0) A_sys[idx][n2 - 1] -= 1;
      B_sys[idx] = val;
    });

    inductors.forEach((card) => {
      const n1Str = getPinNode(card.id, 'left');
      const n2Str = getPinNode(card.id, 'right');
      const n1 = parseInt(n1Str, 10);
      const n2 = parseInt(n2Str, 10);
      const idx = g2ElementMap[card.id];
      if (n1 > 0) A_sys[n1 - 1][idx] += 1;
      if (n2 > 0) A_sys[n2 - 1][idx] -= 1;
      if (n1 > 0) A_sys[idx][n1 - 1] += 1;
      if (n2 > 0) A_sys[idx][n2 - 1] -= 1;
    });

    cards.forEach((card) => {
      if (card.componentType === 'current') {
        const n1Str = getPinNode(card.id, 'left');
        const n2Str = getPinNode(card.id, 'right');
        const n1 = parseInt(n1Str, 10);
        const n2 = parseInt(n2Str, 10);
        const val = card.value !== undefined ? card.value : 0.001;
        if (n1 > 0) B_sys[n1 - 1] -= val;
        if (n2 > 0) B_sys[n2 - 1] += val;
      }
    });

    // Diodes
    cards.forEach((card) => {
      if (card.componentType === 'diode') {
        const n1Str = getPinNode(card.id, 'left');
        const n2Str = getPinNode(card.id, 'right');
        const n1 = parseInt(n1Str, 10);
        const n2 = parseInt(n2Str, 10);
        const vd = (voltages[n1Str] || 0) - (voltages[n2Str] || 0);
        const vdClamped = Math.max(-1.0, Math.min(0.8, vd));
        
        const Is = 1e-14;
        const Vt = 0.026;
        const expTerm = Math.exp(vdClamped / Vt);
        const gd = (Is / Vt) * expTerm;
        const id = Is * (expTerm - 1);
        const Ieq = id - gd * vdClamped;

        if (n1 > 0) A_sys[n1 - 1][n1 - 1] += gd;
        if (n2 > 0) A_sys[n2 - 1][n2 - 1] += gd;
        if (n1 > 0 && n2 > 0) {
          A_sys[n1 - 1][n2 - 1] -= gd;
          A_sys[n2 - 1][n1 - 1] -= gd;
        }
        if (n1 > 0) B_sys[n1 - 1] -= Ieq;
        if (n2 > 0) B_sys[n2 - 1] += Ieq;
      }
    });

    // BJTs
    cards.forEach((card) => {
      if (card.componentType === 'bjt') {
        const nCStr = getPinNode(card.id, 'top');
        const nBStr = getPinNode(card.id, 'left');
        const nEStr = getPinNode(card.id, 'bottom');
        const nc = parseInt(nCStr, 10);
        const nb = parseInt(nBStr, 10);
        const ne = parseInt(nEStr, 10);

        const vC = voltages[nCStr] || 0;
        const vB = voltages[nBStr] || 0;
        const vE = voltages[nEStr] || 0;
        const vbe = vB - vE;
        const vbc = vB - vC;

        const vbeClamped = Math.max(-1.0, Math.min(0.8, vbe));
        const vbcClamped = Math.max(-1.0, Math.min(0.8, vbc));

        const Is = 1e-14;
        const Vt = 0.026;
        const betaF = card.value !== undefined ? card.value : 100;
        const betaR = 1;

        const expTermF = Math.exp(vbeClamped / Vt);
        const expTermR = Math.exp(vbcClamped / Vt);

        const gf = (Is / Vt) * expTermF;
        const gr = (Is / Vt) * expTermR;

        const If = Is * (expTermF - 1);
        const Ir = Is * (expTermR - 1);

        const IeqF = If - gf * vbeClamped;
        const IeqR = Ir - gr * vbcClamped;

        const Gcc = (1 + 1 / betaR) * gr;
        const Gcb = gf - (1 + 1 / betaR) * gr;
        const Gce = -gf;

        const Gbc = -gr / betaR;
        const Gbb = gf / betaF + gr / betaR;
        const Gbe = -gf / betaF;

        const Gec = -gr;
        const Geb = -(1 + 1 / betaF) * gf + gr;
        const Gee = (1 + 1 / betaF) * gf;

        const Bc = -IeqF + (1 + 1 / betaR) * IeqR;
        const Bb = -IeqF / betaF - IeqR / betaR;
        const Be = (1 + 1 / betaF) * IeqF - IeqR;

        if (nc > 0) {
          A_sys[nc - 1][nc - 1] += Gcc;
          if (nb > 0) A_sys[nc - 1][nb - 1] += Gcb;
          if (ne > 0) A_sys[nc - 1][ne - 1] += Gce;
          B_sys[nc - 1] += Bc;
        }
        if (nb > 0) {
          if (nc > 0) A_sys[nb - 1][nc - 1] += Gbc;
          A_sys[nb - 1][nb - 1] += Gbb;
          if (ne > 0) A_sys[nb - 1][ne - 1] += Gbe;
          B_sys[nb - 1] += Bb;
        }
        if (ne > 0) {
          if (nc > 0) A_sys[ne - 1][nc - 1] += Gec;
          if (nb > 0) A_sys[ne - 1][nb - 1] += Geb;
          A_sys[ne - 1][ne - 1] += Gee;
          B_sys[ne - 1] += Be;
        }
      }
    });

    return { A: A_sys, B: B_sys };
  };

  interface NonLinearStampRecord {
    designator: string;
    type: 'diode' | 'bjt';
    vd?: number;
    gd?: number;
    Ieq?: number;
    vbe?: number;
    vbc?: number;
    iCollector?: number;
    iBase?: number;
    highlights: string[];
  }

  interface IterationRecord {
    iterIndex: number;
    voltagesGuess: Record<string, number>;
    nonLinearStamps: NonLinearStampRecord[];
    A: number[][];
    B: number[];
    nextX: number[];
    residual: number[];
    converged: boolean;
  }

  const iterationsList: IterationRecord[] = [];
  let voltagesGuess: Record<string, number> = { '0': 0 };
  for (let i = 1; i <= nodeCount; i++) voltagesGuess[String(i)] = 0.0;

  const maxWalkthroughIterations = 15;
  const tolV = 1e-3;
  const tolI = 1e-6;
  let finalVoltages = { ...voltagesGuess };
  let finalX = new Array(mnaSize).fill(0);

  for (let iter = 0; iter < maxWalkthroughIterations; iter++) {
    // Compile at current voltagesGuess
    const { A: A_iter, B: B_iter } = compileSystemWalkthrough(voltagesGuess);

    // Dynamic non-linear element info for walkthrough explanations
    const nonLinearStamps: NonLinearStampRecord[] = [];
    cards.forEach((card) => {
      if (card.componentType === 'diode') {
        const n1Str = getPinNode(card.id, 'left');
        const n2Str = getPinNode(card.id, 'right');
        const n1 = parseInt(n1Str, 10);
        const n2 = parseInt(n2Str, 10);
        const vd = (voltagesGuess[n1Str] || 0) - (voltagesGuess[n2Str] || 0);
        const vdClamped = Math.max(-1.0, Math.min(0.8, vd));
        
        const Is = 1e-14;
        const Vt = 0.026;
        const expTerm = Math.exp(vdClamped / Vt);
        const gd = (Is / Vt) * expTerm;
        const id = Is * (expTerm - 1);
        const Ieq = id - gd * vdClamped;

        const highlights: string[] = [];
        if (n1 > 0) highlights.push(`${n1 - 1}-${n1 - 1}`, `rhs-${n1 - 1}`);
        if (n2 > 0) highlights.push(`${n2 - 1}-${n2 - 1}`, `rhs-${n2 - 1}`);
        if (n1 > 0 && n2 > 0) {
          highlights.push(`${n1 - 1}-${n2 - 1}`, `${n2 - 1}-${n1 - 1}`);
        }

        nonLinearStamps.push({
          designator: getDesignator(card),
          type: 'diode',
          vd,
          gd,
          Ieq,
          highlights
        });
      } else if (card.componentType === 'bjt') {
        const nCStr = getPinNode(card.id, 'top');
        const nBStr = getPinNode(card.id, 'left');
        const nEStr = getPinNode(card.id, 'bottom');
        const nc = parseInt(nCStr, 10);
        const nb = parseInt(nBStr, 10);
        const ne = parseInt(nEStr, 10);

        const vC = voltagesGuess[nCStr] || 0;
        const vB = voltagesGuess[nBStr] || 0;
        const vE = voltagesGuess[nEStr] || 0;
        const vbe = vB - vE;
        const vbc = vB - vC;

        const vbeClamped = Math.max(-1.0, Math.min(0.8, vbe));
        const vbcClamped = Math.max(-1.0, Math.min(0.8, vbc));

        const Is = 1e-14;
        const Vt = 0.026;
        const betaF = card.value !== undefined ? card.value : 100;
        const betaR = 1;

        const expTermF = Math.exp(vbeClamped / Vt);
        const expTermR = Math.exp(vbcClamped / Vt);

        const If = Is * (expTermF - 1);
        const Ir = Is * (expTermR - 1);

        const Ic = If - Ir - Ir / betaR;
        const Ib = If / betaF + Ir / betaR;

        const highlights: string[] = [];
        if (nc > 0) highlights.push(`${nc - 1}-${nc - 1}`, `rhs-${nc - 1}`);
        if (nb > 0) highlights.push(`${nb - 1}-${nb - 1}`, `rhs-${nb - 1}`);
        if (ne > 0) highlights.push(`${ne - 1}-${ne - 1}`, `rhs-${ne - 1}`);

        nonLinearStamps.push({
          designator: getDesignator(card),
          type: 'bjt',
          vbe,
          vbc,
          iCollector: Ic,
          iBase: Ib,
          highlights
        });
      }
    });

    let nextX = new Array(mnaSize).fill(0);
    try {
      nextX = solveLinearSystem(A_iter, B_iter);
    } catch (e) {
      break;
    }

    const nextVoltages: Record<string, number> = { '0': 0 };
    for (let i = 1; i <= nodeCount; i++) {
      nextVoltages[String(i)] = nextX[i - 1] || 0;
    }

    // Compile at nextVoltages to compute residual f(x_next) = A_next * x_next - B_next
    const { A: A_next, B: B_next } = compileSystemWalkthrough(nextVoltages);
    const residual = new Array(mnaSize).fill(0);
    for (let r = 0; r < mnaSize; r++) {
      let sum = 0;
      for (let c = 0; c < mnaSize; c++) {
        sum += A_next[r][c] * nextX[c];
      }
      residual[r] = sum - B_next[r];
    }

    // Convergence check
    let converged = true;
    for (let i = 0; i < mnaSize; i++) {
      if (i < nodeCount) {
        if (Math.abs(residual[i]) >= tolI) converged = false;
      } else {
        if (Math.abs(residual[i]) >= tolV) converged = false;
      }
    }

    iterationsList.push({
      iterIndex: iter + 1,
      voltagesGuess: { ...voltagesGuess },
      nonLinearStamps,
      A: A_iter.map(row => [...row]),
      B: [...B_iter],
      nextX: [...nextX],
      residual,
      converged
    });

    voltagesGuess = nextVoltages;
    finalVoltages = nextVoltages;
    finalX = nextX;

    if (converged) break;
  }

  solvedVoltages = finalVoltages;
  solvedX = finalX;

  // Helper to add a card's stamp into a matrix and RHS and return modified cell IDs (for Step 2 linear stamps)
  const addStampToSystem = (card: CardElement, A_sys: number[][], B_sys: number[]) => {
    const n1Str = getPinNode(card.id, 'left');
    const n2Str = getPinNode(card.id, 'right');
    const n1 = parseInt(n1Str, 10);
    const n2 = parseInt(n2Str, 10);
    const modifiedCells: string[] = [];

    if (card.componentType === 'resistor' || card.componentType === 'inductor') {
      let rVal = card.componentType === 'inductor' ? 1e-3 : (card.value !== undefined ? (card.value <= 0 ? 1e-3 : card.value) : 1000);
      if (card.componentType === 'resistor' && card.isGroup2) {
        const idx = g2ElementMap[card.id];
        if (n1 > 0) { A_sys[n1 - 1][idx] += 1; modifiedCells.push(`${n1 - 1}-${idx}`); }
        if (n2 > 0) { A_sys[n2 - 1][idx] -= 1; modifiedCells.push(`${n2 - 1}-${idx}`); }
        if (n1 > 0) { A_sys[idx][n1 - 1] += 1; modifiedCells.push(`${idx}-${n1 - 1}`); }
        if (n2 > 0) { A_sys[idx][n2 - 1] -= 1; modifiedCells.push(`${idx}-${n2 - 1}`); }
        A_sys[idx][idx] -= rVal; modifiedCells.push(`${idx}-${idx}`);
      } else {
        const g = 1 / rVal;
        if (n1 > 0) { A_sys[n1 - 1][n1 - 1] += g; modifiedCells.push(`${n1 - 1}-${n1 - 1}`); }
        if (n2 > 0) { A_sys[n2 - 1][n2 - 1] += g; modifiedCells.push(`${n2 - 1}-${n2 - 1}`); }
        if (n1 > 0 && n2 > 0) {
          A_sys[n1 - 1][n2 - 1] -= g; modifiedCells.push(`${n1 - 1}-${n2 - 1}`);
          A_sys[n2 - 1][n1 - 1] -= g; modifiedCells.push(`${n2 - 1}-${n1 - 1}`);
        }
      }
    } else if (card.componentType === 'voltage' || card.componentType === 'acvoltage') {
      const val = card.value !== undefined ? card.value : 5;
      const idx = g2ElementMap[card.id];
      if (n1 > 0) { A_sys[n1 - 1][idx] += 1; modifiedCells.push(`${n1 - 1}-${idx}`); }
      if (n2 > 0) { A_sys[n2 - 1][idx] -= 1; modifiedCells.push(`${n2 - 1}-${idx}`); }
      if (n1 > 0) { A_sys[idx][n1 - 1] += 1; modifiedCells.push(`${idx}-${n1 - 1}`); }
      if (n2 > 0) { A_sys[idx][n2 - 1] -= 1; modifiedCells.push(`${idx}-${n2 - 1}`); }
      B_sys[idx] = val; modifiedCells.push(`rhs-${idx}`);
    } else if (card.componentType === 'current') {
      const val = card.value !== undefined ? card.value : 0.001;
      if (n1 > 0) { B_sys[n1 - 1] -= val; modifiedCells.push(`rhs-${n1 - 1}`); }
      if (n2 > 0) { B_sys[n2 - 1] += val; modifiedCells.push(`rhs-${n2 - 1}`); }
    } else if (card.componentType === 'diode') {
      const diodeCards = cards.filter((c) => c.componentType === 'diode');
      const dIdx = diodeCards.findIndex((c) => c.id === card.id);
      if (dIdx !== -1) {
        if (n1 > 0) modifiedCells.push(`H-${n1 - 1}-${dIdx}`);
        if (n2 > 0) modifiedCells.push(`H-${n2 - 1}-${dIdx}`);
      }
    } else if (card.componentType === 'bjt') {
      const nCStr = getPinNode(card.id, 'top');
      const nBStr = getPinNode(card.id, 'left');
      const nEStr = getPinNode(card.id, 'bottom');
      const nc = parseInt(nCStr, 10);
      const nb = parseInt(nBStr, 10);
      const ne = parseInt(nEStr, 10);
      if (nc > 0) modifiedCells.push(`${nc - 1}-${nc - 1}`);
      if (nb > 0) modifiedCells.push(`${nb - 1}-${nb - 1}`);
      if (ne > 0) modifiedCells.push(`${ne - 1}-${ne - 1}`);
    }

    return modifiedCells;
  };

  // 3. Programmatically generate walkthrough steps list
  interface WalkthroughStep {
    title: string;
    desc: string;
    matrix: number[][];
    rhs: number[];
    highlights: string[];
    variableValues: string[];
  }

  const nmaSteps: WalkthroughStep[] = [];

  // Step 1: Equation Dimensions
  nmaSteps.push({
    title: 'Step 1: Set Equation Dimensions',
    desc: `We construct a ${mnaSize}x${mnaSize} Modified Nodal Analysis (MNA) matrix system to solve for the unknown node voltages and branch currents of the actual circuit. The variables vector is [${variableLabels.join(', ')}]. All cells start at 0.`,
    matrix: Array.from({ length: mnaSize }, () => new Array(mnaSize).fill(0)),
    rhs: new Array(mnaSize).fill(0),
    highlights: [],
    variableValues: variableLabels
  });

  // Step 2: Accumulate Element Stamps
  const A_temp = Array.from({ length: mnaSize }, () => new Array(mnaSize).fill(0));
  const B_temp = new Array(mnaSize).fill(0);
  const elementsToStamp = cards.filter((c) => c.componentType !== undefined && c.componentType !== 'ground');
  
  const substeps: Array<{ title: string; stepIndex: number }> = [];

  elementsToStamp.forEach((card) => {
    const highlights = addStampToSystem(card, A_temp, B_temp);
    const designator = getDesignator(card);
    const n1Str = getPinNode(card.id, 'left');
    const n2Str = getPinNode(card.id, 'right');

    let desc = `This is the stamp for element ${designator}. `;
    if (card.componentType === 'resistor') {
      const val = card.value !== undefined ? card.value : 1000;
      desc += `Resistor connects Node ${n1Str} and Node ${n2Str}. We stamp a conductance of 1/R = ${(1 / (val || 1e-3)).toFixed(4)} S.`;
    } else if (card.componentType === 'voltage' || card.componentType === 'acvoltage') {
      const val = card.value !== undefined ? card.value : 5;
      const srcType = card.componentType === 'voltage' ? 'Voltage source' : 'AC voltage source';
      desc += `${srcType} connects Node ${n1Str} (+) and Node ${n2Str} (-), enforcing a fixed potential difference of ${val}V.`;
    } else if (card.componentType === 'current') {
      const val = card.value !== undefined ? card.value : 0.001;
      desc += `Current source connects Node ${n1Str} (positive) and Node ${n2Str} (negative), injecting a current of ${val} A.`;
    } else if (card.componentType === 'inductor') {
      desc += `Inductor connects Node ${n1Str} and Node ${n2Str}, stamped as a short circuit in DC analysis.`;
    } else if (card.componentType === 'capacitor') {
      desc += `Capacitor connects Node ${n1Str} and Node ${n2Str}, stamped as an open circuit in DC analysis.`;
    } else if (card.componentType === 'diode') {
      desc += `Diode connects Node ${n1Str} (Anode) and Node ${n2Str} (Cathode). In the MNA formulation, it introduces a column in selector matrix H. We stamp +1 at Node ${n1Str}'s KCL (leaving anode) and -1 at Node ${n2Str}'s KCL (entering cathode).`;
    } else if (card.componentType === 'bjt') {
      const nC = getPinNode(card.id, 'top');
      const nB = getPinNode(card.id, 'left');
      const nE = getPinNode(card.id, 'bottom');
      desc += `BJT connects Node ${nC} (Collector), Node ${nB} (Base), and Node ${nE} (Emitter). In the linear system setup, its entries are placeholder conductances and companion sources to be refined in Newton-Raphson iterations.`;
    }

    nmaSteps.push({
      title: `Step 2: Add ${designator} Stamp`,
      desc,
      matrix: A_temp.map(row => [...row]),
      rhs: [...B_temp],
      highlights,
      variableValues: variableLabels
    });

    substeps.push({
      title: `Stamp: ${designator}`,
      stepIndex: nmaSteps.length - 1
    });
  });

  const nrSubsteps: Array<{ title: string; stepIndex: number }> = [];

  if (hasNonLinear) {
    // Newton-Raphson iterations steps
    iterationsList.forEach((record) => {
      let desc = `Newton-Raphson Iteration ${record.iterIndex}. `;
      record.nonLinearStamps.forEach(ds => {
        if (ds.type === 'diode') {
          desc += `Diode ${ds.designator} has guessed Vd = ${ds.vd!.toFixed(4)} V. Stamped companion conductance gd = ${ds.gd!.toFixed(4)} S and companion current Ieq = ${(ds.Ieq! * 1000).toFixed(4)} mA. `;
        } else {
          desc += `BJT ${ds.designator} has guessed Vbe = ${ds.vbe!.toFixed(4)} V, Vbc = ${ds.vbc!.toFixed(4)} V. Companion currents: Ic = ${(ds.iCollector! * 1000).toFixed(4)} mA, Ib = ${(ds.iBase! * 1000).toFixed(4)} mA. `;
        }
      });

      const maxKcl = Math.max(...record.residual.slice(0, nodeCount).map(Math.abs));
      const maxBranch = record.residual.length > nodeCount ? Math.max(...record.residual.slice(nodeCount).map(Math.abs)) : 0;
      desc += `KCL Residual = ${(maxKcl * 1e6).toFixed(2)} uA, Branch Residual = ${(maxBranch * 1000).toFixed(2)} mV. `;

      if (record.converged) {
        desc += `Residuals are within tolerances (<1 uA, <1 mV). System has CONVERGED!`;
      } else {
        desc += `Residuals exceed tolerances. Continuing to next iteration.`;
      }

      // Build highlights for this iteration step:
      // Only highlight Residual f(x) elements that are acceptable (within tolerance)
      const stepHighlights: string[] = [];
      record.residual.forEach((resVal, idx) => {
        const isKcl = idx < nodeCount;
        const tol = isKcl ? tolI : tolV;
        if (Math.abs(resVal) < tol) {
          stepHighlights.push(`fx-${idx}`);
        }
      });

      nmaSteps.push({
        title: `Iteration ${record.iterIndex}`,
        desc,
        matrix: record.A,
        rhs: record.B,
        highlights: stepHighlights,
        variableValues: variableLabels.map((label, idx) => {
          const val = record.nextX[idx] || 0;
          const isCurrent = label.startsWith('i');
          return isCurrent ? `${(val * 1000).toFixed(2)} mA` : `${val.toFixed(2)} V`;
        })
      });

      nrSubsteps.push({
        title: `Iteration ${record.iterIndex}${record.converged ? ' (Converged)' : ''}`,
        stepIndex: nmaSteps.length - 1
      });
    });
  }

  // Final summary step
  const finalSystem = compileSystemWalkthrough(solvedVoltages);
  nmaSteps.push({
    title: hasNonLinear ? 'Step 4: Final Solution' : 'Step 3: Final Solution',
    desc: hasNonLinear 
      ? `Newton-Raphson iterations converged successfully. The final matrix and solved values are displayed below.`
      : `Solving the linear MNA equations yields the exact node voltages and branch currents shown below.`,
    matrix: finalSystem.A,
    rhs: finalSystem.B,
    highlights: [],
    variableValues: variableLabels.map((label, idx) => {
      const val = solvedX[idx] || 0;
      const isCurrent = label.startsWith('i');
      return isCurrent ? `${(val * 1000).toFixed(2)} mA` : `${val.toFixed(2)} V`;
    })
  });
  const solveStepIndex = nmaSteps.length - 1;

  interface MenuSection {
    id: string;
    title: string;
    stepIndex?: number;
    substeps?: Array<{ title: string; stepIndex: number }>;
  }

  // Side menu structure mapping
  const menuSections: MenuSection[] = [
    {
      id: 'step1',
      title: 'Step 1: Equation Dimensions',
      stepIndex: 0
    }
  ];

  if (substeps.length > 0) {
    menuSections.push({
      id: 'step2',
      title: 'Step 2: Add Linear Stamps',
      substeps
    });
  }

  if (hasNonLinear && nrSubsteps.length > 0) {
    menuSections.push({
      id: 'step3_nr',
      title: 'Step 3: Newton-Raphson',
      substeps: nrSubsteps
    });
  }

  menuSections.push({
    id: hasNonLinear ? 'step4_solve' : 'step3_solve',
    title: hasNonLinear ? 'Step 4: Final Solution' : 'Step 3: Solve System',
    stepIndex: solveStepIndex
  });

  const [nmaStep, setNmaStep] = useState<number>(0);
  const cellWidth = 90;
  const cellHeight = 56;
  const cellFontSize = 14;
  const currentStep = Math.min(nmaStep, nmaSteps.length - 1);


  const { G, H, x: xVector, gx: gxVector, s: sVector, fx: fxVector, diodeLabels } = (() => {
    let x = new Array(mnaSize).fill(0);
    let v: Record<string, number> = { '0': 0 };
    for (let i = 1; i <= nodeCount; i++) v[String(i)] = 0;

    if (currentStep === solveStepIndex) {
      x = solvedX;
      v = solvedVoltages;
    } else if (currentStep > 0 && currentStep < solveStepIndex) {
      const stepObj = nmaSteps[currentStep];
      const iterItem = iterationsList.find(item => `Iteration ${item.iterIndex}` === stepObj.title || `Iteration ${item.iterIndex} (Converged)` === stepObj.title);
      if (iterItem) {
        x = iterItem.nextX;
        for (let i = 1; i <= nodeCount; i++) {
          v[String(i)] = x[i - 1] || 0;
        }
      }
    }

    let G: number[][];
    let s: number[];

    if (currentStep < 1 + substeps.length) {
      // Use partial matrix and RHS stamps from the current step
      G = nmaSteps[currentStep].matrix.map(row => [...row]);
      s = [...nmaSteps[currentStep].rhs];
    } else {
      // Use fully assembled linear conductive system
      G = Array.from({ length: mnaSize }, () => new Array(mnaSize).fill(0));
      s = new Array(mnaSize).fill(0);

      cards.forEach((card) => {
        if (card.componentType === 'resistor' || card.componentType === 'inductor') {
          const n1Str = getPinNode(card.id, 'left');
          const n2Str = getPinNode(card.id, 'right');
          const n1 = parseInt(n1Str, 10);
          const n2 = parseInt(n2Str, 10);
          let rVal = card.componentType === 'inductor' ? 1e-3 : (card.value !== undefined ? (card.value <= 0 ? 1e-3 : card.value) : 1000);

          if (card.componentType === 'resistor' && card.isGroup2) {
            const idx = g2ElementMap[card.id];
            if (n1 > 0) { G[n1 - 1][idx] += 1; G[idx][n1 - 1] += 1; }
            if (n2 > 0) { G[n2 - 1][idx] -= 1; G[idx][n2 - 1] -= 1; }
            G[idx][idx] -= rVal;
          } else {
            const g = 1 / rVal;
            if (n1 > 0) G[n1 - 1][n1 - 1] += g;
            if (n2 > 0) G[n2 - 1][n2 - 1] += g;
            if (n1 > 0 && n2 > 0) {
              G[n1 - 1][n2 - 1] -= g;
              G[n2 - 1][n1 - 1] -= g;
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
        if (n1 > 0) { G[n1 - 1][idx] += 1; G[idx][n1 - 1] += 1; }
        if (n2 > 0) { G[n2 - 1][idx] -= 1; G[idx][n2 - 1] -= 1; }
        s[idx] = val;
      });

      inductors.forEach((card) => {
        const n1Str = getPinNode(card.id, 'left');
        const n2Str = getPinNode(card.id, 'right');
        const n1 = parseInt(n1Str, 10);
        const n2 = parseInt(n2Str, 10);
        const idx = g2ElementMap[card.id];
        if (n1 > 0) { G[n1 - 1][idx] += 1; G[idx][n1 - 1] += 1; }
        if (n2 > 0) { G[n2 - 1][idx] -= 1; G[idx][n2 - 1] -= 1; }
      });

      cards.forEach((card) => {
        if (card.componentType === 'current') {
          const n1Str = getPinNode(card.id, 'left');
          const n2Str = getPinNode(card.id, 'right');
          const n1 = parseInt(n1Str, 10);
          const n2 = parseInt(n2Str, 10);
          const val = card.value !== undefined ? card.value : 0.001;
          if (n1 > 0) s[n1 - 1] -= val;
          if (n2 > 0) s[n2 - 1] += val;
        }
      });
    }

    const Gx = new Array(mnaSize).fill(0);
    for (let r = 0; r < mnaSize; r++) {
      let sum = 0;
      for (let c = 0; c < mnaSize; c++) {
        sum += G[r][c] * x[c];
      }
      Gx[r] = sum;
    }

    const diodeCards = cards.filter((c) => c.componentType === 'diode');
    const D = diodeCards.length;
    const H = Array.from({ length: mnaSize }, () => new Array(D).fill(0));
    const gx = new Array(D).fill(0);
    const diodeLabels = diodeCards.map((c) => getDesignator(c));

    diodeCards.forEach((card, dIdx) => {
      const n1Str = getPinNode(card.id, 'left');
      const n2Str = getPinNode(card.id, 'right');
      const n1 = parseInt(n1Str, 10);
      const n2 = parseInt(n2Str, 10);

      // Check if this diode has been stamped up to the current walkthrough step
      let isStamped = true;
      if (currentStep < 1 + substeps.length) {
        const stampIdx = elementsToStamp.findIndex((el) => el.id === card.id);
        if (stampIdx === -1 || stampIdx >= currentStep) {
          isStamped = false;
        }
      }

      if (isStamped) {
        if (n1 > 0) H[n1 - 1][dIdx] = 1;
        if (n2 > 0) H[n2 - 1][dIdx] = -1;
      }

      const vd = (v[n1Str] || 0) - (v[n2Str] || 0);
      const vdClamped = Math.max(-1.0, Math.min(0.8, vd));
      const Is = 1e-14;
      const Vt = 0.026;
      gx[dIdx] = Is * (Math.exp(vdClamped / Vt) - 1);
    });

    const Hg = new Array(mnaSize).fill(0);
    for (let r = 0; r < mnaSize; r++) {
      let sum = 0;
      for (let c = 0; c < D; c++) {
        sum += H[r][c] * gx[c];
      }
      Hg[r] = sum;
    }

    const fx = Gx.map((val, r) => val + Hg[r] - s[r]);

    return { G, H, x, gx, s, fx, diodeLabels };
  })();

  const LeftBracket = () => (
    <div style={{
      width: '4px',
      borderLeft: '1.5px solid rgba(255, 255, 255, 0.35)',
      borderTop: '1.5px solid rgba(255, 255, 255, 0.35)',
      borderBottom: '1.5px solid rgba(255, 255, 255, 0.35)',
      borderRadius: '3px 0 0 3px',
      marginRight: '3px',
      alignSelf: 'stretch'
    }} />
  );

  const RightBracket = () => (
    <div style={{
      width: '4px',
      borderRight: '1.5px solid rgba(255, 255, 255, 0.35)',
      borderTop: '1.5px solid rgba(255, 255, 255, 0.35)',
      borderBottom: '1.5px solid rgba(255, 255, 255, 0.35)',
      borderRadius: '0 3px 3px 0',
      marginLeft: '3px',
      alignSelf: 'stretch'
    }} />
  );

  const D = diodeLabels.length;

  return (
    <div style={{ display: 'flex', height: '100%', gap: '16px', minHeight: 0 }}>
      {/* Side Menu */}
      <div style={{
        width: '185px',
        flexShrink: 0,
        background: 'rgba(15, 23, 42, 0.45)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '10px',
        padding: '10px',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        overflowY: 'auto',
        userSelect: 'none'
      }}>
        <div style={{ fontSize: '10px', fontWeight: 'bold', color: 'rgba(255,255,255,0.35)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em', paddingLeft: '4px' }}>
          MNA Walkthrough
        </div>
        {menuSections.map((sec) => {
          if (sec.substeps) {
            const isParentActive = sec.id === 'step2'
              ? (currentStep >= 1 && currentStep <= substeps.length)
              : (currentStep > substeps.length && currentStep < solveStepIndex);
            return (
              <div key={sec.id} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <div style={{
                  fontSize: '11px',
                  fontWeight: 'bold',
                  color: isParentActive ? 'var(--theme-sapphire)' : 'rgba(255,255,255,0.8)',
                  padding: '4px 6px',
                  borderRadius: '4px',
                  background: isParentActive ? 'rgba(59, 130, 246, 0.05)' : 'transparent',
                }}>
                  {sec.title}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', paddingLeft: '8px', borderLeft: '1px solid rgba(255,255,255,0.08)', marginLeft: '4px' }}>
                  {sec.substeps.map((sub: any) => {
                    const isActive = currentStep === sub.stepIndex;
                    return (
                      <button
                        key={sub.stepIndex}
                        onClick={() => setNmaStep(sub.stepIndex)}
                        style={{
                          background: isActive ? 'var(--theme-sapphire)' : 'transparent',
                          color: isActive ? '#fff' : 'rgba(255,255,255,0.55)',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '4px 6px',
                          fontSize: '10px',
                          textAlign: 'left',
                          cursor: 'pointer',
                          fontWeight: isActive ? 'bold' : 'normal',
                          boxShadow: isActive ? '0 0 6px var(--theme-sapphire-glow)' : 'none',
                          transition: 'all 0.15s',
                          width: '100%'
                        }}
                      >
                        {sub.title}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          } else {
            const isActive = currentStep === sec.stepIndex;
            return (
              <button
                key={sec.id}
                onClick={() => setNmaStep(sec.stepIndex!)}
                style={{
                  background: isActive ? 'var(--theme-sapphire)' : 'transparent',
                  color: isActive ? '#fff' : 'rgba(255,255,255,0.8)',
                  border: 'none',
                  borderRadius: '5px',
                  padding: '6px 8px',
                  fontSize: '11px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  boxShadow: isActive ? '0 0 6px var(--theme-sapphire-glow)' : 'none',
                  transition: 'all 0.15s',
                  width: '100%'
                }}
              >
                {sec.title}
              </button>
            );
          }
        })}
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', minWidth: 0, height: '100%' }}>
        {/* Explanation Box */}
        <div style={{
          fontSize: '11px',
          lineHeight: '1.45',
          color: 'rgba(255, 255, 255, 0.8)',
          background: 'rgba(15, 23, 42, 0.4)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '8px',
          padding: '10px 12px',
          minHeight: '56px',
          overflowY: 'auto'
        }}>
          {nmaSteps[currentStep].desc}
        </div>

        {/* Full MNA System Formulation: G * x + H * g(x) - s = f(x) */}
        <div style={{
          marginTop: '4px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          gap: '8px',
          flex: 1,
          minHeight: 0
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '10.5px',
            fontWeight: 'bold',
            color: 'var(--theme-sapphire)',
            textTransform: 'uppercase',
            letterSpacing: '0.03em',
            padding: '0 4px'
          }}>
            <span>MNA Nodal Solver Formulation</span>
            <span style={{ fontSize: '9px', textTransform: 'none', color: 'rgba(255,255,255,0.4)', fontWeight: 'normal' }}>
              Hover over cells to see physical stamps and variables
            </span>
          </div>

          {/* Math Equations Panel */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            fontSize: '11px',
            color: 'rgba(255, 255, 255, 0.85)',
            background: 'rgba(15, 23, 42, 0.35)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            borderRadius: '8px',
            padding: '10px 14px'
          }}>
            <span style={{ color: 'var(--theme-emerald)', fontWeight: 'bold', fontSize: '12.5px' }}>System Equation:</span>
            <span style={{
              fontFamily: 'monospace',
              fontSize: '13px',
              color: '#fff',
              fontWeight: 'bold'
            }}>
              {D > 0 ? (
                <>G&middot;x + H&middot;g(x) - s = f(x)</>
              ) : (
                <>G&middot;x - s = f(x)</>
              )}
            </span>
          </div>

          {/* 3. Stacked Equations Matrix Visualizers */}
          {(() => {
            const renderMatrixInEquation = (
              data: number[][],
              label: string,
              color: string,
              cellFormatter: (val: number, r: number, c: number) => string,
              titleTooltip: (val: number, r: number, c: number) => string,
              highlights?: string[]
            ) => {
              const rows = data.length;
              const cols = data[0]?.length || 0;
              return (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                  <div style={{ fontSize: '8.5px', color, fontWeight: 'bold' }}>{label} ({rows}x{cols})</div>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <LeftBracket />
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: `repeat(${cols}, ${cellWidth}px)`,
                      gap: '3px',
                      textAlign: 'center'
                    }}>
                      {data.map((row, rIdx) =>
                        row.map((val, cIdx) => {
                          const key = `${rIdx}-${cIdx}`;
                          const isHighlighted = highlights?.includes(key);
                          const cellText = cellFormatter(val, rIdx, cIdx);
                          const tooltip = titleTooltip(val, rIdx, cIdx);
                          return (
                            <div
                              key={key}
                              title={tooltip}
                              style={{
                                width: `${cellWidth}px`,
                                height: `${cellHeight}px`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: isHighlighted ? 'rgba(245, 158, 11, 0.18)' : 'rgba(255,255,255,0.02)',
                                border: isHighlighted ? '1px solid var(--theme-amber)' : '1px solid rgba(255,255,255,0.05)',
                                borderRadius: '3px',
                                color: isHighlighted ? 'var(--theme-amber)' : (val !== 0 ? '#ffffff' : 'rgba(255,255,255,0.25)'),
                                fontSize: `${cellFontSize}px`,
                                fontWeight: isHighlighted ? 'bold' : 'normal',
                                cursor: 'help',
                                boxSizing: 'border-box'
                              }}
                            >
                              {cellText}
                            </div>
                          );
                        })
                      )}
                    </div>
                    <RightBracket />
                  </div>
                </div>
              );
            };

            const Operator = ({ char }: { char: string }) => (
              <div style={{
                color: 'rgba(255,255,255,0.4)',
                fontSize: '14px',
                fontWeight: 'bold',
                alignSelf: 'center',
                marginTop: '12px',
                padding: '0 4px',
                flexShrink: 0
              }}>
                {char}
              </div>
            );

            const equationRowStyle: React.CSSProperties = {
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontFamily: 'monospace',
              background: 'rgba(0,0,0,0.18)',
              padding: '12px 16px',
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.04)',
              overflowX: 'auto',
              minHeight: 0,
              width: '100%',
              boxSizing: 'border-box'
            };

            // Formatting & Tooltip functions
            const gFormat = (val: number) => val === 0 ? '0' : val.toFixed(3);
            const gTooltip = (val: number, r: number, c: number) => {
              const rowLabel = r < nodeCount ? `KCL Node ${r + 1}` : `Branch ${getDesignator(group2Elements[r - nodeCount])}`;
              const colLabel = variableLabels[c];
              return `G[${r},${c}] = ${val}\nRow: ${rowLabel}\nCol: ${colLabel}`;
            };

            const xFormat = (val: number, r: number) => {
              const isCurrent = r >= nodeCount;
              const unit = isCurrent ? 'A' : 'V';
              return formatEngineering(val) + unit;
            };
            const xTooltip = (val: number, r: number) => {
              const label = variableLabels[r];
              const unit = r >= nodeCount ? 'A' : 'V';
              return `State variable: ${label}\nValue: ${val} ${unit}`;
            };

            const hFormat = (val: number) => val > 0 ? '+1' : val < 0 ? '-1' : '0';
            const hTooltip = (val: number, r: number, c: number) => {
              const rowLabel = r < nodeCount ? `KCL Node ${r + 1}` : `Branch ${getDesignator(group2Elements[r - nodeCount])}`;
              const diodeLabel = diodeLabels[c];
              return `H[${r},${c}] = ${val}\nRow: ${rowLabel}\nDiode: ${diodeLabel}`;
            };

            const gxFormat = (val: number) => formatEngineering(val) + 'A';
            const gxTooltip = (val: number, r: number) => {
              const diodeLabel = diodeLabels[r];
              return `Diode Current: i(${diodeLabel})\nValue: ${val.toExponential(4)} A`;
            };

            const sFormat = (val: number, r: number) => {
              const isKcl = r < nodeCount;
              const unit = isKcl ? 'A' : 'V';
              return formatEngineering(val) + unit;
            };
            const sTooltip = (val: number, r: number) => {
              const isKcl = r < nodeCount;
              const unit = isKcl ? 'A' : 'V';
              const rowLabel = r < nodeCount ? `KCL Node ${r + 1}` : `Branch ${getDesignator(group2Elements[r - nodeCount])}`;
              return `Independent source term\nRow: ${rowLabel}\nValue: ${val} ${unit}`;
            };

            const fxFormat = (val: number, r: number) => {
              const isKcl = r < nodeCount;
              const unit = isKcl ? 'A' : 'V';
              return formatEngineering(val) + unit;
            };
            const fxTooltip = (val: number, r: number) => {
              const isKcl = r < nodeCount;
              const unit = isKcl ? 'A' : 'V';
              const tolerance = isKcl ? tolI : tolV;
              const rowLabel = r < nodeCount ? `KCL Node ${r + 1}` : `Branch ${getDesignator(group2Elements[r - nodeCount])}`;
              return `Residual error (target: 0)\nRow: ${rowLabel}\nValue: ${val.toExponential(4)} ${unit}\nTolerance: ${tolerance} ${unit}`;
            };

            // Setup Equations Data
            const G_data = G;
            const x_data = xVector.map(val => [val]);
            const H_data = H;
            const gx_data = gxVector.map(val => [val]);
            const s_data = sVector.map(val => [val]);
            const fx_data = fxVector.map(val => [val]);

            const baseHighlights = nmaSteps[currentStep]?.highlights || [];

            const gHighlights = baseHighlights.filter(h => !h.startsWith('H-') && !h.startsWith('rhs-') && !h.startsWith('fx-'));
            const hHighlights = baseHighlights
              .filter(h => h.startsWith('H-'))
              .map(h => h.substring(2));
            const sHighlights = baseHighlights
              .filter(h => h.startsWith('rhs-'))
              .map(h => h.substring(4) + '-0');
            const fxHighlights = baseHighlights
              .filter(h => h.startsWith('fx-'))
              .map(h => h.substring(3) + '-0');

            return (
              <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                gap: '14px',
                overflowY: 'auto',
                minHeight: 0,
                paddingRight: '2px'
              }}>
                {/* System Equation Row */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ fontSize: '10.5px', color: 'var(--theme-emerald)', fontWeight: 'bold', paddingLeft: '4px' }}>
                    System Equation (G&middot;x{D > 0 && <> + H&middot;g(x)</>} - s = f(x))
                  </div>
                  <div style={equationRowStyle}>
                    {renderMatrixInEquation(G_data, 'Matrix G', 'var(--theme-sapphire)', gFormat, gTooltip, gHighlights)}
                    <Operator char="&bull;" />
                    {renderMatrixInEquation(x_data, 'State x', 'var(--theme-emerald)', xFormat, xTooltip)}
                    {D > 0 && (
                      <>
                        <Operator char="+" />
                        {renderMatrixInEquation(H_data, 'Matrix H', 'var(--theme-amber)', hFormat, hTooltip, hHighlights)}
                        <Operator char="&bull;" />
                        {renderMatrixInEquation(gx_data, 'Diode g(x)', 'var(--theme-coral)', gxFormat, gxTooltip)}
                      </>
                    )}
                    <Operator char="-" />
                    {renderMatrixInEquation(s_data, 'Source s', 'var(--theme-sapphire)', sFormat, sTooltip, sHighlights)}
                    <Operator char="=" />
                    {renderMatrixInEquation(fx_data, 'Residual f(x)', 'var(--theme-coral)', fxFormat, fxTooltip, fxHighlights)}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Solved Solutions Grid Panel */}
        {currentStep === solveStepIndex && (
          <div style={{
            background: 'rgba(52, 211, 153, 0.04)',
            border: '1px solid rgba(52, 211, 153, 0.12)',
            borderRadius: '8px',
            padding: '8px 12px',
            fontSize: '10px',
            flexShrink: 0
          }}>
            <div style={{ color: 'var(--theme-emerald)', fontWeight: 'bold', marginBottom: '6px', fontSize: '10.5px' }}>
              🏁 Complete MNA Solutions (Voltages & Currents):
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '8px', maxHeight: '72px', overflowY: 'auto' }}>
              {variableLabels.map((label, idx) => {
                const val = solvedX[idx] || 0;
                const isCurrent = label.startsWith('i');
                const formattedVal = isCurrent ? `${(val * 1000).toFixed(3)} mA` : `${val.toFixed(3)} V`;
                return (
                  <div key={idx} style={{ fontFamily: 'monospace', fontSize: '9.5px', color: 'rgba(255,255,255,0.85)' }}>
                    {label} = <span style={{ color: isCurrent ? 'var(--theme-coral)' : '#fff', fontWeight: 'bold' }}>{formattedVal}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
