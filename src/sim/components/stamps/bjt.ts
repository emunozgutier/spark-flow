/**
 * bjt.ts
 * BjtElement class implementation (NPN BJT using Ebers-Moll transport model).
 */

import type { BaseElement } from './BaseElement';
import { parseEngineeringValue } from '../../../utils/math';
import { Stamp } from '../../Math/Stamp';

export class BjtElement implements BaseElement {
  // Pattern matches Qname collector base emitter [beta]
  static pattern = /^(Q\S*)\s+(\S+)\s+(\S+)\s+(\S+)(?:\s+(\S+))?/i;

  static isMatched(line: string): BjtElement | null {
    const match = line.match(BjtElement.pattern);
    if (!match) return null;
    const [, name, node1, node2, node3, valToken] = match;
    const value = valToken ? parseEngineeringValue(valToken) : 100;
    return new BjtElement(name, node1, node2, node3, value);
  }

  name: string;
  type: 'bjt' = 'bjt';
  node1: string; // Collector
  node2: string; // Base
  node3: string; // Emitter
  value: number; // Current gain (betaF)
  isGroup2 = false;

  constructor(name: string, node1: string, node2: string, node3: string, value = 100) {
    this.name = name;
    this.node1 = node1;
    this.node2 = node2;
    this.node3 = node3;
    this.value = value;
  }

  getGroup2Count(): number {
    return 0;
  }


  createStamp(dimensions: string[], voltages?: Record<string, number>): Stamp {
    const stamp = new Stamp(dimensions);
    const V1 = `V${this.node1}`;
    const V2 = `V${this.node2}`;
    const V3 = `V${this.node3}`;

    const vC = voltages ? (voltages[this.node1] || 0) : 0;
    const vB = voltages ? (voltages[this.node2] || 0) : 0;
    const vE = voltages ? (voltages[this.node3] || 0) : 0;

    const vbe = vB - vE;
    const vbc = vB - vC;

    const vbeClamped = Math.max(-1.0, Math.min(0.8, vbe));
    const vbcClamped = Math.max(-1.0, Math.min(0.8, vbc));

    const Is = 1e-14;
    const Vt = 0.026;
    const betaF = this.value;
    const betaR = 1;

    const expTermF = Math.exp(vbeClamped / Vt);
    const expTermR = Math.exp(vbcClamped / Vt);

    const gf = (Is / Vt) * expTermF;
    const gr = (Is / Vt) * expTermR;

    const If = Is * (expTermF - 1);
    const Ir = Is * (expTermR - 1);

    const Jac = [
      [(1 + 1 / betaR) * gr, gf - (1 + 1 / betaR) * gr, -gf],
      [-gr / betaR, gf / betaF + gr / betaR, -gf / betaF],
      [-gr, -(1 + 1 / betaF) * gf + gr, (1 + 1 / betaF) * gf]
    ];

    const I_nonlin = [
      If - (1 + 1 / betaR) * Ir,
      If / betaF + Ir / betaR,
      -(1 + 1 / betaF) * If + Ir
    ];

    const I_eq = [
      I_nonlin[0] - (Jac[0][0] * vC + Jac[0][1] * vB + Jac[0][2] * vE),
      I_nonlin[1] - (Jac[1][0] * vC + Jac[1][1] * vB + Jac[1][2] * vE),
      I_nonlin[2] - (Jac[2][0] * vC + Jac[2][1] * vB + Jac[2][2] * vE)
    ];

    const nodes = [V1, V2, V3];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        stamp.G.set(nodes[r], nodes[c], stamp.G.get(nodes[r], nodes[c]) + Jac[r][c]);
      }
      stamp.S.set(nodes[r], stamp.S.get(nodes[r]) - I_eq[r]);
    }

    return stamp;
  }
}
