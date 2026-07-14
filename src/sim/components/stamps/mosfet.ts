/**
 * mosfet.ts
 * MosfetElement class implementation (NMOS MOSFET using Shichman-Hodges model).
 */

import type { BaseElement, ElementStamp } from './BaseElement';
import { parseEngineeringValue } from '../../../utils/math';

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

  getStampGroup1(nodeMap: Map<string, number>, voltages?: Record<string, number>): ElementStamp {
    const getNodeIdx = (node: string): number => {
      if (!node || node === '0' || node.toUpperCase() === 'GND') return 0;
      return nodeMap.get(node) || 0;
    };

    const iD = getNodeIdx(this.node1);
    const iG = getNodeIdx(this.node2);
    const iS = getNodeIdx(this.node3);

    const gD = iD > 0 ? iD - 1 : -1;
    const gG = iG > 0 ? iG - 1 : -1;
    const gS = iS > 0 ? iS - 1 : -1;

    // Get current voltage estimate
    const vD = voltages ? (voltages[this.node1] || 0) : 0;
    const vG = voltages ? (voltages[this.node2] || 0) : 0;
    const vS = voltages ? (voltages[this.node3] || 0) : 0;

    const Vth = this.value; // Threshold voltage
    const beta = 1e-3;      // Transconductance parameter (1 mA/V^2)

    let Id = 0;
    let dId_vd = 0;
    let dId_vg = 0;
    let dId_vs = 0;

    if (vD >= vS) {
      const vgs = Math.max(-10, Math.min(10, vG - vS));
      const vds = Math.max(0, Math.min(10, vD - vS));

      if (vgs < Vth) {
        // Cutoff
        Id = 0;
        dId_vd = 0;
        dId_vg = 0;
        dId_vs = 0;
      } else if (vds < vgs - Vth) {
        // Linear (triode) region
        Id = beta * ((vgs - Vth) * vds - 0.5 * vds * vds);
        dId_vg = beta * vds;
        dId_vd = beta * (vgs - Vth - vds);
        dId_vs = -(dId_vg + dId_vd);
      } else {
        // Saturation region
        Id = 0.5 * beta * (vgs - Vth) * (vgs - Vth);
        dId_vg = beta * (vgs - Vth);
        dId_vd = 0;
        dId_vs = -dId_vg;
      }
    } else {
      // Symmetric swap: Source and Drain swap roles when vD < vS
      const vgd = Math.max(-10, Math.min(10, vG - vD));
      const vsd = Math.max(0, Math.min(10, vS - vD));

      if (vgd < Vth) {
        // Cutoff
        Id = 0;
        dId_vd = 0;
        dId_vg = 0;
        dId_vs = 0;
      } else if (vsd < vgd - Vth) {
        // Linear (triode) region
        const Is = beta * ((vgd - Vth) * vsd - 0.5 * vsd * vsd);
        const dIs_vg = beta * vsd;
        const dIs_vs = beta * (vgd - Vth - vsd);
        const dIs_vd = -(dIs_vg + dIs_vs);
        
        Id = -Is;
        dId_vg = -dIs_vg;
        dId_vs = -dIs_vs;
        dId_vd = -dIs_vd;
      } else {
        // Saturation region
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

    const g_local = [Id];
    const Jg_local = [
      [dId_vd, dId_vg, dId_vs]
    ];
    const H_local = [
      [1],  // maps to Drain equation (+Id flows out of node)
      [0],  // maps to Gate equation (no gate current)
      [-1]  // maps to Source equation (-Id flows out of node)
    ];
    const globalIndices = [gD, gG, gS];

    return { g_local, Jg_local, H_local, globalIndices };
  }

  getStampGroup2(_nodeMap: Map<string, number>, _group2Idx: number, _voltages?: Record<string, number>): ElementStamp {
    return { globalIndices: [] };
  }
}
