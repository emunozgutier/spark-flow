/**
 * Spice.ts
 * Main coordinator class managing simulation state, parsing component lists, and node tracks.
 */

import { parseSpiceNetlistToElements } from './components/parser';
import type { BaseElement } from './components/stamps/BaseElement';

export class Spice {
  elementsList: BaseElement[] = [];
  nodes: string[] = [];

  constructor(spiceDeck?: string) {
    if (spiceDeck) {
      const { elementsList, nodes } = parseSpiceNetlistToElements(spiceDeck);
      this.elementsList = elementsList;
      this.nodes = nodes;
    }
  }
}
