/**
 * Spice.ts
 * Main coordinator class managing simulation state, component list, matrix assembly, and solving.
 */

import type { BaseElement } from './components/stamps/BaseElement';
import { parseSpiceNetlistToElements } from './components/parser';
import { buildMna } from './components/mnaBuilder';
import { solveLinearSystem } from './components/mnaSolver';

export interface SpiceSimulationResult {
  nodeVoltages: Record<string, number>;
  branchCurrents: Record<string, number>;
  A: number[][];
  B: number[];
  solutionVector: number[];
  matrixReport: string;
}

export class Spice {
  elementsList: BaseElement[] = [];
  nodes: string[] = [];

  constructor(spiceDeck?: string) {
    if (spiceDeck) {
      const { elementsList, nodes } = parseSpiceNetlistToElements(spiceDeck);
      this.elementsList = elementsList;
      this.nodes = nodes;
    }
  }

  /**
   * Adds a component element manually to elementsList.
   */
  addElement(element: BaseElement): void {
    this.elementsList.push(element);
    
    // Maintain unique nodes tracking
    const uniqueNodes = new Set(this.nodes);
    uniqueNodes.add(element.node1);
    uniqueNodes.add(element.node2);
    
    const nodesList = Array.from(uniqueNodes).filter(n => n !== '0' && n.toUpperCase() !== 'GND');
    this.nodes = ['0', ...nodesList];
  }

  /**
   * Compiles the MNA matrix A and RHS vector B using elementsList' stamps.
   */
  compile(voltages?: Record<string, number>): { A: number[][]; B: number[]; nodeMap: Map<string, number>; group2Elements: BaseElement[] } {
    const { mnaModel, nodeMap, group2Elements } = buildMna(this.elementsList, this.nodes, voltages);
    return {
      A: mnaModel.getMatrix(),
      B: mnaModel.getRhs(),
      nodeMap,
      group2Elements
    };
  }

  /**
   * Simulates the circuit and returns detailed node voltages, branch currents, and equation reports.
   */
  solve(): SpiceSimulationResult {
    const activeNodeNames = this.nodes.filter(n => n !== '0' && n.toUpperCase() !== 'GND');
    const hasDiodes = this.elementsList.some(el => el.type === 'diode');

    // Initial guess
    let nodeVoltages: Record<string, number> = { '0': 0 };
    activeNodeNames.forEach(n => {
      nodeVoltages[n] = 0.0;
    });

    let solutionVector: number[] = [];
    let A: number[][] = [];
    let B: number[] = [];
    let nodeMap = new Map<string, number>();
    let group2Elements: BaseElement[] = [];

    const maxIterations = hasDiodes ? 50 : 1;
    const tolerance = 1e-5;

    for (let iter = 0; iter < maxIterations; iter++) {
      const compiled = this.compile(nodeVoltages);
      A = compiled.A;
      B = compiled.B;
      nodeMap = compiled.nodeMap;
      group2Elements = compiled.group2Elements;

      const S = A.length;
      if (S === 0) {
        solutionVector = [];
        break;
      }

      try {
        solutionVector = solveLinearSystem(A, B);
      } catch (err: any) {
        solutionVector = new Array(S).fill(0);
        console.error('Spice Newton-Raphson linear solver failed at iteration', iter, ':', err.message);
        break;
      }

      // Check convergence
      let maxDiff = 0;
      const nextNodeVoltages: Record<string, number> = { '0': 0 };
      activeNodeNames.forEach((nodeName, index) => {
        const vOld = nodeVoltages[nodeName] || 0;
        const vNew = solutionVector[index] || 0;
        nextNodeVoltages[nodeName] = vNew;
        const diff = Math.abs(vNew - vOld);
        if (diff > maxDiff) {
          maxDiff = diff;
        }
      });

      nodeVoltages = nextNodeVoltages;

      if (!hasDiodes || maxDiff < tolerance) {
        break;
      }
    }

    const N = nodeMap.size;
    const S = A.length;

    // 2. Map solution to Group 2 branch currents
    const branchCurrents: Record<string, number> = {};
    group2Elements.forEach((el, index) => {
      branchCurrents[el.name] = solutionVector[N + index] || 0;
    });

    // Add Diode currents (Group 1 elements)
    this.elementsList.forEach((el) => {
      if (el.type === 'diode') {
        const v1 = nodeVoltages[el.node1] || 0;
        const v2 = nodeVoltages[el.node2] || 0;
        const vd = v1 - v2;
        const vdClamped = Math.max(-1.0, Math.min(0.8, vd));
        const Is = 1e-14;
        const Vt = 0.026;
        branchCurrents[el.name] = Is * (Math.exp(vdClamped / Vt) - 1);
      }
    });

    // 3. Generate matrix equation report
    const headers = [
      ...activeNodeNames.map(name => `v(${name})`),
      ...group2Elements.map(el => `i(${el.name})`)
    ];

    let report = '=== MODULAR SPICE MNA SYSTEM stamp compilation ===\n\n';
    report += 'Matrix Dimension: ' + S + ' x ' + S + '\n';
    report += 'Variables x: [' + headers.join(', ') + ']\n\n';
    report += 'Matrix A | RHS Vector B:\n';
    report += '--------------------------------------------------\n';
    for (let r = 0; r < S; r++) {
      const formattedRow = A[r].map(val => val.toFixed(4).padStart(9)).join(' ');
      const formattedRHS = B[r].toFixed(4).padStart(9);
      const varLabel = r < N ? `Node ${activeNodeNames[r]}` : `Branch ${group2Elements[r - N].name}`;
      report += `[${formattedRow} ] [${formattedRHS}]  <-- Equation: ${varLabel}\n`;
    }
    report += '--------------------------------------------------\n\n';
    report += 'Solution vector x:\n';
    headers.forEach((h, index) => {
      const val = solutionVector[index] || 0;
      report += `  ${h.padEnd(10)} = ${val.toFixed(6).padStart(12)} \n`;
    });

    return {
      nodeVoltages,
      branchCurrents,
      A,
      B,
      solutionVector,
      matrixReport: report
    };
  }
}
