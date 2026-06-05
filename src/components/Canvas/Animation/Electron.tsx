import type { Point } from '../../../dataTypes/AnotateType';

export interface Electron {
  segmentId: string;
  progress: number;
}

export const setupElectronStyles = (ctx: CanvasRenderingContext2D) => {
  ctx.fillStyle = '#67e8f9'; // Cyan core
  ctx.shadowBlur = 8;
  ctx.shadowColor = '#06b6d4'; // Cyan bloom glow
};

export const drawElectron = (ctx: CanvasRenderingContext2D, pos: Point) => {
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, 3.5, 0, 2 * Math.PI);
  ctx.fill();
};
