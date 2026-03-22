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
        border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
        background: 'transparent',
        color: darkMode ? '#94a3b8' : '#64748b',
        cursor: data.length ? 'pointer' : 'not-allowed',
        opacity: data.length ? 1 : 0.5,
        transition: 'all 0.15s',
        WebkitAppearance: 'none' as any, minHeight: 'auto',
      }}
      onMouseEnter={e => { if (data.length) { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.color = '#3b82f6'; } }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = darkMode ? '#334155' : '#e2e8f0'; e.currentTarget.style.color = darkMode ? '#94a3b8' : '#64748b'; }}
    >
      <Download size={13} /> {label}
    </button>
  );
};

export default ExportCSV;
