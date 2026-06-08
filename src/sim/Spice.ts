/**
 * Spice.ts
 * Main coordinator class managing simulation state, component list, matrix assembly, and solving.
 */

import type { BaseElement } from './components/stamps/BaseElement';
import { parseSpiceNetlistToElements } from './components/parser';
import { buildMna, solveNonLinearCircuit } from './components/mnaBuilder';

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
    const { nodeVoltages, branchCurrents } = solveNonLinearCircuit(
      this.elementsList,
      this.nodes
    );

    // Final compile to get matrix A and RHS B at the solved operating point
    const compiled = this.compile(nodeVoltages);
    const A = compiled.A;
    const B = compiled.B;
    const nodeMap = compiled.nodeMap;
    const group2Elements = compiled.group2Elements;

    const N = nodeMap.size;
    const S = A.length;

    // Reconstruct solutionVector
    const solutionVector = new Array(S).fill(0);
    activeNodeNames.forEach((nodeName, idx) => {
      solutionVector[idx] = nodeVoltages[nodeName] || 0;
    });
    group2Elements.forEach((el, idx) => {
      solutionVector[N + idx] = branchCurrents[el.name] || 0;
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
