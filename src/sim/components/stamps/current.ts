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
    const V1 = `V${this.node1}`;
    const V2 = `V${this.node2}`;
    const In = `i_${this.name}`;

    if (!this.isGroup2) {
      stamp.S.set(V1, stamp.S.get(V1) - this.value);
      stamp.S.set(V2, stamp.S.get(V2) + this.value);
    } else {
      stamp.G.set(V1, In, stamp.G.get(V1, In) + 1);
      stamp.G.set(V2, In, stamp.G.get(V2, In) - 1);
      stamp.G.set(In, In, stamp.G.get(In, In) + 1);
      stamp.S.set(In, stamp.S.get(In) + this.value);
    }
    return stamp;
  }
}
