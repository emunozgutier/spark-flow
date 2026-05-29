import type { BaseType } from './BaseType';
import type { ThemeColor } from './AnotateType';

/**
 * Resistor Structure
 * Represents a schematic resistor element on the canvas with numerical parameters.
 */
export interface Resistor extends BaseType {
  type: 'box';
  componentType: 'resistor';
  x: number;
  y: number;
  width: number;
  height: number;
  instanceNumber: number; // Unique numerical identifier (e.g. 1 for R1)
  value: number;          // Technical value in ohms (e.g. 1000 for 1k)
  color: ThemeColor;
}

/**
 * Capacitor Structure
 * Represents a schematic capacitor element on the canvas with numerical parameters.
 */
export interface Capacitor extends BaseType {
  type: 'box';
  componentType: 'capacitor';
  x: number;
  y: number;
  width: number;
  height: number;
  instanceNumber: number; // Unique numerical identifier (e.g. 1 for C1)
  value: number;          // Technical value in farads (e.g. 10e-6 for 10u)
  color: ThemeColor;
}

/**
 * Inductor Structure
 * Represents a schematic inductor element on the canvas with numerical parameters.
 */
export interface Inductor extends BaseType {
  type: 'box';
  componentType: 'inductor';
  x: number;
  y: number;
  width: number;
  height: number;
  instanceNumber: number; // Unique numerical identifier (e.g. 1 for L1)
  value: number;          // Technical value in henries (e.g. 0.01 for 10m)
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
