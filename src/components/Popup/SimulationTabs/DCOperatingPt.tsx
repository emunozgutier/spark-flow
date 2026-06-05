import React from 'react';

interface DCOperatingPtProps {
  dcVoltages: Record<string, number>;
}

export const DCOperatingPt: React.FC<DCOperatingPtProps> = ({ dcVoltages }) => {
  return (
    <div>
      <div style={{ fontSize: '11.5px', color: 'rgba(255,255,255,0.5)', marginBottom: '12px' }}>
        Modified Nodal Analysis (MNA) matrix solver results:
      </div>
      
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)', textAlign: 'left' }}>
            <th style={{ padding: '6px 8px' }}>Electrical Node</th>
            <th style={{ padding: '6px 8px' }}>DC Voltage</th>
            <th style={{ padding: '6px 8px' }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {Object.keys(dcVoltages).map((node) => (
            <tr key={node} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', color: '#ffffff' }}>
              <td style={{ padding: '6px 8px', fontWeight: 'bold' }}>
                Node {node} {node === '0' && <span style={{ fontSize: '10px', color: 'var(--theme-emerald)' }}>(GND)</span>}
              </td>
              <td style={{ padding: '6px 8px', fontFamily: 'monospace', color: 'var(--theme-amber)' }}>
                {dcVoltages[node].toFixed(3)} V
              </td>
              <td style={{ padding: '6px 8px', fontSize: '10.5px', color: 'rgba(255,255,255,0.4)' }}>
                {node === '0' ? 'Reference' : 'Active'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
