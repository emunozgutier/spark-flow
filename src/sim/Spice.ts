import { parseSpiceNetlistToElements } from './components/parser';
import type { BaseElement } from './components/stamps/BaseElement';
import { SystemBuilder } from './components/SystemBuilder';
import { SystemSolver } from './Math/SystemSolver';
import { Vector } from './Math/Vector';

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

  solve(voltages?: Record<string, number>): Vector {
    const builder = new SystemBuilder();
    const dims = builder.findDimensions(this.elementsList);
    const finalStamp = builder.buildFinalStamp(this.elementsList, dims, voltages);
    const solver = new SystemSolver();
    return solver.solveAlgebraicEquation(finalStamp);
  }
}
