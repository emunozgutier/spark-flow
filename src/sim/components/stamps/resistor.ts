/**
 * resistor.ts
 * ResistorElement class implementation.
 */

import type { BaseElement } from './BaseElement';
import type { MnaMatrix } from './Matrix';

export class ResistorElement implements BaseElement {
  name: string;
  type: 'resistor' = 'resistor';
  node1: string;
  node2: string;
  value: number;
  isGroup2: boolean;

  constructor(name: string, node1: string, node2: string, value: number, isGroup2 = false) {
    this.name = name;
    this.node1 = node1;
    this.node2 = node2;
    this.value = value;
    this.isGroup2 = isGroup2;
  }

  getGroup2Count(): number {
    return this.isGroup2 ? 1 : 0;
  }

  applyStamp(matrix: MnaMatrix, nodeMap: Map<string, number>, group2Idx: number): void {
    const getNodeIdx = (node: string): number => {
      if (node === '0' || node.toUpperCase() === 'GND') return 0;
      return nodeMap.get(node) || 0;
    };

    const i1 = getNodeIdx(this.node1);
    const i2 = getNodeIdx(this.node2);

    if (this.isGroup2) {
      // GROUP 2 RESISTOR STAMP
      // Current i_R variable at column group2Idx, and branch equation at row group2Idx
      // Node current equations contribution
      if (i1 > 0) matrix.add(i1 - 1, group2Idx, 1);
      if (i2 > 0) matrix.add(i2 - 1, group2Idx, -1);

      // Branch voltage equation: v(node1) - v(node2) - R * i_R = 0
      if (i1 > 0) matrix.add(group2Idx, i1 - 1, 1);
      if (i2 > 0) matrix.add(group2Idx, i2 - 1, -1);
      matrix.add(group2Idx, group2Idx, -this.value);
    } else {
      // GROUP 1 RESISTOR STAMP
      const g = 1 / this.value;
      if (i1 > 0) matrix.add(i1 - 1, i1 - 1, g);
      if (i2 > 0) matrix.add(i2 - 1, i2 - 1, g);
      if (i1 > 0 && i2 > 0) {
        matrix.add(i1 - 1, i2 - 1, -g);
        matrix.add(i2 - 1, i1 - 1, -g);
      }
    }
  }
}
