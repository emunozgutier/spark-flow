/**
 * diode.ts
 * DiodeElement class implementation.
 */

import type { BaseElement, ElementStamp } from './BaseElement';

export class DiodeElement implements BaseElement {
  static pattern = /^(D\S*)\s+(\S+)\s+(\S+)(?:\s+(\S+))?/i;

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

  getStampGroup1(nodeMap: Map<string, number>, voltages?: Record<string, number>): ElementStamp {
    const getNodeIdx = (node: string): number => {
      if (node === '0' || node.toUpperCase() === 'GND') return 0;
      return nodeMap.get(node) || 0;
    };

    const i1 = getNodeIdx(this.node1);
    const i2 = getNodeIdx(this.node2);

    const g1 = i1 > 0 ? i1 - 1 : -1;
    const g2 = i2 > 0 ? i2 - 1 : -1;

    // Get current voltage estimate
    const v1 = voltages ? (voltages[this.node1] || 0) : 0;
    const v2 = voltages ? (voltages[this.node2] || 0) : 0;
    let vd = v1 - v2;

    // Damp/limit voltage to prevent exponential overflow
    if (vd > 0.8) {
      vd = 0.8;
    } else if (vd < -1.0) {
      vd = -1.0;
    }

    const Is = 1e-14; // Saturation current
    const Vt = 0.026; // Thermal voltage (kT/q)
    const expTerm = Math.exp(vd / Vt);

    // Dynamic conductance gd = d(id)/d(vd)
    const gd = (Is / Vt) * expTerm;
    // Current id
    const id = Is * (expTerm - 1);
    // Equivalent current source for parallel companion model
    const Ieq = id - gd * vd;

    // A stamp:
    // [ gd, -gd]
    // [-gd,  gd]
    const A = [
      [gd, -gd],
      [-gd, gd]
    ];
    // B stamp:
    // [-Ieq]
    // [ Ieq]
    const B = [-Ieq, Ieq];
    const globalIndices = [g1, g2];

    return { A, B, globalIndices };
  }

  getStampGroup2(_nodeMap: Map<string, number>, _group2Idx: number, _voltages?: Record<string, number>): ElementStamp {
    return { A: [], B: [], globalIndices: [] };
  }
}
