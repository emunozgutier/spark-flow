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
    const V1 = `V${this.node1}`;
    const V2 = `V${this.node2}`;
    const In = `i_${this.name}`;

    stamp.G.set(V1, In, stamp.G.get(V1, In) + 1);
    stamp.G.set(V2, In, stamp.G.get(V2, In) - 1);
    stamp.G.set(In, V1, stamp.G.get(In, V1) + 1);
    stamp.G.set(In, V2, stamp.G.get(In, V2) - 1);
    return stamp;
  }
}
