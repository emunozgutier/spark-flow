/**
 * capacitor.ts
 * CapacitorElement class implementation.
 */

import type { BaseElement } from './BaseElement';
import { parseEngineeringValue } from '../../../utils/math';
import { Stamp } from '../../Math/Stamp';
import { StampType } from '../../../dataTypes/Stamps';

export class CapacitorElement implements BaseElement {
  static pattern = /^(C\S*)\s+(\S+)\s+(\S+)\s+(\S+)/i;

  static isMatched(line: string): CapacitorElement | null {
    const match = line.match(CapacitorElement.pattern);
    if (!match) return null;
    const [, name, node1, node2, valToken] = match;
    const value = parseEngineeringValue(valToken);
    return new CapacitorElement(name, node1, node2, value);
  }

  name: string;
  type: typeof StampType.Capacitor = StampType.Capacitor;
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


  createStamp(dimensions: string[]): Stamp {
    const stamp = new Stamp(dimensions);
    const V1 = `V${this.node1}`;
    const V2 = `V${this.node2}`;
    const In = `i_${this.name}`;

    if (!this.isGroup2) {
      // open circuit, G is 0
    } else {
      stamp.G.set(V1, In, stamp.G.get(V1, In) + 1);
      stamp.G.set(V2, In, stamp.G.get(V2, In) - 1);
      stamp.G.set(In, V1, stamp.G.get(In, V1) + 1);
      stamp.G.set(In, V2, stamp.G.get(In, V2) - 1);
      stamp.G.set(In, In, stamp.G.get(In, In) + 1);
    }
    return stamp;
  }
}
