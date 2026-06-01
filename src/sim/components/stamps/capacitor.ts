/**
 * capacitor.ts
 * CapacitorElement class implementation.
 */

import type { BaseElement, ElementStamp } from './BaseElement';

export class CapacitorElement implements BaseElement {
  static pattern = /^(C\S*)\s+(\S+)\s+(\S+)\s+(\S+)/i;

  name: string;
  type: 'capacitor' = 'capacitor';
  node1: string;
  node2: string;
  value: number;
  isGroup2 = false; // Capacitors behave as Group 1 elements with zero admittance in DC (ideal open circuit)

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

    // CAPACITOR DC OP OPEN-CIRCUIT STAMP
    const A = [
      [0, 0],
      [0, 0]
    ];
    const B = [0, 0];
    const globalIndices = [g1, g2];
    return { A, B, globalIndices };
  }
}
