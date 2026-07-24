import React, { useState, useMemo } from 'react';
import { Spice } from '../../../sim/Spice';
import { formatEngineering } from '../../../utils/math';
import type { Vector } from '../../../sim/Math/Vector';

interface TransientSimProps {
  spiceNetlist: string;
}

const solveNetlistAtState = (
  netlistStr: string,
  acSourceValues: Record<string, number>
): { nodeVoltages: Record<string, number>; branchCurrents: Record<string, number> } => {
  // Replace AC source values with instantaneous AC voltage for transient step
  let modifiedNetlist = netlistStr;
  Object.keys(acSourceValues).forEach((srcName) => {
    const val = acSourceValues[srcName];
    const lines = modifiedNetlist.split('\n');
    const updated = lines.map((line) => {
      const trimmed = line.trim();
      if (trimmed.toLowerCase().startsWith(srcName.toLowerCase() + ' ')) {
        const parts = trimmed.split(/\s+/);
        if (parts.length >= 4) {
          if (parts[3].toUpperCase() === 'AC' || parts[3].toUpperCase() === 'DC') {
            parts[4] = String(val);
          } else {
            parts[3] = String(val);
          }
          return parts.join(' ');
        }
      }
      return line;
    });
    modifiedNetlist = updated.join('\n');
  });

  let voltages: Record<string, number> = { '0': 0 };
  const hasNonLinear = /D\d+|Q\d+|M\d+/i.test(modifiedNetlist);
  const maxIterations = hasNonLinear ? 50 : 1;
  const tolerance = 1e-5;

  let finalVec: Vector | null = null;
  for (let iter = 0; iter < maxIterations; iter++) {
    const sim = new Spice(modifiedNetlist);
    finalVec = sim.solve(voltages);

    let maxDiff = 0;
    const nextVoltages: Record<string, number> = { '0': 0 };
    if (finalVec && finalVec.dimensions) {
      for (const dim of finalVec.dimensions) {
        if (dim.startsWith('V') && !dim.startsWith('Vac') && !dim.includes('_')) {
          const nodeName = dim.substring(1);
          const vOld = voltages[nodeName] || 0;
          const vNew = finalVec.get(dim);
          nextVoltages[nodeName] = vNew;
          const diff = Math.abs(vNew - vOld);
          if (diff > maxDiff) maxDiff = diff;
        }
      }
    }
    voltages = nextVoltages;
    if (!hasNonLinear || maxDiff < tolerance) break;
  }

  const nodeVoltages: Record<string, number> = { ...voltages };
  const branchCurrents: Record<string, number> = {};

  if (finalVec && finalVec.dimensions) {
    for (const dim of finalVec.dimensions) {
      if (dim.startsWith('i_')) {
        const elName = dim.substring(2);
        branchCurrents[elName] = finalVec.get(dim);
      }
    }
  }

  return { nodeVoltages, branchCurrents };
};

