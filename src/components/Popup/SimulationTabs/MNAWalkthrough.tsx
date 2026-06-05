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
      title: 'Step 1: Size & Labels',
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
      title: 'Step 2a: Add R1 Stamp',
      desc: `Resistor R1 (${r1Val} ohms) connects Node 1 and Node 0, introducing branch current i(R1). We stamp: +1 in Node 1 KCL (Row 1 Col 3), -1 in Node 0 KCL (Row 0 Col 3), and add the branch relation V1 - V0 - R1*i(R1) = 0 in Row 3 (Col 1 = 1, Col 0 = -1, Col 3 = -${r1Val}).`,
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
      title: 'Step 2b: Add R2 Stamp',
      desc: `Resistor R2 (${r2Val} ohms) connects Node 1 and Node 2, introducing branch current i(R2). We stamp: +1 in Node 1 KCL (Row 1 Col 4), -1 in Node 2 KCL (Row 2 Col 4), and add the branch relation V1 - V2 - R2*i(R2) = 0 in Row 4 (Col 1 = 1, Col 2 = -1, Col 4 = -${r2Val}).`,
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
      title: 'Step 2c: Add V1 Stamp',
      desc: `Voltage source V1 (${v1Val}V) connects Node 2 (+) to Node 0 (-), introducing branch current i(V1). We stamp: +1 in Node 2 KCL (Row 2 Col 5), -1 in Node 0 KCL (Row 0 Col 5), and add the branch relation V2 - V0 = ${v1Val}V in Row 5 (Col 2 = 1, Col 0 = -1, and RHS Row 5 = ${v1Val}).`,
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
      title: 'Step 3: Ground Constraint',
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
      title: 'Step 4: Solved Variables',
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
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '12px' }}>
      {/* Step selector progress bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '6px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
        <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--theme-sapphire)' }}>
          {nmaSteps[nmaStep].title}
        </span>
        <div style={{ display: 'flex', gap: '6px' }}>
          {nmaSteps.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setNmaStep(idx)}
              style={{
                width: '22px',
                height: '22px',
                borderRadius: '50%',
                border: 'none',
                background: nmaStep === idx ? 'var(--theme-sapphire)' : 'rgba(255,255,255,0.08)',
                color: '#fff',
                fontSize: '10px',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: nmaStep === idx ? '0 0 8px var(--theme-sapphire-glow)' : 'none',
                transition: 'background 0.2s, box-shadow 0.2s'
              }}
            >
              {idx + 1}
            </button>
          ))}
        </div>
      </div>

      {/* Explanation Box */}
      <div style={{
        fontSize: '11px',
        lineHeight: '1.5',
        color: 'rgba(255, 255, 255, 0.75)',
        background: 'rgba(15, 23, 42, 0.4)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '8px',
        padding: '10px 14px',
        height: '66px',
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
        margin: '8px 0',
        fontFamily: 'monospace',
        fontSize: '11px',
        background: 'rgba(0,0,0,0.1)',
        padding: '12px 10px',
        borderRadius: '10px',
        border: '1px solid rgba(255,255,255,0.03)'
      }}>
        {/* Matrix A with Brackets */}
        <div style={{
          display: 'flex',
          borderLeft: '1.5px solid rgba(255,255,255,0.3)',
          borderRight: '1.5px solid rgba(255,255,255,0.3)',
          borderRadius: '4px',
          padding: '2px 6px',
          background: 'rgba(255, 255, 255, 0.01)'
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${nmaSteps[nmaStep].matrix[0].length}, 48px)`, gap: '4px', textAlign: 'center' }}>
            {nmaSteps[nmaStep].matrix.map((row, rIdx) =>
              row.map((val, cIdx) => {
                const isHighlighted = nmaSteps[nmaStep].highlights.includes(`${rIdx}-${cIdx}`);
                return (
                  <div
                    key={`${rIdx}-${cIdx}`}
                    style={{
                      padding: '5px 2px',
                      background: isHighlighted ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255,255,255,0.02)',
                      border: isHighlighted ? '1px solid var(--theme-amber)' : '1px solid rgba(255,255,255,0.04)',
                      borderRadius: '4px',
                      color: isHighlighted ? 'var(--theme-amber)' : '#ffffff',
                      fontWeight: isHighlighted ? 'bold' : 'normal',
                      fontSize: '10px'
                    }}
                  >
                    {val.toFixed(2)}
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div style={{ color: 'rgba(255,255,255,0.4)', padding: '0 2px', fontSize: '12px' }}>&bull;</div>

        {/* Variables Vector X with Brackets */}
        <div style={{
          display: 'flex',
          borderLeft: '1.5px solid rgba(255,255,255,0.3)',
          borderRight: '1.5px solid rgba(255,255,255,0.3)',
          borderRadius: '4px',
          padding: '2px 6px',
          background: 'rgba(255, 255, 255, 0.01)'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', justifyContent: 'center' }}>
            {variableLabels.map((vLabel, idx) => (
              <div
                key={idx}
                style={{
                  width: nmaStep === 5 ? '62px' : '44px',
                  padding: '5px 0',
                  background: nmaStep === 5 ? 'rgba(52, 211, 153, 0.1)' : 'rgba(255,255,255,0.03)',
                  border: nmaStep === 5 ? '1px solid var(--theme-emerald)' : '1px solid rgba(255,255,255,0.06)',
                  borderRadius: '4px',
                  color: nmaStep === 5 ? 'var(--theme-emerald)' : 'var(--theme-sapphire)',
                  textAlign: 'center',
                  fontWeight: 'bold',
                  fontSize: nmaStep === 5 ? '9px' : '10px'
                }}
              >
                {vLabel}
              </div>
            ))}
          </div>
        </div>

        <div style={{ color: 'rgba(255,255,255,0.4)', padding: '0 2px', fontSize: '12px' }}>=</div>

        {/* RHS Vector B with Brackets */}
        <div style={{
          display: 'flex',
          borderLeft: '1.5px solid rgba(255,255,255,0.3)',
          borderRight: '1.5px solid rgba(255,255,255,0.3)',
          borderRadius: '4px',
          padding: '2px 6px',
          background: 'rgba(255, 255, 255, 0.01)'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', justifyContent: 'center' }}>
            {nmaSteps[nmaStep].rhs.map((rhsVal, rIdx) => {
              const isHighlighted = nmaSteps[nmaStep].highlights.includes(`rhs-${rIdx}`);
              return (
                <div
                  key={rIdx}
                  style={{
                    width: '46px',
                    padding: '5px 0',
                    background: isHighlighted ? 'rgba(244, 63, 94, 0.15)' : 'rgba(255,255,255,0.02)',
                    border: isHighlighted ? '1px solid var(--theme-coral)' : '1px solid rgba(255,255,255,0.04)',
                    borderRadius: '4px',
                    color: isHighlighted ? 'var(--theme-coral)' : '#ffffff',
                    textAlign: 'center',
                    fontWeight: isHighlighted ? 'bold' : 'normal',
                    fontSize: '10px'
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
          fontSize: '10.5px'
        }}>
          <div style={{ color: 'var(--theme-emerald)', fontWeight: 'bold', marginBottom: '4px', fontSize: '11px' }}>
            🏁 Complete 6x6 MNA Solutions (Voltages & Branch Currents):
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'rgba(255,255,255,0.85)', fontFamily: 'monospace', marginBottom: '4px', fontSize: '10px' }}>
            <div>V0 = <span style={{ color: '#fff', fontWeight: 'bold' }}>0.000 V</span></div>
            <div>V1 = <span style={{ color: '#fff', fontWeight: 'bold' }}>{solvedV1.toFixed(3)} V</span></div>
            <div>V2 = <span style={{ color: '#fff', fontWeight: 'bold' }}>{v1Val.toFixed(3)} V</span></div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'rgba(255,255,255,0.85)', fontFamily: 'monospace', fontSize: '10px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '4px', marginBottom: '4px' }}>
            <div>i(R1) = <span style={{ color: 'var(--theme-emerald)', fontWeight: 'bold' }}>{solvedIR1mA.toFixed(3)} mA</span></div>
            <div>i(R2) = <span style={{ color: 'var(--theme-coral)', fontWeight: 'bold' }}>{solvedIR2mA.toFixed(3)} mA</span></div>
            <div>i(V1) = <span style={{ color: 'var(--theme-coral)', fontWeight: 'bold' }}>{solvedIV1mA.toFixed(3)} mA</span></div>
          </div>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '8px', textAlign: 'center' }}>
            Equations: i(R1) = (V1-V0)/R1, i(R2) = (V1-V2)/R2, i(V1) = -i(R1) - i(R2)
          </div>
        </div>
      )}
    </div>
  );
};
