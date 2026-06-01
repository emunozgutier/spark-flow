/**
 * inductor.ts
 * InductorElement class implementation.
 */

import type { BaseElement, ElementStamp } from './BaseElement';

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

  getStamp(nodeMap: Map<string, number>, group2Idx: number): ElementStamp {
    const getNodeIdx = (node: string): number => {
      if (node === '0' || node.toUpperCase() === 'GND') return 0;
      return nodeMap.get(node) || 0;
    };

    const i1 = getNodeIdx(this.node1);
    const i2 = getNodeIdx(this.node2);

    const g1 = i1 > 0 ? i1 - 1 : -1;
    const g2 = i2 > 0 ? i2 - 1 : -1;

    // INDUCTOR DC OP SHORT-CIRCUIT STAMP (Group 2)
    const A = [
      [0, 0, 1],
      [0, 0, -1],
      [1, -1, 0]
    ];
    const B = [0, 0, 0];
    const globalIndices = [g1, g2, group2Idx];
    return { A, B, globalIndices };
  }
}
