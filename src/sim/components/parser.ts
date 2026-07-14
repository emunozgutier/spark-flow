/**
 * parser.ts
 * Parses SPICE netlists line-by-line and instantiates specialized Element stamp classes.
 */

import type { BaseElement } from './stamps/BaseElement';
import { ResistorElement } from './stamps/resistor';
import { InductorElement } from './stamps/inductor';
import { CapacitorElement } from './stamps/capacitor';
import { VoltageSourceElement } from './stamps/voltage';
import { CurrentSourceElement } from './stamps/current';
import { DiodeElement } from './stamps/diode';
import { BjtElement } from './stamps/bjt';
import { MosfetElement } from './stamps/mosfet';
import { parseEngineeringValue } from '../../utils/math';

export interface ParsedNetlist {
  elementsList: BaseElement[];
  nodes: string[];
}

export const parseSpiceNetlistToElements = (spiceDeck: string): ParsedNetlist => {
  const lines = spiceDeck.split('\n');
  const elementsList: BaseElement[] = [];
  const uniqueNodes = new Set<string>();

  const elementClasses = [
    ResistorElement,
    InductorElement,
    CapacitorElement,
    VoltageSourceElement,
    CurrentSourceElement,
    DiodeElement,
    BjtElement,
    MosfetElement
  ];

  for (let line of lines) {
    line = line.trim();
    if (!line || line.startsWith('*')) {
      continue; // Ignore comments and empty lines
    }

    let element: BaseElement | null = null;
    for (const elementClass of elementClasses) {
      const match = elementClass.isMatched(line);
      if (match) {
        element = match;
        break;
      }
    }

    if (element) {
      elementsList.push(element);
      uniqueNodes.add(element.node1);
      uniqueNodes.add(element.node2);
      if (element.node3) {
        uniqueNodes.add(element.node3);
      }
    }
  }

  // ground is mapped to "0", let's ensure it's standardized
  const nodesList = Array.from(uniqueNodes).filter(n => n !== '0' && n.toUpperCase() !== 'GND');
  const nodes = ['0', ...nodesList];

  return { elementsList, nodes };
};
