/**
 * Stamps.ts
 * DataType definitions for various SPICE simulator element stamp types.
 */

export const StampType = {
  Resistor: 'resistor',
  Inductor: 'inductor',
  Capacitor: 'capacitor',
  Voltage: 'voltage',
  Current: 'current',
  Diode: 'diode',
  Bjt: 'bjt',
  Mosfet: 'mosfet'
} as const;

export type StampType = typeof StampType[keyof typeof StampType];
