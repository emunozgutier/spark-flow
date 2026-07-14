/**
 * resistorVoltageTest.ts
 * Live Spice DC OP simulation test for the custom resistor & voltage network netlist.
 */

import { Spice } from '../Spice';

const netlist = `
* Resistor Voltage Test Circuit
V1 5 0 2
V2 3 2 0.2
V3 7 6 2
I1 4 8 1e-3
I2 0 6 1e-3
R1 1 5 1.5
R2 1 2 1
R3 5 2 50 G2 % this is a group 2 element
R4 5 6 0.1
R5 2 6 1.5
R6 3 4 0.1
R7 8 0 1e3
R8 4 0 10 G2 % this is a group 2 element
`;

console.log('--- Instantiating Modular SPICE Simulator with Resistor Voltage Netlist ---');
const sim = new Spice(netlist);

console.log('\n--- Parsed Component Elements ---');
sim.elementsList.forEach(el => {
  const g2Info = el.getGroup2Count() > 0 ? ' [Group 2]' : '';
  console.log(`- Element: ${el.name}, Type: ${el.type}${g2Info}, Nodes: [${el.node1}, ${el.node2}], Value: ${el.value}`);
});

console.log('\n--- Running DC Operating Point Simulation ---');
console.log('Solver disabled for now (Spice class simplified).');
