/**
 * current.ts
 * CurrentSourceElement class implementation.
 */

import type { BaseElement, ElementStamp } from './BaseElement';
import { parseEngineeringValue } from '../../../utils/math';
import { Stamp } from '../../Math/Stamp';

export class CurrentSourceElement implements BaseElement {
  static pattern = /^(I\S*)\s+(\S+)\s+(\S+)\s+(?:DC\s+|AC\s+)?(\S+)/i;

  static isMatched(line: string): CurrentSourceElement | null {
    const match = line.match(CurrentSourceElement.pattern);
    if (!match) return null;
    const [, name, node1, node2, valToken] = match;
    const value = parseEngineeringValue(valToken);
    return new CurrentSourceElement(name, node1, node2, value);
  }

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

  getStampGroup1(nodeMap: Map<string, number>): ElementStamp {
    const getNodeIdx = (node: string): number => {
      if (node === '0' || node.toUpperCase() === 'GND') return 0;
      return nodeMap.get(node) || 0;
    };

    const i1 = getNodeIdx(this.node1);
    const i2 = getNodeIdx(this.node2);

    const g1 = i1 > 0 ? i1 - 1 : -1;
    const g2 = i2 > 0 ? i2 - 1 : -1;

    // CURRENT SOURCE MNA STAMP (Group 1 - stamp RHS only)
    const s_local = [-this.value, this.value];
    const globalIndices = [g1, g2];
    return { s_local, globalIndices };
  }

  getStampGroup2(_nodeMap: Map<string, number>, _group2Idx: number): ElementStamp {
    return { globalIndices: [] };
  }

  createStamp(dimensions: string[]): Stamp {
    const stamp = new Stamp(dimensions);
    if (!this.isGroup2) {
      stamp.S.set(`V${this.node1}`, stamp.S.get(`V${this.node1}`) - this.value);
      stamp.S.set(`V${this.node2}`, stamp.S.get(`V${this.node2}`) + this.value);
    } else {
      stamp.G.set(`V${this.node1}`, `i_${this.name}`, stamp.G.get(`V${this.node1}`, `i_${this.name}`) + 1);
      stamp.G.set(`V${this.node2}`, `i_${this.name}`, stamp.G.get(`V${this.node2}`, `i_${this.name}`) - 1);
      stamp.G.set(`i_${this.name}`, `i_${this.name}`, stamp.G.get(`i_${this.name}`, `i_${this.name}`) + 1);
      stamp.S.set(`i_${this.name}`, stamp.S.get(`i_${this.name}`) + this.value);
    }
    return stamp;
  }
}
