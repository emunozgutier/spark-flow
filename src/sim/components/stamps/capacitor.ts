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
    if (!this.isGroup2) {
      // open circuit, G is 0
    } else {
      stamp.G.set(`V${this.node1}`, `i_${this.name}`, stamp.G.get(`V${this.node1}`, `i_${this.name}`) + 1);
      stamp.G.set(`V${this.node2}`, `i_${this.name}`, stamp.G.get(`V${this.node2}`, `i_${this.name}`) - 1);
      stamp.G.set(`i_${this.name}`, `V${this.node1}`, stamp.G.get(`i_${this.name}`, `V${this.node1}`) + 1);
      stamp.G.set(`i_${this.name}`, `V${this.node2}`, stamp.G.get(`i_${this.name}`, `V${this.node2}`) - 1);
      stamp.G.set(`i_${this.name}`, `i_${this.name}`, stamp.G.get(`i_${this.name}`, `i_${this.name}`) + 1);
    }
    return stamp;
  }
}
