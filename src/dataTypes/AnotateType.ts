import type { BaseType } from './BaseType';

export interface Point {
  x: number;
  y: number;
}

export type ToolType = 'select' | 'text' | 'arrow' | 'hand' | 'resistor' | 'capacitor' | 'inductor';

export type ThemeColor = 'amethyst' | 'emerald' | 'sapphire' | 'amber' | 'coral' | 'slate';

/**
 * Box Annotation Structure
 * Represents a styled box card container on the canvas.
 */
export interface BoxAnnotation extends BaseType {
  type: 'box';
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;
  content: string;
  color: ThemeColor;
  componentType?: 'resistor' | 'capacitor' | 'inductor';
  borderColor?: string;
  backgroundColor?: string;
  borderRadius?: number;
}

/**
 * Arrow Annotation Structure
 * Represents a connecting vector line.
 */
export interface ArrowAnnotation extends BaseType {
  type: 'arrow';
  fromId?: string; // Anchored to a Box Annotation
  fromSocket?: 'top' | 'right' | 'bottom' | 'left';
  toId?: string;   // Anchored to a Box Annotation
  toSocket?: 'top' | 'right' | 'bottom' | 'left';
  fromPoint?: Point; // Floating starting coordinates
  toPoint?: Point;   // Floating ending coordinates
  label?: string;
  color: ThemeColor;
  style: 'straight' | 'curved' | 'dashed';
  lineWidth?: number;
}

/**
 * Free Text Annotation Structure
 * Represents overlaying textual comments.
 */
export interface TextAnnotation extends BaseType {
  type: 'text';
  x: number;
  y: number;
  text: string;
  color: ThemeColor;
  fontSize?: number;
  fontFamily?: string;
  isBold?: boolean;
  isItalic?: boolean;
}

// Backwards compatibility mappings for App & Canvas layout bindings
export type CardElement = BoxAnnotation;
export type ArrowElement = ArrowAnnotation;

export type CanvasElement = BaseType;

export interface CanvasState {
  pan: Point;
  zoom: number;
  elements: CanvasElement[];
}

export interface DraggingCardState {
  id: string;
  startX: number;
  startY: number;
  originalX: number;
  originalY: number;
}

export interface DrawingArrowState {
  fromId?: string;
  fromSocket?: 'top' | 'right' | 'bottom' | 'left';
  fromPoint?: Point;
  currentPoint: Point;
  color: ThemeColor;
  style: 'straight' | 'curved' | 'dashed';
}

export type AnnotationElement = BoxAnnotation | ArrowAnnotation | TextAnnotation;

export interface AnnotateState {
  annotations: AnnotationElement[];
}
