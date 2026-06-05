import React from 'react';

interface SPICENetProps {
  spiceNetlist: string;
  setToast?: (toast: { message: string; type: 'success' | 'info' } | null) => void;
}

export const SPICENet: React.FC<SPICENetProps> = ({ spiceNetlist, setToast }) => {
  const handleCopyNetlist = () => {
    try {
      navigator.clipboard.writeText(spiceNetlist);
      if (setToast) {
        setToast({ message: '📋 SPICE Netlist copied to clipboard!', type: 'success' });
      }
    } catch (e) {
      console.error('Failed to copy netlist:', e);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>SPICE Deck Netlist format:</div>
        <button
          onClick={handleCopyNetlist}
          style={{
            background: 'rgba(255, 255, 255, 0.08)',
            border: 'none',
            borderRadius: '4px',
            color: '#fff',
            fontSize: '10px',
            padding: '4px 8px',
            cursor: 'pointer',
            fontWeight: 500,
            transition: 'background 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'}
        >
          Copy netlist
        </button>
      </div>
      
      <textarea
        readOnly
        value={spiceNetlist}
        style={{
          width: '100%',
          flex: 1,
          minHeight: '120px',
          background: '#090a0f',
          border: '1.5px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '8px',
          padding: '12px',
          color: '#34d399',
          fontFamily: 'monospace',
          fontSize: '11px',
          resize: 'none',
          outline: 'none',
          boxSizing: 'border-box'
        }}
      />
    </div>
  );
};