export const TransientSim: React.FC<TransientSimProps> = ({ spiceNetlist }) => {
  const simInfo = useMemo(() => {
    try {
      const sim = new Spice(spiceNetlist);
      const sourcesList = sim.elementsList.filter(
        (el) => el.name.toLowerCase().startsWith('vac') || el.type === 'voltage'
      );
      const branchCurrents = sim.elementsList
        .filter((el) => el.getGroup2Count() > 0)
        .map((el) => el.name);

      return {
        sources: sourcesList,
        nodes: sim.nodes,
        branchCurrents,
        isValid: sim.elementsList.length > 0
      };
    } catch (e) {
      return {
        sources: [],
        nodes: [] as string[],
        branchCurrents: [] as string[],
        isValid: false
      };
    }
  }, [spiceNetlist]);

  // Transient Settings
  const [stopTimeVal, setStopTimeVal] = useState<string>('0.033'); // ~33ms (2 cycles at 60Hz)
  const [stepTimeVal, setStepTimeVal] = useState<string>('0.0002'); // 0.2ms step

  // Plot Target States
  const [targetType, setTargetType] = useState<'node' | 'current'>('node');
  const [selectedNode, setSelectedNode] = useState<string>(
    simInfo.nodes.find((n) => n !== '0') || '1'
  );
  const [selectedCurrent, setSelectedCurrent] = useState<string>(
    simInfo.branchCurrents.length > 0 ? simInfo.branchCurrents[0] : ''
  );

  // Hover tracker state
  const [hoveredPoint, setHoveredPoint] = useState<{
    x: number;
    y: number;
    svgX: number;
    svgY: number;
  } | null>(null);

  const plotTargetExpr = useMemo(() => {
    return targetType === 'node' ? `V(${selectedNode})` : `I(${selectedCurrent})`;
  }, [targetType, selectedNode, selectedCurrent]);

  // Run Transient Simulation
  const transientData = useMemo(() => {
    if (!simInfo.isValid) return [];

    const stopTime = parseFloat(stopTimeVal);
    const stepTime = parseFloat(stepTimeVal);

    if (isNaN(stopTime) || isNaN(stepTime) || stopTime <= 0 || stepTime <= 0) {
      return [];
    }

    const numPoints = Math.min(600, Math.floor(stopTime / stepTime) + 1);
    const points: { x: number; y: number }[] = [];

    for (let i = 0; i < numPoints; i++) {
      const t = i * stepTime;
      const acValues: Record<string, number> = {};

      // Compute instantaneous AC voltages
      simInfo.sources.forEach((src) => {
        const peak = src.value || 5;
        const freq = 60; // 60 Hz
        acValues[src.name] = peak * Math.sin(2 * Math.PI * freq * t);
      });

      const res = solveNetlistAtState(spiceNetlist, acValues);
      let yVal = 0;
      if (targetType === 'node') {
        yVal = res.nodeVoltages[selectedNode] ?? 0;
      } else {
        yVal = res.branchCurrents[selectedCurrent] ?? 0;
      }

      points.push({ x: t, y: yVal });
    }

    return points;
  }, [spiceNetlist, simInfo, stopTimeVal, stepTimeVal, targetType, selectedNode, selectedCurrent]);

  // Compute graph bounds
  const bounds = useMemo(() => {
    if (transientData.length === 0) {
      return { minX: 0, maxX: 0.033, minY: -5, maxY: 5 };
    }

    const xs = transientData.map((d) => d.x);
    const ys = transientData.map((d) => d.y);

    let minX = Math.min(...xs);
    let maxX = Math.max(...xs);
    let minY = Math.min(...ys);
    let maxY = Math.max(...ys);

    if (maxX === minX) {
      minX = 0;
      maxX = 0.033;
    }
    if (maxY === minY) {
      minY -= 1;
      maxY += 1;
    } else {
      const yDiff = maxY - minY;
      minY -= yDiff * 0.08;
      maxY += yDiff * 0.08;
    }

    return { minX, maxX, minY, maxY };
  }, [transientData]);

  // Dimensions
  const width = 600;
  const height = 300;
  const paddingLeft = 60;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 40;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const getSvgX = (x: number) => {
    return paddingLeft + ((x - bounds.minX) / (bounds.maxX - bounds.minX || 1)) * chartWidth;
  };

  const getSvgY = (y: number) => {
    return paddingTop + chartHeight - ((y - bounds.minY) / (bounds.maxY - bounds.minY || 1)) * chartHeight;
  };

  const pathD = useMemo(() => {
    if (transientData.length === 0) return '';
    return transientData
      .map((d, i) => `${i === 0 ? 'M' : 'L'} ${getSvgX(d.x)} ${getSvgY(d.y)}`)
      .join(' ');
  }, [transientData, bounds]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', height: '100%' }}>
      {/* Controls Card */}
      <div
        className="glass-panel animate-fade-in"
        style={{
          padding: '12px 16px',
          background: 'rgba(20, 25, 40, 0.4)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '10px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '16px',
          alignItems: 'center'
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.4)', fontWeight: 600 }}>STOP TIME (s)</label>
          <input
            type="number"
            step="any"
            value={stopTimeVal}
            onChange={(e) => setStopTimeVal(e.target.value)}
            style={{
              background: '#0d0f17',
              border: '1px solid rgba(255,255,255,0.15)',
              color: '#fff',
              fontSize: '11px',
              padding: '4px 6px',
              borderRadius: '4px',
              width: '75px',
              outline: 'none',
              height: '24px'
            }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.4)', fontWeight: 600 }}>TIME STEP (s)</label>
          <input
            type="number"
            step="any"
            value={stepTimeVal}
            onChange={(e) => setStepTimeVal(e.target.value)}
            style={{
              background: '#0d0f17',
              border: '1px solid rgba(255,255,255,0.15)',
              color: '#fff',
              fontSize: '11px',
              padding: '4px 6px',
              borderRadius: '4px',
              width: '75px',
              outline: 'none',
              height: '24px'
            }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.4)', fontWeight: 600 }}>PLOT TARGET TYPE</label>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              onClick={() => setTargetType('node')}
              style={{
                background: targetType === 'node' ? 'rgba(59, 130, 246, 0.2)' : '#0d0f17',
                border: `1px solid ${targetType === 'node' ? 'var(--theme-sapphire)' : 'rgba(255,255,255,0.15)'}`,
                color: targetType === 'node' ? 'var(--theme-sapphire)' : '#a0aec0',
                fontSize: '10px',
                padding: '2px 8px',
                borderRadius: '4px',
                cursor: 'pointer',
                height: '24px'
              }}
            >
              Node Voltage
            </button>
            <button
              onClick={() => setTargetType('current')}
              style={{
                background: targetType === 'current' ? 'rgba(59, 130, 246, 0.2)' : '#0d0f17',
                border: `1px solid ${targetType === 'current' ? 'var(--theme-sapphire)' : 'rgba(255,255,255,0.15)'}`,
                color: targetType === 'current' ? 'var(--theme-sapphire)' : '#a0aec0',
                fontSize: '10px',
                padding: '2px 8px',
                borderRadius: '4px',
                cursor: 'pointer',
                height: '24px'
              }}
            >
              Branch Current
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.4)', fontWeight: 600 }}>TARGET</label>
          {targetType === 'node' ? (
            <select
              value={selectedNode}
              onChange={(e) => setSelectedNode(e.target.value)}
              style={{
                background: '#0d0f17',
                border: '1px solid rgba(255,255,255,0.15)',
                color: '#fff',
                fontSize: '11px',
                padding: '4px 8px',
                borderRadius: '4px',
                outline: 'none',
                height: '24px'
              }}
            >
              {simInfo.nodes.map((node) => (
                <option key={node} value={node}>
                  Node {node === '0' ? '0 (GND)' : node}
                </option>
              ))}
            </select>
          ) : (
            <select
              value={selectedCurrent}
              onChange={(e) => setSelectedCurrent(e.target.value)}
              style={{
                background: '#0d0f17',
                border: '1px solid rgba(255,255,255,0.15)',
                color: '#fff',
                fontSize: '11px',
                padding: '4px 8px',
                borderRadius: '4px',
                outline: 'none',
                height: '24px'
              }}
            >
              {simInfo.branchCurrents.map((curr) => (
                <option key={curr} value={curr}>
                  I({curr})
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Plot Viewport */}
      <div
        className="glass-panel"
        style={{
          flex: 1,
          background: '#090a0f',
          border: '1.5px solid rgba(255,255,255,0.08)',
          borderRadius: '12px',
          padding: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          minHeight: '260px'
        }}
      >
        <div style={{ position: 'relative', width: '100%', maxWidth: `${width}px` }}>
          <svg width="100%" viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
            <defs>
              <filter id="neonGlowTransient" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Zero reference line */}
            {bounds.minY <= 0 && bounds.maxY >= 0 && (
              <line
                x1={paddingLeft}
                y1={getSvgY(0)}
                x2={paddingLeft + chartWidth}
                y2={getSvgY(0)}
                stroke="rgba(255, 255, 255, 0.2)"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
            )}

            {/* Axis Lines */}
            <line
              x1={paddingLeft}
              y1={paddingTop}
              x2={paddingLeft}
              y2={paddingTop + chartHeight}
              stroke="rgba(255,255,255,0.15)"
              strokeWidth="1.5"
            />
            <line
              x1={paddingLeft}
              y1={paddingTop + chartHeight}
              x2={paddingLeft + chartWidth}
              y2={paddingTop + chartHeight}
              stroke="rgba(255,255,255,0.15)"
              strokeWidth="1.5"
            />

            {/* Waveform Line */}
            <path
              d={pathD}
              fill="none"
              stroke="var(--theme-emerald)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#neonGlowTransient)"
            />

            {/* X Axis Label */}
            <text
              x={paddingLeft + chartWidth / 2}
              y={height - 8}
              fill="rgba(255,255,255,0.6)"
              fontSize="11"
              fontWeight="500"
              textAnchor="middle"
            >
              Time (s)
            </text>

            {/* Y Axis Label */}
            <text
              x={-paddingTop - chartHeight / 2}
              y={15}
              transform="rotate(-90)"
              fill="rgba(255,255,255,0.6)"
              fontSize="11"
              fontWeight="500"
              textAnchor="middle"
            >
              {plotTargetExpr}
            </text>
          </svg>
        </div>
      </div>
    </div>
  );
};
