/**
 * resistor.ts
 * ResistorElement class implementation.
 */

import type { BaseElement } from './BaseElement';
import { parseEngineeringValue } from '../../../utils/math';
import { Stamp } from '../../Math/Stamp';
import { StampType } from '../../../dataTypes/Stamps';

export class ResistorElement implements BaseElement {
  static pattern = /^(R\S*)\s+(\S+)\s+(\S+)\s+(\S+)(?:\s+(G2|\[G2\]))?/i;

  static isMatched(line: string): ResistorElement | null {
    const match = line.match(ResistorElement.pattern);
    if (!match) return null;
    const [, name, node1, node2, valToken, g2Token] = match;
    const value = parseEngineeringValue(valToken);
    const isGroup2 = g2Token ? g2Token.toUpperCase().includes('G2') : true;
    return new ResistorElement(name, node1, node2, value, isGroup2);
  }

  name: string;
  type: typeof StampType.Resistor = StampType.Resistor;
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


  createStamp(dimensions: string[]): Stamp {
    const stamp = new Stamp(dimensions);
    if (!this.isGroup2) {
      const g = 1 / this.value;
      stamp.G.set(`V${this.node1}`, `V${this.node1}`, stamp.G.get(`V${this.node1}`, `V${this.node1}`) + g);
      stamp.G.set(`V${this.node2}`, `V${this.node2}`, stamp.G.get(`V${this.node2}`, `V${this.node2}`) + g);
      stamp.G.set(`V${this.node1}`, `V${this.node2}`, stamp.G.get(`V${this.node1}`, `V${this.node2}`) - g);
      stamp.G.set(`V${this.node2}`, `V${this.node1}`, stamp.G.get(`V${this.node2}`, `V${this.node1}`) - g);
    } else {
      stamp.G.set(`V${this.node1}`, `i_${this.name}`, stamp.G.get(`V${this.node1}`, `i_${this.name}`) + 1);
      stamp.G.set(`V${this.node2}`, `i_${this.name}`, stamp.G.get(`V${this.node2}`, `i_${this.name}`) - 1);
      stamp.G.set(`i_${this.name}`, `V${this.node1}`, stamp.G.get(`i_${this.name}`, `V${this.node1}`) + 1);
      stamp.G.set(`i_${this.name}`, `V${this.node2}`, stamp.G.get(`i_${this.name}`, `V${this.node2}`) - 1);
      stamp.G.set(`i_${this.name}`, `i_${this.name}`, stamp.G.get(`i_${this.name}`, `i_${this.name}`) - this.value);
    }
    return stamp;
  }
}
