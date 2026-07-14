/**
 * StampBuilder.ts
 * Builds mathematical stamps and coordinates equation dimensions.
 */

import type { BaseElement } from './stamps/BaseElement';
import { Stamp } from '../Math/Stamp';

export class StampBuilder {
  /**
   * Helper function to add a string item to a list array if it is not already present.
   */
  private addIfNotThere(list: string[], item: string): void {
    if (!list.includes(item)) {
      list.push(item);
    }
  }

  /**
   * Scans elements list and returns all uniquely identified mathematical dimensions (variables).
   */
  findDimensions(elementList: BaseElement[]): string[] {
    const dimensions: string[] = [];

    for (const el of elementList) {
      const isGroup2 = el.getGroup2Count() > 0;
      const type = el.type;

      // Resistor, Current, Capacitor, Inductor, Voltage, Diode, BJT, MOSFET, etc.
      if (type === 'resistor' || type === 'current' || type === 'capacitor' || type === 'inductor') {
        // Insert node 1 and node 2 dimensions
        this.addIfNotThere(dimensions, `V${el.node1}`);
        this.addIfNotThere(dimensions, `V${el.node2}`);
        if (isGroup2) {
          this.addIfNotThere(dimensions, `i_${el.name}`);
        }
      } else if (type === 'voltage') {
        // Voltage sources are always Group 2: add V+, V- and i_V#
        // where - is node 1 and + is node 2
        this.addIfNotThere(dimensions, `V${el.node2}`); // V+
        this.addIfNotThere(dimensions, `V${el.node1}`); // V-
        this.addIfNotThere(dimensions, `i_${el.name}`);
      } else {
        // Fallback/Generic handling for multi-terminal nonlinear elements (diode, bjt, mosfet, etc.)
        if (el.node1) this.addIfNotThere(dimensions, `V${el.node1}`);
        if (el.node2) this.addIfNotThere(dimensions, `V${el.node2}`);
        if (el.node3) this.addIfNotThere(dimensions, `V${el.node3}`);
        if (isGroup2) {
          this.addIfNotThere(dimensions, `i_${el.name}`);
        }
      }
    }

    const voltages = dimensions.filter(d => d.startsWith('V'));
    const currents = dimensions.filter(d => !d.startsWith('V'));
    return [...voltages, ...currents];
  }

  /**
   * Iterates through elementList and builds stamps for all components.
   */
  buildAllStamps(elementList: BaseElement[], dimensions: string[], voltages?: Record<string, number>): Stamp[] {
    return elementList.map(el => el.createStamp(dimensions, voltages));
  }

  /**
   * Builds all element stamps and sums them up into a single final Stamp.
   */
  buildFinalStamp(elementList: BaseElement[], dimensions: string[], voltages?: Record<string, number>): Stamp {
    const stamps = this.buildAllStamps(elementList, dimensions, voltages);
    const finalStamp = new Stamp(dimensions);
    for (const s of stamps) {
      finalStamp.add(s);
    }
    return finalStamp;
  }
}
