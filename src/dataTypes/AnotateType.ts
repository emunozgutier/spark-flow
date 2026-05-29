export interface Point {
  x: number;
  y: number;
}

export type ThemeColor = 'amethyst' | 'emerald' | 'sapphire' | 'amber' | 'coral' | 'slate';

/**
 * Box Annotation Structure
 * Represents a styled layout card container on the infinite canvas.
 */
export interface BoxAnnotation {
  id: string;
  type: 'box';
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;
  content: string;
  color: ThemeColor;
  borderColor?: string;
  backgroundColor?: string;
  borderRadius?: number;
}

/**
 * Arrow Annotation Structure
 * Represents a vector connecting line linking shapes or empty grid nodes together.
 */
export interface ArrowAnnotation {
  id: string;
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
 * Represents floating textual annotations overlaying elements.
 */
export interface TextAnnotation {
  id: string;
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

export type AnnotationElement = BoxAnnotation | ArrowAnnotation | TextAnnotation;

export interface AnnotateState {
  annotations: AnnotationElement[];
}
