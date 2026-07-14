/**
 * simulation.ts
 * Definitions for SimulationStep and SimulationType used across the SPICE engine.
 */

export enum SimulationStep {
  DiscretizeNonLinearEquations = "DiscretizeNonLinearEquations [F(x, x')=0]",
  LinearizeNonLinearEquations = "LinearizeNonLinearEquations [F(x)=0]",
  Ax_b = "Ax=b"
}

export enum SimulationType {
  DCAnalysis = "DC Analysis",
  TransientAnalysis = "Transient Analysis",
  ACSmallSignalAnalysis = "AC Small-Signal Analysis",
  PoleZeroAnalysis = "Pole-Zero Analysis",
  SmallSignalDistortionAnalysis = "Small-Signal DistortionAnalysis",
  SensitivityAnalysis = "Sensitivity Analysis",
  NoiseAnalysis = "noise analysis"
}

export enum EquationType {
  HxPlusGxX = "Hx+G(x)x"
}

export enum StampType {
  HxPlusGxX = "Hx+G(x)x"
}

export { Matrix } from '../sim/Math/Matrix';
export { Vector } from '../sim/Math/Vector';
export { Stamp } from '../sim/Math/Stamp';


