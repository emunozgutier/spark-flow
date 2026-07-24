import React, { useState, useMemo } from 'react';
import { Spice } from '../../../sim/Spice';
import { formatEngineering } from '../../../utils/math';
import type { Vector } from '../../../sim/Math/Vector';

interface DCSweepProps {
  spiceNetlist: string;
}

const solveNetlistAtSourceValue = (
  netlistStr: string,
  sourceName: string,
  newValue: number
): { nodeVoltages: Record<string, number>; branchCurrents: Record<string, number> } => {
  const lines = netlistStr.split('\n');
  const updatedLines = lines.map((line) => {
    const trimmed = line.trim();
    if (trimmed.toLowerCase().startsWith(sourceName.toLowerCase() + ' ')) {
      const parts = trimmed.split(/\s+/);
      if (parts.length >= 4) {
        if (parts[3].toUpperCase() === 'DC' || parts[3].toUpperCase() === 'AC') {
          parts[4] = String(newValue);
        } else {
          parts[3] = String(newValue);
        }
        return parts.join(' ');
      }
    }
    return line;
  });
  const modifiedNetlist = updatedLines.join('\n');

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

export const DCSweep: React.FC<DCSweepProps> = ({ spiceNetlist }) => {
  // Parse elements and nodes from the netlist using the Spice parser
  const simInfo = useMemo(() => {
    try {
      const sim = new Spice(spiceNetlist);
      const sourcesList = sim.elementsList.filter(
        (el) => el.type === 'voltage' || el.type === 'current' || el.name.toLowerCase().startsWith('vac')
      );

      const branchCurrents = sim.elementsList
        .filter((el) => el.getGroup2Count() > 0)
        .map((el) => el.name);

      return {
        sources: sourcesList.map((s) => s.name),
        nodes: sim.nodes,
        branchCurrents,
        isValid: sim.elementsList.length > 0
      };
    } catch (e) {
      return {
        sources: [] as string[],
        nodes: [] as string[],
        branchCurrents: [] as string[],
        isValid: false
      };
    }
  }, [spiceNetlist]);

  // Sweep states
  const [sweepSource, setSweepSource] = useState<string>(
    simInfo.sources.length > 0 ? simInfo.sources[0] : 'V1'
  );
  const [startVal, setStartVal] = useState<string>('0');
  const [stopVal, setStopVal] = useState<string>('5');
  const [stepsVal, setStepsVal] = useState<string>('50');
  const [isLogarithmic, setIsLogarithmic] = useState<boolean>(false);

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

  // Run the DC Sweep and generate plotting data points
  const sweepData = useMemo(() => {
    if (!simInfo.isValid || !sweepSource) return [];

    const start = parseFloat(startVal);
    const stop = parseFloat(stopVal);
    const numSteps = Math.max(2, Math.min(500, parseInt(stepsVal, 10) || 50));

    if (isNaN(start) || isNaN(stop)) return [];

    const points: { x: number; y: number }[] = [];

    for (let i = 0; i <= numSteps; i++) {
      let currentSweepVal = 0;

      if (isLogarithmic) {
        const minVal = Math.max(1e-4, Math.abs(start));
        const maxVal = Math.max(minVal + 1e-4, Math.abs(stop));
        const logStart = Math.log10(minVal);
        const logStop = Math.log10(maxVal);
        const logVal = logStart + (i / numSteps) * (logStop - logStart);
        currentSweepVal = Math.pow(10, logVal) * (stop < 0 || start < 0 ? -1 : 1);
      } else {
        currentSweepVal = start + (i / numSteps) * (stop - start);
      }

      try {
        const res = solveNetlistAtSourceValue(spiceNetlist, sweepSource, currentSweepVal);
        let yVal = 0;
        if (targetType === 'node') {
          yVal = res.nodeVoltages[selectedNode] ?? 0;
        } else {
          yVal = Math.abs(res.branchCurrents[selectedCurrent] ?? 0);
        }
        points.push({ x: currentSweepVal, y: yVal });
      } catch (err) {
        console.error('Sweep step failed:', err);
      }
    }

    return points;
  }, [spiceNetlist, simInfo.isValid, sweepSource, startVal, stopVal, stepsVal, isLogarithmic, targetType, selectedNode, selectedCurrent]);

  // Compute bounds for plotting
  const bounds = useMemo(() => {
    if (sweepData.length === 0) {
      return { minX: 0, maxX: 5, minY: 0, maxY: 5 };
    }

    const xs = sweepData.map((d) => d.x);
    const ys = sweepData.map((d) => d.y);

    let minX = Math.min(...xs);
    let maxX = Math.max(...xs);
    let minY = Math.min(...ys);
    let maxY = Math.max(...ys);

    if (maxX === minX) {
      minX -= 1;
      maxX += 1;
    }
    if (maxY === minY) {
      minY -= 1;
      maxY += 1;
    } else {
      const yDiff = maxY - minY;
      minY -= yDiff * 0.05;
      maxY += yDiff * 0.05;
    }

    return { minX, maxX, minY, maxY };
  }, [sweepData]);

  // Plot dimensions
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
    if (sweepData.length === 0) return '';
    return sweepData
      .map((d, i) => `${i === 0 ? 'M' : 'L'} ${getSvgX(d.x)} ${getSvgY(d.y)}`)
      .join(' ');
  }, [sweepData, bounds]);

  if (!simInfo.isValid) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          padding: '40px',
          color: 'rgba(255, 255, 255, 0.5)',
          background: 'rgba(0, 0, 0, 0.1)',
          borderRadius: '8px',
          border: '1px dashed rgba(255, 255, 255, 0.1)'
        }}
      >
        <div style={{ fontSize: '12px', fontWeight: 500 }}>No sweepable sources found</div>
        <div style={{ fontSize: '11px', opacity: 0.7, marginTop: '4px', textAlign: 'center', maxWidth: '300px' }}>
          Please add a Voltage Source (e.g. V1) to configure a DC Sweep analysis.
        </div>
      </div>
    );
  }

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
          gap: '14px',
          alignItems: 'center'
        }}
      >
        {/* Voltage Source selector */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.4)', fontWeight: 600 }}>VOLTAGE SOURCE</label>
          <select
            value={sweepSource}
            onChange={(e) => setSweepSource(e.target.value)}
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
            {simInfo.sources.map((src) => (
              <option key={src} value={src}>
                {src}
              </option>
            ))}
          </select>
        </div>

        {/* Start Value */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.4)', fontWeight: 600 }}>START (V)</label>
          <input
            type="number"
            step="any"
            value={startVal}
            onChange={(e) => setStartVal(e.target.value)}
            style={{
              background: '#0d0f17',
              border: '1px solid rgba(255,255,255,0.15)',
              color: '#fff',
              fontSize: '11px',
              padding: '4px 6px',
              borderRadius: '4px',
              width: '60px',
              outline: 'none',
              height: '24px'
            }}
          />
        </div>

        {/* Stop Value */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.4)', fontWeight: 600 }}>STOP (V)</label>
          <input
            type="number"
            step="any"
            value={stopVal}
            onChange={(e) => setStopVal(e.target.value)}
            style={{
              background: '#0d0f17',
              border: '1px solid rgba(255,255,255,0.15)',
              color: '#fff',
              fontSize: '11px',
              padding: '4px 6px',
              borderRadius: '4px',
              width: '60px',
              outline: 'none',
              height: '24px'
            }}
          />
        </div>

        {/* Steps */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.4)', fontWeight: 600 }}>STEPS</label>
          <input
            type="number"
            min="2"
            max="500"
            value={stepsVal}
            onChange={(e) => setStepsVal(e.target.value)}
            style={{
              background: '#0d0f17',
              border: '1px solid rgba(255,255,255,0.15)',
              color: '#fff',
              fontSize: '11px',
              padding: '4px 6px',
              borderRadius: '4px',
              width: '55px',
              outline: 'none',
              height: '24px'
            }}
          />
        </div>

        {/* Logarithmic Step Checkbox */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingTop: '14px' }}>
          <input
            type="checkbox"
            id="logStepCheck"
            checked={isLogarithmic}
            onChange={(e) => setIsLogarithmic(e.target.checked)}
            style={{ accentColor: 'var(--theme-sapphire)', cursor: 'pointer' }}
          />
          <label htmlFor="logStepCheck" style={{ fontSize: '11px', color: '#fff', cursor: 'pointer', userSelect: 'none' }}>
            Logarithmic Step
          </label>
        </div>

        {/* Target selection */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginLeft: 'auto' }}>
          <label style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.4)', fontWeight: 600 }}>PLOT TARGET</label>
          <div style={{ display: 'flex', gap: '6px' }}>
            <select
              value={targetType}
              onChange={(e) => setTargetType(e.target.value as 'node' | 'current')}
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
              <option value="node">Node Voltage</option>
              <option value="current">Branch Current</option>
            </select>

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
              <filter id="neonGlowSweep" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

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

            {/* Plot Curve */}
            <path
              d={pathD}
              fill="none"
              stroke="var(--theme-sapphire)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#neonGlowSweep)"
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
              Swept Source: {sweepSource} (V) {isLogarithmic ? '[Log scale]' : '[Linear]'}
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
