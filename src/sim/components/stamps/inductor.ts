/**
 * inductor.ts
 * InductorElement class implementation.
 */

import type { BaseElement } from './BaseElement';
import { parseEngineeringValue } from '../../../utils/math';
import { Stamp } from '../../Math/Stamp';

export class InductorElement implements BaseElement {
  static pattern = /^(L\S*)\s+(\S+)\s+(\S+)\s+(\S+)/i;

  static isMatched(line: string): InductorElement | null {
    const match = line.match(InductorElement.pattern);
    if (!match) return null;
    const [, name, node1, node2, valToken] = match;
    const value = parseEngineeringValue(valToken);
    return new InductorElement(name, node1, node2, value);
  }

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


  createStamp(dimensions: string[]): Stamp {
    const stamp = new Stamp(dimensions);
    stamp.G.set(`V${this.node1}`, `i_${this.name}`, stamp.G.get(`V${this.node1}`, `i_${this.name}`) + 1);
    stamp.G.set(`V${this.node2}`, `i_${this.name}`, stamp.G.get(`V${this.node2}`, `i_${this.name}`) - 1);
    stamp.G.set(`i_${this.name}`, `V${this.node1}`, stamp.G.get(`i_${this.name}`, `V${this.node1}`) + 1);
    stamp.G.set(`i_${this.name}`, `V${this.node2}`, stamp.G.get(`i_${this.name}`, `V${this.node2}`) - 1);
    return stamp;
  }
}
