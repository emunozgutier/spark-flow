/**
 * Spice.ts
 * Main coordinator class managing simulation state, component list, matrix assembly, and solving.
 */

import type { BaseElement } from './components/stamps/BaseElement';
import { parseSpiceNetlistToElements } from './components/parser';
import { MnaMatrix } from './components/stamps/Matrix';
/**
 * Solves a system of equations A * x = B using Gaussian Elimination with Partial (Row) Pivoting.
 * Performs deep copy to avoid modifying the input matrices.
 */
export const solveLinearSystem = (A: number[][], B: number[]): number[] => {
  const n = B.length;
  // Deep copy A and B
  const a = A.map(row => [...row]);
  const b = [...B];

  for (let i = 0; i < n; i++) {
    // 1. Partial Pivoting: Find row with maximum absolute value in current column
    let maxEl = Math.abs(a[i][i]);
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(a[k][i]) > maxEl) {
        maxEl = Math.abs(a[k][i]);
        maxRow = k;
      }
    }
    
    // Swap rows in A and B
    if (maxRow !== i) {
      const tempRow = a[i];
      a[i] = a[maxRow];
      a[maxRow] = tempRow;

      const tempVal = b[i];
      b[i] = b[maxRow];
      b[maxRow] = tempVal;
    }
    
    // Check if the matrix is singular
    if (Math.abs(a[i][i]) < 1e-12) {
      throw new Error(`MNA system matrix is singular or highly ill-conditioned. Zero pivot found at row/col ${i}.`);
    }
    
    // 2. Eliminate entries below pivot
    for (let k = i + 1; k < n; k++) {
      const factor = a[k][i] / a[i][i];
      a[k][i] = 0; // Explicitly zero out
      for (let j = i + 1; j < n; j++) {
        a[k][j] -= factor * a[i][j];
      }
      b[k] -= factor * b[i];
    }
  }
  
  // 3. Back Substitution
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = b[i];
    for (let j = i + 1; j < n; j++) {
      sum -= a[i][j] * x[j];
    }
    x[i] = sum / a[i][i];
  }
  
  return x;
};

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
  compile(): { A: number[][]; B: number[]; nodeMap: Map<string, number>; group2Elements: BaseElement[] } {
    // Map active nodes (nodes excluding "0") to 1-based indices
    const activeNodes = this.nodes.filter(n => n !== '0' && n.toUpperCase() !== 'GND');
    const nodeMap = new Map<string, number>();
    activeNodes.forEach((nodeName, index) => {
      nodeMap.set(nodeName, index + 1);
    });

    const N = activeNodes.length;

    // Filter elements that introduce Group 2 variables
    const group2Elements: BaseElement[] = [];
    this.elementsList.forEach(el => {
      if (el.getGroup2Count() > 0) {
        group2Elements.push(el);
      }
    });

    const M = group2Elements.length;

    // Instantiate MnaMatrix to manage system matrix size and stamps
    const mnaMatrix = new MnaMatrix(N, M);

    // Apply stamps for each element
    this.elementsList.forEach(el => {
      const g2Idx = el.getGroup2Count() > 0 ? N + group2Elements.indexOf(el) : 0;
      el.applyStamp(mnaMatrix, nodeMap, g2Idx);
    });

    return {
      A: mnaMatrix.getMatrix(),
      B: mnaMatrix.getRhs(),
      nodeMap,
      group2Elements
    };
  }

  /**
   * Simulates the circuit and returns detailed node voltages, branch currents, and equation reports.
   */
  solve(): SpiceSimulationResult {
    const { A, B, nodeMap, group2Elements } = this.compile();
    const N = nodeMap.size;
    const S = A.length;

    let solutionVector: number[] = [];
    try {
      solutionVector = solveLinearSystem(A, B);
    } catch (err: any) {
      solutionVector = new Array(S).fill(0);
      console.error('Modular Solver failed:', err.message);
    }

    // 1. Map solution to Node Voltages
    const nodeVoltages: Record<string, number> = { '0': 0 };
    const activeNodeNames = this.nodes.filter(n => n !== '0' && n.toUpperCase() !== 'GND');
    activeNodeNames.forEach((nodeName, index) => {
      nodeVoltages[nodeName] = solutionVector[index] || 0;
    });

    // 2. Map solution to Group 2 branch currents
    const branchCurrents: Record<string, number> = {};
    group2Elements.forEach((el, index) => {
      branchCurrents[el.name] = solutionVector[N + index] || 0;
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
