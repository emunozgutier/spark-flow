/**
 * voltage.ts
 * VoltageSourceElement class implementation.
 */

import type { BaseElement } from './BaseElement';
import { parseEngineeringValue } from '../../../utils/math';
import { Stamp } from '../../Math/Stamp';
import { StampType } from '../../../dataTypes/Stamps';

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
  type: typeof StampType.Voltage = StampType.Voltage;
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
