/**
 * current.ts
 * CurrentSourceElement class implementation.
 */

import type { BaseElement } from './BaseElement';
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
