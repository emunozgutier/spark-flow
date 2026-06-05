import React, { useState } from 'react';
import type { CanvasElement, CardElement } from '../../../dataTypes/AnotateType';

interface MNAWalkthroughProps {
  elements: CanvasElement[];
}

export const MNAWalkthrough: React.FC<MNAWalkthroughProps> = ({ elements }) => {
  const [nmaStep, setNmaStep] = useState<number>(0);

  // Fetch values from elements for educational MNA walkthrough
  const r1Card = elements.find(
    (el) => el.type === 'box' && (el as CardElement).componentType === 'resistor' && (el as CardElement).instanceNumber === 1
  ) as CardElement | undefined;
  const r2Card = elements.find(
    (el) => el.type === 'box' && (el as CardElement).componentType === 'resistor' && (el as CardElement).instanceNumber === 2
  ) as CardElement | undefined;
  const v1Card = elements.find(
    (el) => el.type === 'box' && (el as CardElement).componentType === 'voltage' && (el as CardElement).instanceNumber === 1
  ) as CardElement | undefined;

  const r1Val = r1Card?.value !== undefined ? r1Card.value : 190.0;
  const r2Val = r2Card?.value !== undefined ? r2Card.value : 300.0;
  const v1Val = v1Card?.value !== undefined ? v1Card.value : 5.0;

  const solvedV1 = (r1Val / (r1Val + r2Val)) * v1Val;
  const solvedIR1mA = (v1Val / (r1Val + r2Val)) * 1000;
  const solvedIR2mA = -(v1Val / (r1Val + r2Val)) * 1000;
  const solvedIV1mA = -(v1Val / (r1Val + r2Val)) * 1000;

  const variableLabels = nmaStep === 5
    ? [
        '0.00 V',
        `${solvedV1.toFixed(2)} V`,
        `${v1Val.toFixed(2)} V`,
        `${solvedIR1mA.toFixed(2)}mA`,
        `${solvedIR2mA.toFixed(2)}mA`,
        `${solvedIV1mA.toFixed(2)}mA`
      ]
    : ['V0', 'V1', 'V2', 'i(R1)', 'i(R2)', 'i(V1)'];

  const nmaSteps = [
    {
      title: 'Step 1: Set Equation Dimensions',
      desc: `We construct a 6x6 Modified Nodal Analysis (MNA) matrix system to solve for the unknown node voltages V0, V1, V2, and the branch currents i(R1), i(R2), and i(V1). The variables vector is [V0, V1, V2, i(R1), i(R2), i(V1)]. All cells start at 0.`,
      matrix: [
        [0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0]
      ],
      rhs: [0, 0, 0, 0, 0, 0],
      highlights: [] as string[]
    },
    {
      title: 'Step 2: Add R1 Stamp',
      desc: `This is the stamp for element R1. Resistor R1 (${r1Val} ohms) connects Node 1 and Node 0, introducing branch current i(R1). We stamp: +1 in Node 1 KCL (Row 1 Col 3), -1 in Node 0 KCL (Row 0 Col 3), and add the branch relation V1 - V0 - R1*i(R1) = 0 in Row 3 (Col 1 = 1, Col 0 = -1, Col 3 = -${r1Val}).`,
      matrix: [
        [0, 0, 0, -1, 0, 0],
        [0, 0, 0, 1, 0, 0],
        [0, 0, 0, 0, 0, 0],
        [-1, 1, 0, -r1Val, 0, 0],
        [0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0]
      ],
      rhs: [0, 0, 0, 0, 0, 0],
      highlights: ['0-3', '1-3', '3-0', '3-1', '3-3']
    },
    {
      title: 'Step 2: Add R2 Stamp',
      desc: `This is the stamp for element R2. Resistor R2 (${r2Val} ohms) connects Node 1 and Node 2, introducing branch current i(R2). We stamp: +1 in Node 1 KCL (Row 1 Col 4), -1 in Node 2 KCL (Row 2 Col 4), and add the branch relation V1 - V2 - R2*i(R2) = 0 in Row 4 (Col 1 = 1, Col 2 = -1, Col 4 = -${r2Val}).`,
      matrix: [
        [0, 0, 0, -1, 0, 0],
        [0, 0, 0, 1, 1, 0],
        [0, 0, 0, 0, -1, 0],
        [-1, 1, 0, -r1Val, 0, 0],
        [0, 1, -1, 0, -r2Val, 0],
        [0, 0, 0, 0, 0, 0]
      ],
      rhs: [0, 0, 0, 0, 0, 0],
      highlights: ['1-4', '2-4', '4-1', '4-2', '4-4']
    },
    {
      title: 'Step 2: Add V1 Stamp',
      desc: `This is the stamp for element V1. Voltage source V1 (${v1Val}V) connects Node 2 (+) to Node 0 (-), introducing branch current i(V1). We stamp: +1 in Node 2 KCL (Row 2 Col 5), -1 in Node 0 KCL (Row 0 Col 5), and add the branch relation V2 - V0 = ${v1Val}V in Row 5 (Col 2 = 1, Col 0 = -1, and RHS Row 5 = ${v1Val}).`,
      matrix: [
        [0, 0, 0, -1, 0, -1],
        [0, 0, 0, 1, 1, 0],
        [0, 0, 0, 0, -1, 1],
        [-1, 1, 0, -r1Val, 0, 0],
        [0, 1, -1, 0, -r2Val, 0],
        [-1, 0, 1, 0, 0, 0]
      ],
      rhs: [0, 0, 0, 0, 0, v1Val],
      highlights: ['0-5', '2-5', '5-0', '5-2', 'rhs-5']
    },
    {
      title: 'Step 3: Set Node 0 to Ground',
      desc: `To solve the singular system, we substitute Ground V0 = 0. We overwrite Row 0 of the matrix with [1, 0, 0, 0, 0, 0] and RHS Row 0 with 0 (enforcing the equation 1*V0 = 0).`,
      matrix: [
        [1, 0, 0, 0, 0, 0],
        [0, 0, 0, 1, 1, 0],
        [0, 0, 0, 0, -1, 1],
        [-1, 1, 0, -r1Val, 0, 0],
        [0, 1, -1, 0, -r2Val, 0],
        [-1, 0, 1, 0, 0, 0]
      ],
      rhs: [0, 0, 0, 0, 0, v1Val],
      highlights: ['0-0', '0-1', '0-2', '0-3', '0-4', '0-5', 'rhs-0']
    },
    {
      title: 'Step 4: Solve System',
      desc: `Solving the complete 6x6 matrix equation yields the exact electrical values for all of our unknown variables: voltages V0, V1, V2, and the branch currents i(R1), i(R2), i(V1). The solved values are populated in the variables vector below.`,
      matrix: [
        [1, 0, 0, 0, 0, 0],
        [0, 0, 0, 1, 1, 0],
        [0, 0, 0, 0, -1, 1],
        [-1, 1, 0, -r1Val, 0, 0],
        [0, 1, -1, 0, -r2Val, 0],
        [-1, 0, 1, 0, 0, 0]
      ],
      rhs: [0, 0, 0, 0, 0, v1Val],
      highlights: [] as string[]
    },
    {
      title: 'Step 5: Non-linear MNA & Newton-Raphson',
      desc: `To solve non-linear circuits where elements have non-linear relations (like diode i_d = I_s * (e^(v_d/V_t) - 1)), we formulate f(x) = Gx + Hg(x) - s = 0. At each Newton-Raphson iteration (k), the diode is linearized into a companion model: a conductance gd = (I_s/V_t)*e^(vd^(k)/V_t) (stamped at Row 1, Col 1 as +gd) and a current source Ieq = id - gd*vd (stamped in RHS Row 1 as -Ieq). We iterate x^(k+1) = x^(k) - J^-1 * f(x^(k)) until convergence.`,
      matrix: [
        [1, 0, 0, 0, 0, 0],
        [0, 0.038, 0, 1, 1, 0],
        [0, 0, 0, 0, -1, 1],
        [-1, 1, 0, -r1Val, 0, 0],
        [0, 1, -1, 0, -r2Val, 0],
        [-1, 0, 1, 0, 0, 0]
      ],
      rhs: [0, -0.015, 0, 0, 0, v1Val],
      highlights: ['1-1', 'rhs-1']
    }
  ];

  const menuSections = [
    {
      id: 'step1',
      title: 'Step 1: Equation Dimensions',
      stepIndex: 0
    },
    {
      id: 'step2',
      title: 'Step 2: Add Element Stamps',
      substeps: [
        { title: 'Stamp: Resistor R1', stepIndex: 1 },
        { title: 'Stamp: Resistor R2', stepIndex: 2 },
        { title: 'Stamp: Voltage Source V1', stepIndex: 3 }
      ]
    },
    {
      id: 'step3',
      title: 'Step 3: Set Node to 0',
      stepIndex: 4
    },
    {
      id: 'step4',
      title: 'Step 4: Solve System',
      stepIndex: 5
    },
    {
      id: 'step5',
      title: 'Step 5: Non-linear MNA',
      stepIndex: 6
    }
  ];

  return (
    <div style={{ display: 'flex', height: '100%', gap: '16px', minHeight: 0 }}>
      {/* Side Menu */}
      <div style={{
        width: '185px',
        flexShrink: 0,
        background: 'rgba(15, 23, 42, 0.45)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '10px',
        padding: '10px',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        overflowY: 'auto',
        userSelect: 'none'
      }}>
        <div style={{ fontSize: '10px', fontWeight: 'bold', color: 'rgba(255,255,255,0.35)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em', paddingLeft: '4px' }}>
          MNA Walkthrough
        </div>
        {menuSections.map((sec) => {
          if (sec.substeps) {
            const isParentActive = nmaStep >= 1 && nmaStep <= 3;
            return (
              <div key={sec.id} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <div style={{
                  fontSize: '11px',
                  fontWeight: 'bold',
                  color: isParentActive ? 'var(--theme-sapphire)' : 'rgba(255,255,255,0.8)',
                  padding: '4px 6px',
                  borderRadius: '4px',
                  background: isParentActive ? 'rgba(59, 130, 246, 0.05)' : 'transparent',
                }}>
                  {sec.title}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', paddingLeft: '8px', borderLeft: '1px solid rgba(255,255,255,0.08)', marginLeft: '4px' }}>
                  {sec.substeps.map((sub) => {
                    const isActive = nmaStep === sub.stepIndex;
                    return (
                      <button
                        key={sub.stepIndex}
                        onClick={() => setNmaStep(sub.stepIndex)}
                        style={{
                          background: isActive ? 'var(--theme-sapphire)' : 'transparent',
                          color: isActive ? '#fff' : 'rgba(255,255,255,0.55)',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '4px 6px',
                          fontSize: '10px',
                          textAlign: 'left',
                          cursor: 'pointer',
                          fontWeight: isActive ? 'bold' : 'normal',
                          boxShadow: isActive ? '0 0 6px var(--theme-sapphire-glow)' : 'none',
                          transition: 'all 0.15s',
                          width: '100%'
                        }}
                      >
                        {sub.title}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          } else {
            const isActive = nmaStep === sec.stepIndex;
            return (
              <button
                key={sec.id}
                onClick={() => setNmaStep(sec.stepIndex!)}
                style={{
                  background: isActive ? 'var(--theme-sapphire)' : 'transparent',
                  color: isActive ? '#fff' : 'rgba(255,255,255,0.8)',
                  border: 'none',
                  borderRadius: '5px',
                  padding: '6px 8px',
                  fontSize: '11px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  boxShadow: isActive ? '0 0 6px var(--theme-sapphire-glow)' : 'none',
                  transition: 'all 0.15s',
                  width: '100%'
                }}
              >
                {sec.title}
              </button>
            );
          }
        })}
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', minWidth: 0, height: '100%' }}>
        {/* Explanation Box */}
        <div style={{
          fontSize: '11px',
          lineHeight: '1.45',
          color: 'rgba(255, 255, 255, 0.8)',
          background: 'rgba(15, 23, 42, 0.4)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '8px',
          padding: '10px 12px',
          minHeight: '56px',
          overflowY: 'auto'
        }}>
          {nmaSteps[nmaStep].desc}
        </div>

        {/* Grid bracket math equations viewer */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          margin: '4px 0',
          fontFamily: 'monospace',
          fontSize: '11px',
          background: 'rgba(0,0,0,0.12)',
          padding: '10px 8px',
          borderRadius: '8px',
          border: '1px solid rgba(255,255,255,0.03)',
          flex: 1,
          overflow: 'auto'
        }}>
          {/* Matrix A with Brackets */}
          <div style={{
            display: 'flex',
            borderLeft: '1.5px solid rgba(255,255,255,0.35)',
            borderRight: '1.5px solid rgba(255,255,255,0.35)',
            borderRadius: '4px',
            padding: '2px 4px',
            background: 'rgba(255, 255, 255, 0.01)'
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${nmaSteps[nmaStep].matrix[0].length}, 42px)`, gap: '3px', textAlign: 'center' }}>
              {nmaSteps[nmaStep].matrix.map((row, rIdx) =>
                row.map((val, cIdx) => {
                  const isHighlighted = nmaSteps[nmaStep].highlights.includes(`${rIdx}-${cIdx}`);
                  return (
                    <div
                      key={`${rIdx}-${cIdx}`}
                      style={{
                        padding: '4px 2px',
                        background: isHighlighted ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255,255,255,0.02)',
                        border: isHighlighted ? '1px solid var(--theme-amber)' : '1px solid rgba(255,255,255,0.04)',
                        borderRadius: '4px',
                        color: isHighlighted ? 'var(--theme-amber)' : '#ffffff',
                        fontWeight: isHighlighted ? 'bold' : 'normal',
                        fontSize: '9.5px'
                      }}
                    >
                      {val.toFixed(2)}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div style={{ color: 'rgba(255,255,255,0.4)', padding: '0 1px', fontSize: '11px' }}>&bull;</div>

          {/* Variables Vector X with Brackets */}
          <div style={{
            display: 'flex',
            borderLeft: '1.5px solid rgba(255,255,255,0.35)',
            borderRight: '1.5px solid rgba(255,255,255,0.35)',
            borderRadius: '4px',
            padding: '2px 4px',
            background: 'rgba(255, 255, 255, 0.01)'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', justifyContent: 'center' }}>
              {variableLabels.map((vLabel, idx) => (
                <div
                  key={idx}
                  style={{
                    width: nmaStep === 5 ? '56px' : '40px',
                    padding: '4px 0',
                    background: nmaStep === 5 ? 'rgba(52, 211, 153, 0.1)' : 'rgba(255,255,255,0.03)',
                    border: nmaStep === 5 ? '1px solid var(--theme-emerald)' : '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '4px',
                    color: nmaStep === 5 ? 'var(--theme-emerald)' : 'var(--theme-sapphire)',
                    textAlign: 'center',
                    fontWeight: 'bold',
                    fontSize: nmaStep === 5 ? '8.5px' : '9.5px'
                  }}
                >
                  {vLabel}
                </div>
              ))}
            </div>
          </div>

          <div style={{ color: 'rgba(255,255,255,0.4)', padding: '0 1px', fontSize: '11px' }}>=</div>

          {/* RHS Vector B with Brackets */}
          <div style={{
            display: 'flex',
            borderLeft: '1.5px solid rgba(255,255,255,0.35)',
            borderRight: '1.5px solid rgba(255,255,255,0.35)',
            borderRadius: '4px',
            padding: '2px 4px',
            background: 'rgba(255, 255, 255, 0.01)'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', justifyContent: 'center' }}>
              {nmaSteps[nmaStep].rhs.map((rhsVal, rIdx) => {
                const isHighlighted = nmaSteps[nmaStep].highlights.includes(`rhs-${rIdx}`);
                return (
                  <div
                    key={rIdx}
                    style={{
                      width: '42px',
                      padding: '4px 0',
                      background: isHighlighted ? 'rgba(244, 63, 94, 0.15)' : 'rgba(255,255,255,0.02)',
                      border: isHighlighted ? '1px solid var(--theme-coral)' : '1px solid rgba(255,255,255,0.04)',
                      borderRadius: '4px',
                      color: isHighlighted ? 'var(--theme-coral)' : '#ffffff',
                      textAlign: 'center',
                      fontWeight: isHighlighted ? 'bold' : 'normal',
                      fontSize: '9.5px'
                    }}
                  >
                    {rhsVal.toFixed(2)}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Final step voltage divider numerical solutions */}
        {nmaStep === 5 && (
          <div style={{
            background: 'rgba(52, 211, 153, 0.04)',
            border: '1px solid rgba(52, 211, 153, 0.12)',
            borderRadius: '8px',
            padding: '8px 12px',
            fontSize: '10px',
            flexShrink: 0
          }}>
            <div style={{ color: 'var(--theme-emerald)', fontWeight: 'bold', marginBottom: '4px', fontSize: '10.5px' }}>
              🏁 Complete 6x6 MNA Solutions (Voltages & Branch Currents):
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'rgba(255,255,255,0.85)', fontFamily: 'monospace', marginBottom: '4px', fontSize: '9.5px' }}>
              <div>V0 = <span style={{ color: '#fff', fontWeight: 'bold' }}>0.000 V</span></div>
              <div>V1 = <span style={{ color: '#fff', fontWeight: 'bold' }}>{solvedV1.toFixed(3)} V</span></div>
              <div>V2 = <span style={{ color: '#fff', fontWeight: 'bold' }}>{v1Val.toFixed(3)} V</span></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'rgba(255,255,255,0.85)', fontFamily: 'monospace', fontSize: '9.5px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '4px', marginBottom: '4px' }}>
              <div>i(R1) = <span style={{ color: 'var(--theme-emerald)', fontWeight: 'bold' }}>{solvedIR1mA.toFixed(3)} mA</span></div>
              <div>i(R2) = <span style={{ color: 'var(--theme-coral)', fontWeight: 'bold' }}>{solvedIR2mA.toFixed(3)} mA</span></div>
              <div>i(V1) = <span style={{ color: 'var(--theme-coral)', fontWeight: 'bold' }}>{solvedIV1mA.toFixed(3)} mA</span></div>
            </div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '7.5px', textAlign: 'center' }}>
              Equations: i(R1) = (V1-V0)/R1, i(R2) = (V1-V2)/R2, i(V1) = -i(R1) - i(R2)
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
