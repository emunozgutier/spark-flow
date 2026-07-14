/**
 * voltage.ts
 * VoltageSourceElement class implementation.
 */

import type { BaseElement, ElementStamp } from './BaseElement';
import { parseEngineeringValue } from '../../../utils/math';
import { Stamp } from '../../Math/Stamp';

export class VoltageSourceElement implements BaseElement {
  static pattern = /^(V\S*)\s+(\S+)\s+(\S+)\s+(?:DC\s+|AC\s+)?(\S+)/i;

  static isMatched(line: string): VoltageSourceElement | null {
    const match = line.match(VoltageSourceElement.pattern);
    if (!match) return null;
    const [, name, node1, node2, valToken] = match;
    const value = parseEngineeringValue(valToken);
    return new VoltageSourceElement(name, node1, node2, value);
  }

  name: string;
  type: 'voltage' = 'voltage';
  node1: string; // Positive terminal
  node2: string; // Negative terminal
  value: number; // Voltage value in volts
  isGroup2 = true; // Voltage sources are always Group 2

  constructor(name: string, node1: string, node2: string, value: number) {
    this.name = name;
    this.node1 = node1;
    this.node2 = node2;
    this.value = value;
  }

  getGroup2Count(): number {
    return 1;
  }

  getStampGroup1(_nodeMap: Map<string, number>): ElementStamp {
    return { globalIndices: [] };
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

    // VOLTAGE SOURCE MNA STAMP (Group 2)
    const G_local = [
      [0, 0, 1],
      [0, 0, -1],
      [1, -1, 0]
    ];
    const s_local = [0, 0, this.value];
    const globalIndices = [g1, g2, group2Idx];
    return { G_local, s_local, globalIndices };
  }

  createStamp(dimensions: string[]): Stamp {
    const stamp = new Stamp(dimensions);
    stamp.G.set(`V${this.node1}`, `i_${this.name}`, stamp.G.get(`V${this.node1}`, `i_${this.name}`) + 1);
    stamp.G.set(`V${this.node2}`, `i_${this.name}`, stamp.G.get(`V${this.node2}`, `i_${this.name}`) - 1);
    stamp.G.set(`i_${this.name}`, `V${this.node1}`, stamp.G.get(`i_${this.name}`, `V${this.node1}`) + 1);
    stamp.G.set(`i_${this.name}`, `V${this.node2}`, stamp.G.get(`i_${this.name}`, `V${this.node2}`) - 1);
    stamp.S.set(`i_${this.name}`, stamp.S.get(`i_${this.name}`) + this.value);
    return stamp;
  }
}
