/**
 * current.ts
 * CurrentSourceElement class implementation.
 */

import type { BaseElement } from './BaseElement';
import type { MnaMatrix } from './Matrix';

export class CurrentSourceElement implements BaseElement {
  name: string;
  type: 'current' = 'current';
  node1: string; // Positive node (current leaves)
  node2: string; // Negative node (current enters)
  value: number; // Current value in amps
  isGroup2 = false; // Current sources are always Group 1

  constructor(name: string, node1: string, node2: string, value: number) {
    this.name = name;
    this.node1 = node1;
    this.node2 = node2;
    this.value = value;
  }

  getGroup2Count(): number {
    return 0;
  }

  applyStamp(matrix: MnaMatrix, nodeMap: Map<string, number>, _group2Idx: number): void {
    const getNodeIdx = (node: string): number => {
      if (node === '0' || node.toUpperCase() === 'GND') return 0;
      return nodeMap.get(node) || 0;
    };

    const i1 = getNodeIdx(this.node1);
    const i2 = getNodeIdx(this.node2);

    // CURRENT SOURCE MNA STAMP (Group 1 - stamp RHS only)
    if (i1 > 0) matrix.addRhs(i1 - 1, -this.value);
    if (i2 > 0) matrix.addRhs(i2 - 1, this.value);
  }
}
