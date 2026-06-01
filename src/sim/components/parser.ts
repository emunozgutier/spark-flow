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
import { parseEngineering } from '../../utils/math';

/**
 * Parses a string representing an electrical value with engineering notations.
 * Translates SPICE-specific case-insensitive 'meg' to standard 'M' and delegates to parseEngineering.
 */
export const parseEngineeringValue = (str: string): number => {
  let normalized = str.trim();
  if (!normalized) return 0;
  
  // SPICE mega suffix is 'meg' (case-insensitive)
  if (normalized.toLowerCase().endsWith('meg')) {
    normalized = normalized.substring(0, normalized.length - 3) + 'M';
  } else if (normalized.toLowerCase().endsWith('k')) {
    normalized = normalized.substring(0, normalized.length - 1) + 'k';
  } else if (normalized.toLowerCase().endsWith('m')) {
    // In SPICE, 'm' represents milli, which maps to 'm' in parseEngineering.
    // 'M' in parseEngineering represents Mega. 
    normalized = normalized.substring(0, normalized.length - 1) + 'm';
  }
  
  return parseEngineering(normalized);
};

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

    const tokens = line.split(/\s+/);
    if (tokens.length < 4) {
      continue; // Need Name, Node1, Node2, Value
    }

    const name = tokens[0];
    const node1 = tokens[1];
    const node2 = tokens[2];
    
    let valToken = tokens[3];
    // Skip DC/AC prefixes
    if ((valToken.toUpperCase() === 'DC' || valToken.toUpperCase() === 'AC') && tokens.length > 4) {
      valToken = tokens[4];
    }

    const value = parseEngineeringValue(valToken);
    let element: BaseElement | null = null;

    if (/^R/i.test(name)) {
      // Check for Group 2 G2 flag
      let isGroup2 = false;
      for (let i = 4; i < tokens.length; i++) {
        const t = tokens[i].toUpperCase();
        if (t === 'G2' || t === '[G2]') {
          isGroup2 = true;
        }
      }
      element = new ResistorElement(name, node1, node2, value, isGroup2);
    } else if (/^L/i.test(name)) {
      element = new InductorElement(name, node1, node2, value);
    } else if (/^C/i.test(name)) {
      element = new CapacitorElement(name, node1, node2, value);
    } else if (/^V/i.test(name)) {
      element = new VoltageSourceElement(name, node1, node2, value);
    } else if (/^I/i.test(name)) {
      element = new CurrentSourceElement(name, node1, node2, value);
    }

    if (element) {
      elementsList.push(element);
      uniqueNodes.add(node1);
      uniqueNodes.add(node2);
    }
  }

  // ground is mapped to "0", let's ensure it's standardized
  const nodesList = Array.from(uniqueNodes).filter(n => n !== '0' && n.toUpperCase() !== 'GND');
  const nodes = ['0', ...nodesList];

  return { elementsList, nodes };
};
