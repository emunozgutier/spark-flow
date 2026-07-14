/**
 * simulation.ts
 * Definitions for SimulationStep and SimulationType used across the SPICE engine.
 */

export const SimulationStep = {
  DiscretizeNonLinearEquations: "DiscretizeNonLinearEquations [F(x, x')=0]",
  LinearizeNonLinearEquations: "LinearizeNonLinearEquations [F(x)=0]",
  Ax_b: "Ax=b"
} as const;
export type SimulationStep = typeof SimulationStep[keyof typeof SimulationStep];

export const SimulationType = {
  DCAnalysis: "DC Analysis",
  TransientAnalysis: "Transient Analysis",
  ACSmallSignalAnalysis: "AC Small-Signal Analysis",
  PoleZeroAnalysis: "Pole-Zero Analysis",
  SmallSignalDistortionAnalysis: "Small-Signal DistortionAnalysis",
  SensitivityAnalysis: "Sensitivity Analysis",
  NoiseAnalysis: "noise analysis"
} as const;
export type SimulationType = typeof SimulationType[keyof typeof SimulationType];

export const EquationType = {
  HxPlusGxX: "Hx+G(x)x"
} as const;
export type EquationType = typeof EquationType[keyof typeof EquationType];

export const StampType = {
  HxPlusGxX: "Hx+G(x)x"
} as const;
export type StampType = typeof StampType[keyof typeof StampType];

export { Matrix } from '../sim/Math/Matrix';
export { Vector } from '../sim/Math/Vector';
export { Stamp } from '../sim/Math/Stamp';
