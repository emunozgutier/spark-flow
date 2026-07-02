import React, { useState, useMemo } from 'react';
import { Spice } from '../../../sim/Spice';
import { formatEngineering } from '../../../utils/math';

interface DCSweepProps {
  spiceNetlist: string;
}

export const DCSweep: React.FC<DCSweepProps> = ({ spiceNetlist }) => {
  // Parse elements and nodes from the netlist using the Spice parser
  const simInfo = useMemo(() => {
    try {
      const sim = new Spice(spiceNetlist);
      const sourcesList = sim.elementsList.filter(
        (el) => el.type === 'voltage' || el.type === 'current'
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
  const [stopVal, setStopVal] = useState<string>('3');
  const [stepVal, setStepVal] = useState<string>('0.1');

  // Plot Target States
  const [targetType, setTargetType] = useState<'node' | 'current' | 'custom'>('node');
  const [selectedNode, setSelectedNode] = useState<string>(
    simInfo.nodes.includes('7') ? '7' : (simInfo.nodes.find(n => n !== '0') || '1')
  );
  const [selectedCurrent, setSelectedCurrent] = useState<string>(
    simInfo.branchCurrents.length > 0 ? simInfo.branchCurrents[0] : ''
  );
  const [customTarget, setCustomTarget] = useState<string>('V(net7)');

  // Hover tracker state
  const [hoveredPoint, setHoveredPoint] = useState<{
    x: number;
    y: number;
    svgX: number;
    svgY: number;
  } | null>(null);

  // Compute target expression based on selection
  const plotTargetExpr = useMemo(() => {
    if (targetType === 'node') {
      return `V(${selectedNode})`;
    } else if (targetType === 'current') {
      return `I(${selectedCurrent})`;
    } else {
      return customTarget;
    }
  }, [targetType, selectedNode, selectedCurrent, customTarget]);

  // Helper to extract values from SpiceSimulationResult
  const getYValue = (result: any, targetExpr: string) => {
    const clean = targetExpr.trim();
    if (clean.startsWith('V(') && clean.endsWith(')')) {
      const nodeName = clean.substring(2, clean.length - 1).trim();
      if (result.nodeVoltages[nodeName] !== undefined) {
        return result.nodeVoltages[nodeName];
      }
      // Try stripping prefix "net" (e.g. V(net7) -> Node 7)
      const stripped = nodeName.replace(/^net/i, '');
      if (result.nodeVoltages[stripped] !== undefined) {
        return result.nodeVoltages[stripped];
      }
      // Try adding prefix "net" (e.g. V(7) -> Node net7)
      const withNet = `net${nodeName}`;
      if (result.nodeVoltages[withNet] !== undefined) {
        return result.nodeVoltages[withNet];
      }
    } else if (clean.startsWith('I(') && clean.endsWith(')')) {
      const elName = clean.substring(2, clean.length - 1).trim();
      if (result.branchCurrents[elName] !== undefined) {
        return result.branchCurrents[elName];
      }
    }
    return 0;
  };

  // Run the DC Sweep and generate plotting data points
  const sweepData = useMemo(() => {
    if (!simInfo.isValid || !sweepSource) return [];

    const start = parseFloat(startVal);
    const stop = parseFloat(stopVal);
    const step = parseFloat(stepVal);

    if (isNaN(start) || isNaN(stop) || isNaN(step) || step <= 0) {
      return [];
    }

    // Protection: limit maximum steps to 500 to avoid locking the UI thread
    const diff = stop - start;
    const direction = Math.sign(diff);
    if (direction === 0) return [];

    const stepSize = Math.abs(step) * direction;
    const numSteps = Math.min(500, Math.floor(Math.abs(diff) / Math.abs(step)) + 1);

    const points: { x: number; y: number }[] = [];

    for (let i = 0; i < numSteps; i++) {
      const currentSweepVal = start + i * stepSize;
      
      try {
        const sim = new Spice(spiceNetlist);
        const element = sim.elementsList.find(
          (el) => el.name.toLowerCase() === sweepSource.toLowerCase()
        );

        if (element) {
          element.value = currentSweepVal;
        }

        const result = sim.solve();
        const yVal = getYValue(result, plotTargetExpr);
        points.push({ x: currentSweepVal, y: yVal });
      } catch (err) {
        console.error('Sweep iteration failed:', err);
      }
    }

    // Add exact final step if not already included
    if (points.length > 0 && Math.abs(points[points.length - 1].x - stop) > 1e-9) {
      try {
        const sim = new Spice(spiceNetlist);
        const element = sim.elementsList.find(
          (el) => el.name.toLowerCase() === sweepSource.toLowerCase()
        );
        if (element) {
          element.value = stop;
        }
        const result = sim.solve();
        const yVal = getYValue(result, plotTargetExpr);
        points.push({ x: stop, y: yVal });
      } catch (err) {
        console.error('Sweep final step failed:', err);
      }
    }

    return points;
  }, [spiceNetlist, simInfo.isValid, sweepSource, startVal, stopVal, stepVal, plotTargetExpr]);

  // Compute bounds for plotting
  const bounds = useMemo(() => {
    if (sweepData.length === 0) {
      return { minX: 0, maxX: 1, minY: 0, maxY: 1 };
    }

    const xs = sweepData.map((d) => d.x);
    const ys = sweepData.map((d) => d.y);

    let minX = Math.min(...xs);
    let maxX = Math.max(...xs);
    let minY = Math.min(...ys);
    let maxY = Math.max(...ys);

    // Padding
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
  const paddingLeft = 55;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 40;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  // Scale data values to SVG coordinates
  const getSvgX = (x: number) => {
    return (
      paddingLeft +
      ((x - bounds.minX) / (bounds.maxX - bounds.minX)) * chartWidth
    );
  };

  const getSvgY = (y: number) => {
    return (
      paddingTop +
      chartHeight -
      ((y - bounds.minY) / (bounds.maxY - bounds.minY)) * chartHeight
    );
  };

  // Convert SVG coordinates back to data values
  const getDataFromSvg = (svgX: number) => {
    const pct = (svgX - paddingLeft) / chartWidth;
    return bounds.minX + pct * (bounds.maxX - bounds.minX);
  };

  // Build the SVG path string
  const pathD = useMemo(() => {
    if (sweepData.length === 0) return '';
    return sweepData
      .map((d, i) => `${i === 0 ? 'M' : 'L'} ${getSvgX(d.x)} ${getSvgY(d.y)}`)
      .join(' ');
  }, [sweepData, bounds]);

  // Build area path string for beautiful gradient fill under the line
  const areaD = useMemo(() => {
    if (sweepData.length === 0) return '';
    const first = sweepData[0];
    const last = sweepData[sweepData.length - 1];
    const baseSvgY = getSvgY(Math.max(bounds.minY, 0)); // Align bottom of fill to 0 or min value
    
    let path = `M ${getSvgX(first.x)} ${baseSvgY} `;
    path += sweepData.map((d) => `L ${getSvgX(d.x)} ${getSvgY(d.y)}`).join(' ');
    path += ` L ${getSvgX(last.x)} ${baseSvgY} Z`;
    return path;
  }, [sweepData, bounds]);

  // Mouse move handler for interactive tracking crosshairs
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
    if (sweepData.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * width;

    if (svgX < paddingLeft || svgX > width - paddingRight) {
      setHoveredPoint(null);
      return;
    }

    // Find nearest data point based on swept variable (X)
    const targetX = getDataFromSvg(svgX);
    let nearestPoint = sweepData[0];
    let minDistance = Math.abs(sweepData[0].x - targetX);

    for (let i = 1; i < sweepData.length; i++) {
      const dist = Math.abs(sweepData[i].x - targetX);
      if (dist < minDistance) {
        minDistance = dist;
        nearestPoint = sweepData[i];
      }
    }

    setHoveredPoint({
      x: nearestPoint.x,
      y: nearestPoint.y,
      svgX: getSvgX(nearestPoint.x),
      svgY: getSvgY(nearestPoint.y)
    });
  };

  const handleMouseLeave = () => {
    setHoveredPoint(null);
  };

  // Generate CSV for data export
  const downloadCSV = () => {
    if (sweepData.length === 0) return;
    const headers = `${sweepSource},${plotTargetExpr}\n`;
    const rows = sweepData.map((d) => `${d.x},${d.y}`).join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dc_sweep_${sweepSource}_vs_${plotTargetExpr.replace(/[()]/g, '')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Grid tick calculations
  const xTicks = useMemo(() => {
    const ticks = [];
    const step = (bounds.maxX - bounds.minX) / 5;
    for (let i = 0; i <= 5; i++) {
      ticks.push(bounds.minX + step * i);
    }
    return ticks;
  }, [bounds]);

  const yTicks = useMemo(() => {
    const ticks = [];
    const step = (bounds.maxY - bounds.minY) / 5;
    for (let i = 0; i <= 5; i++) {
      ticks.push(bounds.minY + step * i);
    }
    return ticks;
  }, [bounds]);

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
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '12px', opacity: 0.6 }}>
          <path d="M3 3v18h18" />
          <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3" />
        </svg>
        <div style={{ fontSize: '12px', fontWeight: 500 }}>No sweepable sources found</div>
        <div style={{ fontSize: '11px', opacity: 0.7, marginTop: '4px', textAlign: 'center', maxWidth: '300px' }}>
          Please add a DC Voltage Source (e.g. V1) or Current Source on the canvas to configure a DC Sweep analysis.
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
      {/* Configuration Header Card */}
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
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        {/* Row of fields */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
          {/* Source Dropdown */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.4)', fontWeight: 600 }}>SWEEP SOURCE</label>
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
            <label style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.4)', fontWeight: 600 }}>START (V/A)</label>
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
            <label style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.4)', fontWeight: 600 }}>STOP (V/A)</label>
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

          {/* Step Size */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.4)', fontWeight: 600 }}>STEP SIZE</label>
            <input
              type="number"
              step="any"
              value={stepVal}
              onChange={(e) => setStepVal(e.target.value)}
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

          {/* Target Selection type */}
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
              <button
                onClick={() => setTargetType('custom')}
                style={{
                  background: targetType === 'custom' ? 'rgba(59, 130, 246, 0.2)' : '#0d0f17',
                  border: `1px solid ${targetType === 'custom' ? 'var(--theme-sapphire)' : 'rgba(255,255,255,0.15)'}`,
                  color: targetType === 'custom' ? 'var(--theme-sapphire)' : '#a0aec0',
                  fontSize: '10px',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  height: '24px'
                }}
              >
                Custom...
              </button>
            </div>
          </div>

          {/* Dynamic selector based on target type */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.4)', fontWeight: 600 }}>EXPRESSION</label>
            {targetType === 'node' && (
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
                {simInfo.nodes.map((node) => {
                  const nodeLabel = node === '0' ? '0 (GND)' : node;
                  return (
                    <option key={node} value={node}>
                      Node {nodeLabel}
                    </option>
                  );
                })}
              </select>
            )}

            {targetType === 'current' && (
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
                {simInfo.branchCurrents.length > 0 ? (
                  simInfo.branchCurrents.map((curr) => (
                    <option key={curr} value={curr}>
                      I({curr})
                    </option>
                  ))
                ) : (
                  <option value="">No current elements</option>
                )}
              </select>
            )}

            {targetType === 'custom' && (
              <input
                type="text"
                placeholder="e.g. V(net7)"
                value={customTarget}
                onChange={(e) => setCustomTarget(e.target.value)}
                style={{
                  background: '#0d0f17',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: '#fff',
                  fontSize: '11px',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  width: '90px',
                  outline: 'none',
                  height: '24px'
                }}
              />
            )}
          </div>
        </div>

        {/* Download CSV button */}
        <button
          onClick={downloadCSV}
          disabled={sweepData.length === 0}
          style={{
            background: 'rgba(255,255,255,0.08)',
            border: 'none',
            borderRadius: '4px',
            color: sweepData.length === 0 ? 'rgba(255,255,255,0.2)' : '#fff',
            fontSize: '10px',
            padding: '5px 10px',
            cursor: sweepData.length === 0 ? 'default' : 'pointer',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            height: '24px',
            alignSelf: 'flex-end',
            transition: 'background 0.2s'
          }}
          onMouseEnter={(e) => {
            if (sweepData.length > 0) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
          }}
          onMouseLeave={(e) => {
            if (sweepData.length > 0) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Export CSV
        </button>
      </div>

      {/* Plotting Graph Window */}
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
          overflow: 'hidden',
          minHeight: '260px'
        }}
      >
        {sweepData.length === 0 ? (
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px' }}>
            Invalid sweep settings. Check start, stop, and step size.
          </div>
        ) : (
          <div style={{ position: 'relative', width: '100%', maxWidth: `${width}px` }}>
            <svg
              width="100%"
              viewBox={`0 0 ${width} ${height}`}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              style={{ overflow: 'visible', cursor: 'crosshair' }}
            >
              {/* Gradients */}
              <defs>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--theme-sapphire)" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="var(--theme-sapphire)" stopOpacity="0.0" />
                </linearGradient>
                <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Grid Lines */}
              {/* Vertical lines */}
              {xTicks.map((xVal, index) => {
                const svgX = getSvgX(xVal);
                return (
                  <g key={`grid-x-${index}`}>
                    <line
                      x1={svgX}
                      y1={paddingTop}
                      x2={svgX}
                      y2={paddingTop + chartHeight}
                      stroke="rgba(255,255,255,0.05)"
                      strokeWidth="1"
                      strokeDasharray="3 3"
                    />
                    <text
                      x={svgX}
                      y={paddingTop + chartHeight + 16}
                      fill="rgba(255,255,255,0.4)"
                      fontSize="9"
                      fontFamily="monospace"
                      textAnchor="middle"
                    >
                      {xVal.toFixed(2)}
                    </text>
                  </g>
                );
              })}

              {/* Horizontal lines */}
              {yTicks.map((yVal, index) => {
                const svgY = getSvgY(yVal);
                return (
                  <g key={`grid-y-${index}`}>
                    <line
                      x1={paddingLeft}
                      y1={svgY}
                      x2={paddingLeft + chartWidth}
                      y2={svgY}
                      stroke="rgba(255,255,255,0.05)"
                      strokeWidth="1"
                      strokeDasharray="3 3"
                    />
                    <text
                      x={paddingLeft - 8}
                      y={svgY + 3}
                      fill="rgba(255,255,255,0.4)"
                      fontSize="9"
                      fontFamily="monospace"
                      textAnchor="end"
                    >
                      {formatEngineering(yVal)}
                    </text>
                  </g>
                );
              })}

              {/* Axes lines */}
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

              {/* Gradient Area Fill */}
              <path d={areaD} fill="url(#areaGrad)" />

              {/* Plot Curve Line */}
              <path
                d={pathD}
                fill="none"
                stroke="var(--theme-sapphire)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                filter="url(#neonGlow)"
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
                Sweep Variable: {sweepSource} ({sweepSource.startsWith('I') ? 'A' : 'V'})
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
                Plot Target: {plotTargetExpr}
              </text>

              {/* Interactive Crosshairs & Tooltip */}
              {hoveredPoint && (
                <g>
                  {/* Vertical tracker line */}
                  <line
                    x1={hoveredPoint.svgX}
                    y1={paddingTop}
                    x2={hoveredPoint.svgX}
                    y2={paddingTop + chartHeight}
                    stroke="rgba(59, 130, 246, 0.4)"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                  />
                  {/* Horizontal tracker line */}
                  <line
                    x1={paddingLeft}
                    y1={hoveredPoint.svgY}
                    x2={paddingLeft + chartWidth}
                    y2={hoveredPoint.svgY}
                    stroke="rgba(59, 130, 246, 0.4)"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                  />
                  {/* Tracking dot */}
                  <circle
                    cx={hoveredPoint.svgX}
                    cy={hoveredPoint.svgY}
                    r="6"
                    fill="var(--theme-sapphire)"
                    stroke="#ffffff"
                    strokeWidth="2"
                    filter="url(#neonGlow)"
                  />
                </g>
              )}
            </svg>

            {/* Tooltip Overlay */}
            {hoveredPoint && (
              <div
                style={{
                  position: 'absolute',
                  left: `${(hoveredPoint.svgX / width) * 100}%`,
                  top: `${(hoveredPoint.svgY / height) * 100 - 15}%`,
                  transform: 'translate(-50%, -100%)',
                  background: 'rgba(11, 15, 27, 0.95)',
                  border: '1px solid var(--theme-sapphire)',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  pointerEvents: 'none',
                  fontSize: '11px',
                  boxShadow: '0 4px 15px rgba(0,0,0,0.5), 0 0 10px var(--theme-sapphire-glow)',
                  zIndex: 20,
                  whiteSpace: 'nowrap',
                  fontFamily: 'monospace',
                  color: '#fff'
                }}
              >
                <div style={{ color: 'var(--theme-sapphire)', fontWeight: 'bold', marginBottom: '2px' }}>
                  📊 Data Point
                </div>
                <div>
                  <span style={{ color: 'rgba(255,255,255,0.5)' }}>{sweepSource}:</span>{' '}
                  <span style={{ color: 'var(--theme-amber)' }}>{hoveredPoint.x.toFixed(4)} {sweepSource.startsWith('I') ? 'A' : 'V'}</span>
                </div>
                <div>
                  <span style={{ color: 'rgba(255,255,255,0.5)' }}>{plotTargetExpr}:</span>{' '}
                  <span style={{ color: 'var(--theme-emerald)' }}>{hoveredPoint.y.toFixed(4)} {plotTargetExpr.startsWith('I') ? 'A' : 'V'}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
