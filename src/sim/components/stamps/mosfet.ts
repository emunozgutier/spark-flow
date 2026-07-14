/**
 * mosfet.ts
 * MosfetElement class implementation (NMOS MOSFET using Shichman-Hodges model).
 */

import type { BaseElement } from './BaseElement';
import { parseEngineeringValue } from '../../../utils/math';
import { Stamp } from '../../Math/Stamp';

export class MosfetElement implements BaseElement {
  // Pattern matches Mname drain gate source [Vth]
  static pattern = /^(M\S*)\s+(\S+)\s+(\S+)\s+(\S+)(?:\s+(\S+))?/i;

  static isMatched(line: string): MosfetElement | null {
    const match = line.match(MosfetElement.pattern);
    if (!match) return null;
    const [, name, node1, node2, node3, valToken] = match;
    const value = valToken ? parseEngineeringValue(valToken) : 2.0;
    return new MosfetElement(name, node1, node2, node3, value);
  }

  name: string;
  type: 'mosfet' = 'mosfet';
  node1: string; // Drain
  node2: string; // Gate
  node3: string; // Source
  value: number; // Threshold voltage (Vth)
  isGroup2 = false;

  constructor(name: string, node1: string, node2: string, node3: string, value = 2.0) {
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

    const vD = voltages ? (voltages[this.node1] || 0) : 0;
    const vG = voltages ? (voltages[this.node2] || 0) : 0;
    const vS = voltages ? (voltages[this.node3] || 0) : 0;

    const Vth = this.value;
    const beta = 1e-3;

    let Id = 0;
    let dId_vd = 0;
    let dId_vg = 0;
    let dId_vs = 0;

    if (vD >= vS) {
      const vgs = Math.max(-10, Math.min(10, vG - vS));
      const vds = Math.max(0, Math.min(10, vD - vS));

      if (vgs < Vth) {
        Id = 0;
        dId_vd = 0;
        dId_vg = 0;
        dId_vs = 0;
      } else if (vds < vgs - Vth) {
        Id = beta * ((vgs - Vth) * vds - 0.5 * vds * vds);
        dId_vg = beta * vds;
        dId_vd = beta * (vgs - Vth - vds);
        dId_vs = -(dId_vg + dId_vd);
      } else {
        Id = 0.5 * beta * (vgs - Vth) * (vgs - Vth);
        dId_vg = beta * (vgs - Vth);
        dId_vd = 0;
        dId_vs = -dId_vg;
      }
    } else {
      const vgd = Math.max(-10, Math.min(10, vG - vD));
      const vsd = Math.max(0, Math.min(10, vS - vD));

      if (vgd < Vth) {
        Id = 0;
        dId_vd = 0;
        dId_vg = 0;
        dId_vs = 0;
      } else if (vsd < vgd - Vth) {
        const Is = beta * ((vgd - Vth) * vsd - 0.5 * vsd * vsd);
        const dIs_vg = beta * vsd;
        const dIs_vs = beta * (vgd - Vth - vsd);
        const dIs_vd = -(dIs_vg + dIs_vs);
        
        Id = -Is;
        dId_vg = -dIs_vg;
        dId_vs = -dIs_vs;
        dId_vd = -dIs_vd;
      } else {
        const Is = 0.5 * beta * (vgd - Vth) * (vgd - Vth);
        const dIs_vg = beta * (vgd - Vth);
        const dIs_vs = 0;
        const dIs_vd = -dIs_vg;
        
        Id = -Is;
        dId_vg = -dIs_vg;
        dId_vs = -dIs_vs;
        dId_vd = -dIs_vd;
      }
    }

    const Jac = [
      [dId_vd, dId_vg, dId_vs],
      [0, 0, 0],
      [-dId_vd, -dId_vg, -dId_vs]
    ];

    const I_nonlin = [Id, 0, -Id];

    const I_eq = [
      I_nonlin[0] - (Jac[0][0] * vD + Jac[0][1] * vG + Jac[0][2] * vS),
      I_nonlin[1] - (Jac[1][0] * vD + Jac[1][1] * vG + Jac[1][2] * vS),
      I_nonlin[2] - (Jac[2][0] * vD + Jac[2][1] * vG + Jac[2][2] * vS)
    ];

    const nodes = [V1, V2, V3];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        stamp.Jg.set(nodes[r], nodes[c], stamp.Jg.get(nodes[r], nodes[c]) + Jac[r][c]);
      }
      stamp.S.set(nodes[r], stamp.S.get(nodes[r]) - I_eq[r]);
    }

    return stamp;
  }
}
