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

  for (let line of lines) {
    line = line.trim();
    if (!line || line.startsWith('*')) {
      continue; // Ignore comments and empty lines
    }

    let element: BaseElement | null = null;
    let n1 = '';
    let n2 = '';

    const rMatch = line.match(ResistorElement.pattern);
    if (rMatch) {
      const [, name, node1, node2, valToken, g2Token] = rMatch;
      const value = parseEngineeringValue(valToken);
      const isGroup2 = g2Token ? g2Token.toUpperCase().includes('G2') : true;
      element = new ResistorElement(name, node1, node2, value, isGroup2);
      n1 = node1;
      n2 = node2;
    } else {
      const lMatch = line.match(InductorElement.pattern);
      if (lMatch) {
        const [, name, node1, node2, valToken] = lMatch;
        const value = parseEngineeringValue(valToken);
        element = new InductorElement(name, node1, node2, value);
        n1 = node1;
        n2 = node2;
      } else {
        const cMatch = line.match(CapacitorElement.pattern);
        if (cMatch) {
          const [, name, node1, node2, valToken] = cMatch;
          const value = parseEngineeringValue(valToken);
          element = new CapacitorElement(name, node1, node2, value);
          n1 = node1;
          n2 = node2;
        } else {
          const vMatch = line.match(VoltageSourceElement.pattern);
          if (vMatch) {
            const [, name, node1, node2, valToken] = vMatch;
            const value = parseEngineeringValue(valToken);
            element = new VoltageSourceElement(name, node1, node2, value);
            n1 = node1;
            n2 = node2;
          } else {
            const iMatch = line.match(CurrentSourceElement.pattern);
            if (iMatch) {
              const [, name, node1, node2, valToken] = iMatch;
              const value = parseEngineeringValue(valToken);
              element = new CurrentSourceElement(name, node1, node2, value);
              n1 = node1;
              n2 = node2;
            } else {
              const dMatch = line.match(DiodeElement.pattern);
              if (dMatch) {
                const [, name, node1, node2, valToken] = dMatch;
                const value = valToken ? parseEngineeringValue(valToken) : 0;
                element = new DiodeElement(name, node1, node2, value);
                n1 = node1;
                n2 = node2;
              } else {
                const qMatch = line.match(BjtElement.pattern);
                if (qMatch) {
                  const [, name, node1, node2, node3, valToken] = qMatch;
                  const value = valToken ? parseEngineeringValue(valToken) : 100;
                  element = new BjtElement(name, node1, node2, node3, value);
                  n1 = node1;
                  n2 = node2;
                } else {
                  const mMatch = line.match(MosfetElement.pattern);
                  if (mMatch) {
                    const [, name, node1, node2, node3, valToken] = mMatch;
                    const value = valToken ? parseEngineeringValue(valToken) : 2.0;
                    element = new MosfetElement(name, node1, node2, node3, value);
                    n1 = node1;
                    n2 = node2;
                  }
                }
              }
            }
          }
        }
      }
    }

    if (element) {
      elementsList.push(element);
      uniqueNodes.add(n1);
      uniqueNodes.add(n2);
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
