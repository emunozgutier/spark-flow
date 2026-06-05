import React, { useState } from 'react';
import type { CanvasElement, CardElement, ArrowElement } from '../../../dataTypes/AnotateType';
import { solveLinearSystem } from '../../../sim/components/mnaSolver';

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
    const portsList = isGround ? ['top'] : (isJoin ? ['top', 'right', 'bottom', 'left'] : ['left', 'right']);
    
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
  const voltageSources = cards.filter((c) => c.componentType === 'voltage');
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
    const prefix = card.componentType === 'resistor' ? 'R' : card.componentType === 'capacitor' ? 'C' : card.componentType === 'inductor' ? 'L' : card.componentType === 'voltage' ? 'V' : card.componentType === 'current' ? 'I' : card.componentType === 'diode' ? 'D' : 'GND';
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
  const hasDiodes = cards.some((c) => c.componentType === 'diode');

  let voltagesGuess: Record<string, number> = { '0': 0 };
  for (let i = 1; i <= nodeCount; i++) voltagesGuess[String(i)] = 0.0;
  
  const maxIterations = hasDiodes ? 50 : 1;
  const tolerance = 1e-5;
  
  for (let iter = 0; iter < maxIterations; iter++) {
    const A_iter = Array.from({ length: mnaSize }, () => new Array(mnaSize).fill(0));
    const B_iter = new Array(mnaSize).fill(0);

    // Stamp Resistors, Inductors
    cards.forEach((card) => {
      if (card.componentType === 'resistor' || card.componentType === 'inductor') {
        const n1Str = getPinNode(card.id, 'left');
        const n2Str = getPinNode(card.id, 'right');
        const n1 = parseInt(n1Str, 10);
        const n2 = parseInt(n2Str, 10);
        let rVal = card.componentType === 'inductor' ? 1e-3 : (card.value !== undefined ? (card.value <= 0 ? 1e-3 : card.value) : 1000);

        if (card.componentType === 'resistor' && card.isGroup2) {
          const idx = g2ElementMap[card.id];
          if (n1 > 0) A_iter[n1 - 1][idx] += 1;
          if (n2 > 0) A_iter[n2 - 1][idx] -= 1;
          if (n1 > 0) A_iter[idx][n1 - 1] += 1;
          if (n2 > 0) A_iter[idx][n2 - 1] -= 1;
          A_iter[idx][idx] -= rVal;
        } else {
          const g = 1 / rVal;
          if (n1 > 0) A_iter[n1 - 1][n1 - 1] += g;
          if (n2 > 0) A_iter[n2 - 1][n2 - 1] += g;
          if (n1 > 0 && n2 > 0) {
            A_iter[n1 - 1][n2 - 1] -= g;
            A_iter[n2 - 1][n1 - 1] -= g;
          }
        }
      }
    });

    // Stamp Diodes
    cards.forEach((card) => {
      if (card.componentType === 'diode') {
        const n1Str = getPinNode(card.id, 'left');
        const n2Str = getPinNode(card.id, 'right');
        const n1 = parseInt(n1Str, 10);
        const n2 = parseInt(n2Str, 10);
        const vd = Math.max(-1.0, Math.min(0.8, (voltagesGuess[n1Str] || 0) - (voltagesGuess[n2Str] || 0)));
        const Is = 1e-14;
        const Vt = 0.026;
        const expTerm = Math.exp(vd / Vt);
        const gd = (Is / Vt) * expTerm;
        const id = Is * (expTerm - 1);
        const Ieq = id - gd * vd;

        if (n1 > 0) A_iter[n1 - 1][n1 - 1] += gd;
        if (n2 > 0) A_iter[n2 - 1][n2 - 1] += gd;
        if (n1 > 0 && n2 > 0) {
          A_iter[n1 - 1][n2 - 1] -= gd;
          A_iter[n2 - 1][n1 - 1] -= gd;
        }
        if (n1 > 0) B_iter[n1 - 1] -= Ieq;
        if (n2 > 0) B_iter[n2 - 1] += Ieq;
      }
    });

    // Stamp Voltage Sources
    voltageSources.forEach((vSrc) => {
      const n1Str = getPinNode(vSrc.id, 'left');
      const n2Str = getPinNode(vSrc.id, 'right');
      const n1 = parseInt(n1Str, 10);
      const n2 = parseInt(n2Str, 10);
      const val = vSrc.value !== undefined ? vSrc.value : 5;
      const idx = g2ElementMap[vSrc.id];
      if (n1 > 0) A_iter[n1 - 1][idx] += 1;
      if (n2 > 0) A_iter[n2 - 1][idx] -= 1;
      if (n1 > 0) A_iter[idx][n1 - 1] += 1;
      if (n2 > 0) A_iter[idx][n2 - 1] -= 1;
      B_iter[idx] = val;
    });

    // Stamp Inductors (DC op short circuit)
    inductors.forEach((card) => {
      const n1Str = getPinNode(card.id, 'left');
      const n2Str = getPinNode(card.id, 'right');
      const n1 = parseInt(n1Str, 10);
      const n2 = parseInt(n2Str, 10);
      const idx = g2ElementMap[card.id];
      if (n1 > 0) A_iter[n1 - 1][idx] += 1;
      if (n2 > 0) A_iter[n2 - 1][idx] -= 1;
      if (n1 > 0) A_iter[idx][n1 - 1] += 1;
      if (n2 > 0) A_iter[idx][n2 - 1] -= 1;
    });

    // Stamp Current Sources
    cards.forEach((card) => {
      if (card.componentType === 'current') {
        const n1Str = getPinNode(card.id, 'left');
        const n2Str = getPinNode(card.id, 'right');
        const n1 = parseInt(n1Str, 10);
        const n2 = parseInt(n2Str, 10);
        const val = card.value !== undefined ? card.value : 0.001;
        if (n1 > 0) B_iter[n1 - 1] -= val;
        if (n2 > 0) B_iter[n2 - 1] += val;
      }
    });

    let nextX = new Array(mnaSize).fill(0);
    try {
      nextX = solveLinearSystem(A_iter, B_iter);
    } catch (e) {
      break;
    }

    let maxDiff = 0;
    const nextVoltages: Record<string, number> = { '0': 0 };
    for (let i = 1; i <= nodeCount; i++) {
      const vOld = voltagesGuess[String(i)] || 0;
      const vNew = nextX[i - 1] || 0;
      nextVoltages[String(i)] = vNew;
      maxDiff = Math.max(maxDiff, Math.abs(vNew - vOld));
    }
    voltagesGuess = nextVoltages;
    solvedX = nextX;
    if (!hasDiodes || maxDiff < tolerance) break;
  }
  solvedVoltages = voltagesGuess;

  // Helper to add a card's stamp into a matrix and RHS and return modified cell IDs
  const addStampToSystem = (card: CardElement, A_sys: number[][], B_sys: number[], voltages_estimate: Record<string, number>) => {
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
    } else if (card.componentType === 'diode') {
      const vd = Math.max(-1.0, Math.min(0.8, (voltages_estimate[n1Str] || 0) - (voltages_estimate[n2Str] || 0)));
      const Is = 1e-14;
      const Vt = 0.026;
      const expTerm = Math.exp(vd / Vt);
      const gd = (Is / Vt) * expTerm;
      const id = Is * (expTerm - 1);
      const Ieq = id - gd * vd;

      if (n1 > 0) { A_sys[n1 - 1][n1 - 1] += gd; modifiedCells.push(`${n1 - 1}-${n1 - 1}`); }
      if (n2 > 0) { A_sys[n2 - 1][n2 - 1] += gd; modifiedCells.push(`${n2 - 1}-${n2 - 1}`); }
      if (n1 > 0 && n2 > 0) {
        A_sys[n1 - 1][n2 - 1] -= gd; modifiedCells.push(`${n1 - 1}-${n2 - 1}`);
        A_sys[n2 - 1][n1 - 1] -= gd; modifiedCells.push(`${n2 - 1}-${n1 - 1}`);
      }
      if (n1 > 0) { B_sys[n1 - 1] -= Ieq; modifiedCells.push(`rhs-${n1 - 1}`); }
      if (n2 > 0) { B_sys[n2 - 1] += Ieq; modifiedCells.push(`rhs-${n2 - 1}`); }
    } else if (card.componentType === 'voltage') {
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
  }

  const nmaSteps: WalkthroughStep[] = [];

  // Step 1: Equation Dimensions
  nmaSteps.push({
    title: 'Step 1: Set Equation Dimensions',
    desc: `We construct a ${mnaSize}x${mnaSize} Modified Nodal Analysis (MNA) matrix system to solve for the unknown node voltages and branch currents of the actual circuit. The variables vector is [${variableLabels.join(', ')}]. All cells start at 0.`,
    matrix: Array.from({ length: mnaSize }, () => new Array(mnaSize).fill(0)),
    rhs: new Array(mnaSize).fill(0),
    highlights: []
  });

  // Step 2: Accumulate Element Stamps
  const A_temp = Array.from({ length: mnaSize }, () => new Array(mnaSize).fill(0));
  const B_temp = new Array(mnaSize).fill(0);
  const elementsToStamp = cards.filter((c) => c.componentType !== undefined && c.componentType !== 'ground');
  
  const substeps: Array<{ title: string; stepIndex: number }> = [];

  elementsToStamp.forEach((card) => {
    const highlights = addStampToSystem(card, A_temp, B_temp, solvedVoltages);
    const designator = getDesignator(card);
    const n1Str = getPinNode(card.id, 'left');
    const n2Str = getPinNode(card.id, 'right');

    let desc = `This is the stamp for element ${designator}. `;
    if (card.componentType === 'resistor') {
      const val = card.value !== undefined ? card.value : 1000;
      desc += `Resistor connects Node ${n1Str} and Node ${n2Str}. We stamp a conductance of 1/R = ${(1 / (val || 1e-3)).toFixed(4)} S.`;
    } else if (card.componentType === 'diode') {
      desc += `Diode connects Node ${n1Str} and Node ${n2Str}. Formulated using Newton-Raphson companion model stamps.`;
    } else if (card.componentType === 'voltage') {
      const val = card.value !== undefined ? card.value : 5;
      desc += `Voltage source connects Node ${n1Str} (+) and Node ${n2Str} (-), enforcing a fixed potential difference of ${val}V.`;
    } else if (card.componentType === 'current') {
      const val = card.value !== undefined ? card.value : 0.001;
      desc += `Current source connects Node ${n1Str} (positive) and Node ${n2Str} (negative), injecting a current of ${val} A.`;
    } else if (card.componentType === 'inductor') {
      desc += `Inductor connects Node ${n1Str} and Node ${n2Str}, stamped as a short circuit in DC analysis.`;
    } else if (card.componentType === 'capacitor') {
      desc += `Capacitor connects Node ${n1Str} and Node ${n2Str}, stamped as an open circuit in DC analysis.`;
    }

    nmaSteps.push({
      title: `Step 2: Add ${designator} Stamp`,
      desc,
      matrix: A_temp.map(row => [...row]),
      rhs: [...B_temp],
      highlights
    });

    substeps.push({
      title: `Stamp: ${designator}`,
      stepIndex: nmaSteps.length - 1
    });
  });

  // Step 3: Solve System
  nmaSteps.push({
    title: 'Step 3: Solve System',
    desc: `Solving the complete matrix equation yields the exact electrical values for all of our unknown variables: voltages and branch currents. The solved values are populated in the variables vector below.`,
    matrix: A_temp.map(row => [...row]),
    rhs: [...B_temp],
    highlights: []
  });
  const solveStepIndex = nmaSteps.length - 1;

  // Step 4: Non-linear MNA
  let nonLinearStepIndex = -1;
  if (hasDiodes) {
    nmaSteps.push({
      title: 'Step 4: Non-linear Newton-Raphson',
      desc: `Since the circuit contains non-linear elements (Diodes), the system is solved iteratively using Newton-Raphson. At each iteration, the diode is linearized into a companion conductance gd and equivalent current source Ieq based on the guessed voltages.`,
      matrix: A_temp.map(row => [...row]),
      rhs: [...B_temp],
      highlights: []
    });
    nonLinearStepIndex = nmaSteps.length - 1;
  }

  // Side menu structure mapping
  const menuSections = [
    {
      id: 'step1',
      title: 'Step 1: Equation Dimensions',
      stepIndex: 0
    }
  ];

  if (substeps.length > 0) {
    menuSections.push({
      id: 'step2',
      title: 'Step 2: Add Element Stamps',
      substeps
    } as any);
  }

  menuSections.push({
    id: 'step3',
    title: 'Step 3: Solve System',
    stepIndex: solveStepIndex
  });

  if (hasDiodes && nonLinearStepIndex !== -1) {
    menuSections.push({
      id: 'step4',
      title: 'Step 4: Non-linear MNA',
      stepIndex: nonLinearStepIndex
    });
  }

  const [nmaStep, setNmaStep] = useState<number>(0);
  const currentStep = Math.min(nmaStep, nmaSteps.length - 1);

  const displayVariableLabels = currentStep === solveStepIndex || (nonLinearStepIndex !== -1 && currentStep === nonLinearStepIndex)
    ? variableLabels.map((label, idx) => {
        const val = solvedX[idx] || 0;
        const isCurrent = label.startsWith('i');
        return isCurrent ? `${(val * 1000).toFixed(2)} mA` : `${val.toFixed(2)} V`;
      })
    : variableLabels;

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
            const isParentActive = currentStep >= 1 && currentStep < solveStepIndex;
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

        {/* Grid bracket math equations viewer */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          margin: '4px 0',
          fontFamily: 'monospace',
          fontSize: '11px',
          background: 'rgba(0,0,0,0.12)',
          padding: '10px 8px',
          borderRadius: '8px',
          border: '1px solid rgba(255,255,255,0.03)',
          flex: 1,
          overflow: 'auto'
        }}>
          {/* Matrix A with Brackets */}
          <div style={{
            display: 'flex',
            borderLeft: '1.5px solid rgba(255,255,255,0.35)',
            borderRight: '1.5px solid rgba(255,255,255,0.35)',
            borderRadius: '4px',
            padding: '2px 4px',
            background: 'rgba(255, 255, 255, 0.01)'
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${nmaSteps[currentStep].matrix[0].length}, 42px)`, gap: '3px', textAlign: 'center' }}>
              {nmaSteps[currentStep].matrix.map((row, rIdx) =>
                row.map((val, cIdx) => {
                  const isHighlighted = nmaSteps[currentStep].highlights.includes(`${rIdx}-${cIdx}`);
                  return (
                    <div
                      key={`${rIdx}-${cIdx}`}
                      style={{
                        padding: '4px 2px',
                        background: isHighlighted ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255,255,255,0.02)',
                        border: isHighlighted ? '1px solid var(--theme-amber)' : '1px solid rgba(255,255,255,0.04)',
                        borderRadius: '4px',
                        color: isHighlighted ? 'var(--theme-amber)' : '#ffffff',
                        fontWeight: isHighlighted ? 'bold' : 'normal',
                        fontSize: '9.5px'
                      }}
                    >
                      {val.toFixed(2)}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div style={{ color: 'rgba(255,255,255,0.4)', padding: '0 1px', fontSize: '11px' }}>&bull;</div>

          {/* Variables Vector X with Brackets */}
          <div style={{
            display: 'flex',
            borderLeft: '1.5px solid rgba(255,255,255,0.35)',
            borderRight: '1.5px solid rgba(255,255,255,0.35)',
            borderRadius: '4px',
            padding: '2px 4px',
            background: 'rgba(255, 255, 255, 0.01)'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', justifyContent: 'center' }}>
              {displayVariableLabels.map((vLabel, idx) => (
                <div
                  key={idx}
                  style={{
                    width: currentStep === solveStepIndex ? '56px' : '40px',
                    padding: '4px 0',
                    background: currentStep === solveStepIndex ? 'rgba(52, 211, 153, 0.1)' : 'rgba(255,255,255,0.03)',
                    border: currentStep === solveStepIndex ? '1px solid var(--theme-emerald)' : '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '4px',
                    color: currentStep === solveStepIndex ? 'var(--theme-emerald)' : 'var(--theme-sapphire)',
                    textAlign: 'center',
                    fontWeight: 'bold',
                    fontSize: currentStep === solveStepIndex ? '8.5px' : '9.5px'
                  }}
                >
                  {vLabel}
                </div>
              ))}
            </div>
          </div>

          <div style={{ color: 'rgba(255,255,255,0.4)', padding: '0 1px', fontSize: '11px' }}>=</div>

          {/* RHS Vector B with Brackets */}
          <div style={{
            display: 'flex',
            borderLeft: '1.5px solid rgba(255,255,255,0.35)',
            borderRight: '1.5px solid rgba(255,255,255,0.35)',
            borderRadius: '4px',
            padding: '2px 4px',
            background: 'rgba(255, 255, 255, 0.01)'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', justifyContent: 'center' }}>
              {nmaSteps[currentStep].rhs.map((rhsVal, rIdx) => {
                const isHighlighted = nmaSteps[currentStep].highlights.includes(`rhs-${rIdx}`);
                return (
                  <div
                    key={rIdx}
                    style={{
                      width: '42px',
                      padding: '4px 0',
                      background: isHighlighted ? 'rgba(244, 63, 94, 0.15)' : 'rgba(255,255,255,0.02)',
                      border: isHighlighted ? '1px solid var(--theme-coral)' : '1px solid rgba(255,255,255,0.04)',
                      borderRadius: '4px',
                      color: isHighlighted ? 'var(--theme-coral)' : '#ffffff',
                      textAlign: 'center',
                      fontWeight: isHighlighted ? 'bold' : 'normal',
                      fontSize: '9.5px'
                    }}
                  >
                    {rhsVal.toFixed(2)}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Solved Solutions Grid Panel */}
        {(currentStep === solveStepIndex || (nonLinearStepIndex !== -1 && currentStep === nonLinearStepIndex)) && (
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
