/**
 * current.ts
 * CurrentSourceElement class implementation.
 */

import type { BaseElement, ElementStamp } from './BaseElement';

export class CurrentSourceElement implements BaseElement {
  static pattern = /^(I\S*)\s+(\S+)\s+(\S+)\s+(?:DC\s+|AC\s+)?(\S+)/i;

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

  getStamp(nodeMap: Map<string, number>, _group2Idx: number): ElementStamp {
    const getNodeIdx = (node: string): number => {
      if (node === '0' || node.toUpperCase() === 'GND') return 0;
      return nodeMap.get(node) || 0;
    };

    const i1 = getNodeIdx(this.node1);
    const i2 = getNodeIdx(this.node2);

    const g1 = i1 > 0 ? i1 - 1 : -1;
    const g2 = i2 > 0 ? i2 - 1 : -1;

    // CURRENT SOURCE MNA STAMP (Group 1 - stamp RHS only)
    const A = [
      [0, 0],
      [0, 0]
    ];
    const B = [-this.value, this.value];
    const globalIndices = [g1, g2];
    return { A, B, globalIndices };
  }
}
