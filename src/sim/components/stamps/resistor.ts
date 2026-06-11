/**
 * resistor.ts
 * ResistorElement class implementation.
 */

import type { BaseElement, ElementStamp } from './BaseElement';

export class ResistorElement implements BaseElement {
  static pattern = /^(R\S*)\s+(\S+)\s+(\S+)\s+(\S+)(?:\s+(G2|\[G2\]))?/i;

  name: string;
  type: 'resistor' = 'resistor';
  node1: string;
  node2: string;
  value: number;
  isGroup2: boolean;

  constructor(name: string, node1: string, node2: string, value: number, isGroup2 = true) {
    this.name = name;
    this.node1 = node1;
    this.node2 = node2;
    this.value = value;
    this.isGroup2 = isGroup2;
  }

  getGroup2Count(): number {
    return this.isGroup2 ? 1 : 0;
  }

  getStampGroup1(nodeMap: Map<string, number>): ElementStamp {
    const getNodeIdx = (node: string): number => {
      if (node === '0' || node.toUpperCase() === 'GND') return 0;
      return nodeMap.get(node) || 0;
    };

    const i1 = getNodeIdx(this.node1);
    const i2 = getNodeIdx(this.node2);

    const g1 = i1 > 0 ? i1 - 1 : -1;
    const g2 = i2 > 0 ? i2 - 1 : -1;

    const g = 1 / this.value;
    const G_local = [
      [g, -g],
      [-g, g]
    ];
    const globalIndices = [g1, g2];
    return { G_local, globalIndices };
  }

  getStampGroup2(nodeMap: Map<string, number>, group2Idx: number): ElementStamp {
    const getNodeIdx = (node: string): number => {
      if (node === '0' || node.toUpperCase() === 'GND') return 0;
      return nodeMap.get(node) || 0;
    };

    const i1 = getNodeIdx(this.node1);
    const i2 = getNodeIdx(this.node2);

    const g1 = i1 > 0 ? i1 - 1 : -1;
    const g2 = i2 > 0 ? i2 - 1 : -1;

    const G_local = [
      [0, 0, 1],
      [0, 0, -1],
      [1, -1, -this.value]
    ];
    const globalIndices = [g1, g2, group2Idx];
    return { G_local, globalIndices };
  }
}
