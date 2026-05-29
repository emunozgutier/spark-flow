import type { BaseType } from './BaseType';
import type { ThemeColor } from './AnotateType';

/**
 * Resistor Structure
 * Represents a schematic resistor element on the canvas.
 */
export interface Resistor extends BaseType {
  type: 'box';
  componentType: 'resistor';
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;       // Component designator (e.g. "R1")
  content: string;     // Value and details (e.g. "1kΩ\nMax Power: 0.25W")
  color: ThemeColor;
}

/**
 * Capacitor Structure
 * Represents a schematic capacitor element on the canvas.
 */
export interface Capacitor extends BaseType {
  type: 'box';
  componentType: 'capacitor';
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;       // Component designator (e.g. "C1")
  content: string;     // Value and details (e.g. "10µF\nMax Voltage: 16V")
  color: ThemeColor;
}

/**
 * Inductor Structure
 * Represents a schematic inductor element on the canvas.
 */
export interface Inductor extends BaseType {
  type: 'box';
  componentType: 'inductor';
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;       // Component designator (e.g. "L1")
  content: string;     // Value and details (e.g. "10mH\nMax Current: 0.5A")
  color: ThemeColor;
}

/**
 * Wire Structure
 * Represents a connecting wire routing between component card sockets.
 */
export interface Wire extends BaseType {
  type: 'arrow';
  fromId: string;
  fromSocket: 'top' | 'right' | 'bottom' | 'left';
  toId: string;
  toSocket: 'top' | 'right' | 'bottom' | 'left';
  color: ThemeColor;
  label?: string;
}
