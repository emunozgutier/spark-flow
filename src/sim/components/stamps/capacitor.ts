/**
 * capacitor.ts
 * CapacitorElement class implementation.
 */

import type { BaseElement } from './BaseElement';
import type { MnaMatrix } from './Matrix';

export class CapacitorElement implements BaseElement {
  name: string;
  type: 'capacitor' = 'capacitor';
  node1: string;
  node2: string;
  value: number;
  isGroup2 = false; // Capacitors behave as Group 1 elements with zero admittance in DC (ideal open circuit)

  constructor(name: string, node1: string, node2: string, value: number) {
    this.name = name;
    this.node1 = node1;
    this.node2 = node2;
    this.value = value;
  }

  getGroup2Count(): number {
    return 0;
  }

  applyStamp(_matrix: MnaMatrix, _nodeMap: Map<string, number>, _group2Idx: number): void {
    // CAPACITOR DC OP OPEN-CIRCUIT STAMP
    // Behaves as ideal open circuit, so it contributes 0 to all matrix entries.
  }
}
