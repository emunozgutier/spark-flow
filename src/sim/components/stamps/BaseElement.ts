import { Stamp } from '../../Math/Stamp';

export interface BaseElement {
  name: string;
  type: 'resistor' | 'capacitor' | 'inductor' | 'voltage' | 'current' | 'diode' | 'bjt' | 'mosfet';
  node1: string;
  node2: string;
  node3?: string;
  value: number;
  isGroup2: boolean;

  /**
   * Returns the number of auxiliary equations (and current variables) this element introduces in MNA.
   */
  getGroup2Count(): number;

  /**
   * Directly creates and populates a Stamp instance matching the simulation dimensions.
   */
  createStamp(dimensions: string[], voltages?: Record<string, number>): Stamp;
}
