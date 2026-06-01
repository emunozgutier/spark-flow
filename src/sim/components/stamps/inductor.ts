/**
 * inductor.ts
 * InductorElement class implementation.
 */

import type { BaseElement } from './BaseElement';
import type { MnaModel } from '../../../utils/mnaModel';

export class InductorElement implements BaseElement {
  static pattern = /^(L\S*)\s+(\S+)\s+(\S+)\s+(\S+)/i;

  name: string;
  type: 'inductor' = 'inductor';
  node1: string;
  node2: string;
  value: number;
  isGroup2 = true; // Inductors are always Group 2 in DC operating point (ideal short circuit)

  constructor(name: string, node1: string, node2: string, value: number) {
    this.name = name;
    this.node1 = node1;
    this.node2 = node2;
    this.value = value;
  }

  getGroup2Count(): number {
    return 1;
  }

  applyStamp(matrix: MnaModel, nodeMap: Map<string, number>, group2Idx: number): void {
    const getNodeIdx = (node: string): number => {
      if (node === '0' || node.toUpperCase() === 'GND') return 0;
      return nodeMap.get(node) || 0;
    };

    const i1 = getNodeIdx(this.node1);
    const i2 = getNodeIdx(this.node2);

    // INDUCTOR DC OP SHORT-CIRCUIT STAMP (Group 2)
    // Node current equations contribution
    if (i1 > 0) matrix.add(i1 - 1, group2Idx, 1);
    if (i2 > 0) matrix.add(i2 - 1, group2Idx, -1);

    // Branch voltage equation: v(node1) - v(node2) = 0
    if (i1 > 0) matrix.add(group2Idx, i1 - 1, 1);
    if (i2 > 0) matrix.add(group2Idx, i2 - 1, -1);

    // Inductor short circuit coefficient is 0 (R_eq = 0)
    matrix.set(group2Idx, group2Idx, 0);
    matrix.setRhs(group2Idx, 0);
  }
}
