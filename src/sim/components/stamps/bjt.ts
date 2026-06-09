/**
 * bjt.ts
 * BjtElement class implementation (NPN BJT using Ebers-Moll transport model).
 */

import type { BaseElement, ElementStamp } from './BaseElement';

export class BjtElement implements BaseElement {
  // Pattern matches Qname collector base emitter [beta]
  static pattern = /^(Q\S*)\s+(\S+)\s+(\S+)\s+(\S+)(?:\s+(\S+))?/i;

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

  getStampGroup1(nodeMap: Map<string, number>, voltages?: Record<string, number>): ElementStamp {
    const getNodeIdx = (node: string): number => {
      if (!node || node === '0' || node.toUpperCase() === 'GND') return 0;
      return nodeMap.get(node) || 0;
    };

    const iC = getNodeIdx(this.node1);
    const iB = getNodeIdx(this.node2);
    const iE = getNodeIdx(this.node3);

    const gC = iC > 0 ? iC - 1 : -1;
    const gB = iB > 0 ? iB - 1 : -1;
    const gE = iE > 0 ? iE - 1 : -1;

    // Get current voltage estimate
    const vC = voltages ? (voltages[this.node1] || 0) : 0;
    const vB = voltages ? (voltages[this.node2] || 0) : 0;
    const vE = voltages ? (voltages[this.node3] || 0) : 0;

    const vbe = vB - vE;
    const vbc = vB - vC;

    // Damp/limit voltages to prevent exponential overflow
    const vbeClamped = Math.max(-1.0, Math.min(0.8, vbe));
    const vbcClamped = Math.max(-1.0, Math.min(0.8, vbc));

    const Is = 1e-14; // Saturation current
    const Vt = 0.026; // Thermal voltage
    const betaF = this.value; // Forward beta
    const betaR = 1; // Reverse beta

    const expTermF = Math.exp(vbeClamped / Vt);
    const expTermR = Math.exp(vbcClamped / Vt);

    // Conductances
    const gf = (Is / Vt) * expTermF;
    const gr = (Is / Vt) * expTermR;

    // Transport currents
    const If = Is * (expTermF - 1);
    const Ir = Is * (expTermR - 1);

    // Companion model equivalent currents
    const IeqF = If - gf * vbeClamped;
    const IeqR = Ir - gr * vbcClamped;

    // Conductance matrix coefficients (Jacobian)
    const Gcc = (1 + 1 / betaR) * gr;
    const Gcb = gf - (1 + 1 / betaR) * gr;
    const Gce = -gf;

    const Gbc = -gr / betaR;
    const Gbb = gf / betaF + gr / betaR;
    const Gbe = -gf / betaF;

    const Gec = -gr;
    const Geb = -(1 + 1 / betaF) * gf + gr;
    const Gee = (1 + 1 / betaF) * gf;

    // RHS equivalent currents (LHS is +I_leaving, so RHS gets -I_eq)
    const Bc = -IeqF + (1 + 1 / betaR) * IeqR;
    const Bb = -IeqF / betaF - IeqR / betaR;
    const Be = (1 + 1 / betaF) * IeqF - IeqR;

    const A = [
      [Gcc, Gcb, Gce],
      [Gbc, Gbb, Gbe],
      [Gec, Geb, Gee]
    ];
    const B = [Bc, Bb, Be];
    const globalIndices = [gC, gB, gE];

    return { A, B, globalIndices };
  }

  getStampGroup2(_nodeMap: Map<string, number>, _group2Idx: number, _voltages?: Record<string, number>): ElementStamp {
    return { A: [], B: [], globalIndices: [] };
  }
}
