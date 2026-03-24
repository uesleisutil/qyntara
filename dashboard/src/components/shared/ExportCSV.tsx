import React from 'react';
import { Download } from 'lucide-react';

interface ExportCSVProps {
  data: Record<string, any>[];
  filename: string;
  darkMode?: boolean;
  label?: string;
}

const ExportCSV: React.FC<ExportCSVProps> = ({ data, filename, darkMode = true, label = 'Exportar CSV' }) => {
  const handleExport = () => {
    if (!data.length) return;
    const headers = Object.keys(data[0]);
    const csvRows = [
      headers.join(','),
      ...data.map(row =>
        headers.map(h => {
          const val = row[h];
          const str = val == null ? '' : String(val);
          return str.includes(',') || str.includes('"') || str.includes('\n')
            ? `"${str.replace(/"/g, '""')}"` : str;
        }).join(',')
      ),
    ];
    const blob = new Blob(['\uFEFF' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <button
      onClick={handleExport}
      disabled={!data.length}
      title={label}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
        padding: '0.45rem 0.75rem', borderRadius: 8, fontSize: '0.78rem', fontWeight: 500,
        border: `1px solid ${darkMode ? '#2a3d36' : '#d4e5dc'}`,
        background: 'transparent',
        color: darkMode ? '#8fa89c' : '#5a7268',
        cursor: data.length ? 'pointer' : 'not-allowed',
        opacity: data.length ? 1 : 0.5,
        transition: 'all 0.15s',
        WebkitAppearance: 'none' as any, minHeight: 'auto',
      }}
      onMouseEnter={e => { if (data.length) { e.currentTarget.style.borderColor = '#5a9e87'; e.currentTarget.style.color = '#5a9e87'; } }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = darkMode ? '#2a3d36' : '#d4e5dc'; e.currentTarget.style.color = darkMode ? '#8fa89c' : '#5a7268'; }}
    >
      <Download size={13} /> {label}
    </button>
  );
};

export default ExportCSV;
