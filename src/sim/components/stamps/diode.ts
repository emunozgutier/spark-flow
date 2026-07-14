/**
 * diode.ts
 * DiodeElement class implementation.
 */

import type { BaseElement } from './BaseElement';
import { parseEngineeringValue } from '../../../utils/math';
import { Stamp } from '../../Math/Stamp';

export class DiodeElement implements BaseElement {
  static pattern = /^(D\S*)\s+(\S+)\s+(\S+)(?:\s+(\S+))?/i;

  static isMatched(line: string): DiodeElement | null {
    const match = line.match(DiodeElement.pattern);
    if (!match) return null;
    const [, name, node1, node2, valToken] = match;
    const value = valToken ? parseEngineeringValue(valToken) : 0;
    return new DiodeElement(name, node1, node2, value);
  }

  name: string;
  type: 'diode' = 'diode';
  node1: string; // Anode (+)
  node2: string; // Cathode (-)
  value: number; // Not strictly used for diode but matches BaseElement
  isGroup2 = false;

  constructor(name: string, node1: string, node2: string, value = 0) {
    this.name = name;
    this.node1 = node1;
    this.node2 = node2;
    this.value = value;
  }

  getGroup2Count(): number {
    return 0;
  }


  createStamp(dimensions: string[], voltages?: Record<string, number>): Stamp {
    const stamp = new Stamp(dimensions);
    const v1 = voltages ? (voltages[this.node1] || 0) : 0;
    const v2 = voltages ? (voltages[this.node2] || 0) : 0;
    let vd = v1 - v2;

    if (vd > 0.8) {
      vd = 0.8;
    } else if (vd < -1.0) {
      vd = -1.0;
    }

    const Is = 1e-14;
    const Vt = 0.026;
    const expTerm = Math.exp(vd / Vt);

    const gd = (Is / Vt) * expTerm;
    const id = Is * (expTerm - 1);

    const Ieq = id - gd * vd;

    stamp.Jg.set(`V${this.node1}`, `V${this.node1}`, stamp.Jg.get(`V${this.node1}`, `V${this.node1}`) + gd);
    stamp.Jg.set(`V${this.node2}`, `V${this.node2}`, stamp.Jg.get(`V${this.node2}`, `V${this.node2}`) + gd);
    stamp.Jg.set(`V${this.node1}`, `V${this.node2}`, stamp.Jg.get(`V${this.node1}`, `V${this.node2}`) - gd);
    stamp.Jg.set(`V${this.node2}`, `V${this.node1}`, stamp.Jg.get(`V${this.node2}`, `V${this.node1}`) - gd);

    stamp.S.set(`V${this.node1}`, stamp.S.get(`V${this.node1}`) - Ieq);
    stamp.S.set(`V${this.node2}`, stamp.S.get(`V${this.node2}`) + Ieq);

    return stamp;
  }
}
