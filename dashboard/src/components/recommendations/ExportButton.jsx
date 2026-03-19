/**
 * ExportButton Component
 * 
 * Provides export functionality for recommendations data:
 * - CSV export
 * - Excel export
 * - Applies active filters to exported data
 * - Generates timestamped filenames
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.7, 2.8
 */

import React, { useState } from 'react';
import { Download, FileText, FileSpreadsheet } from 'lucide-react';

const ExportButton = ({ data, filename = 'recommendations' }) => {
  const [showMenu, setShowMenu] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Generate timestamp for filename (Req 2.7)
  const getTimestampedFilename = (format) => {
    const now = new Date();
    const timestamp = now.toISOString()
      .replace(/T/, '_')
      .replace(/\..+/, '')
      .replace(/:/g, '-');
    return `${filename}_${timestamp}.${format}`;
  };

  // Convert data to CSV format (Req 2.3)
  const exportToCSV = () => {
    setExporting(true);
    try {
      // Define columns (Req 2.5)
      const headers = ['Rank', 'Ticker', 'Score', 'Expected Return (%)', 'Sector'];
      
      // Convert data to CSV rows
      const rows = data.map((rec, idx) => [
        idx + 1,
        rec.ticker || '',
        (rec.confidence_score || rec.score || 0).toFixed(1),
        ((rec.expected_return || rec.exp_return_20 || 0) * 100).toFixed(2),
        rec.sector || ''
      ]);

      // Combine headers and rows
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => 
          // Escape cells containing commas or quotes
          typeof cell === 'string' && (cell.includes(',') || cell.includes('"'))
            ? `"${cell.replace(/"/g, '""')}"`
            : cell
        ).join(','))
      ].join('\n');

      // Create blob and trigger download (Req 2.8)
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = getTimestampedFilename('csv');
      link.click();
      URL.revokeObjectURL(link.href);
      
      setShowMenu(false);
    } catch (error) {
      console.error('Error exporting to CSV:', error);
      alert('Erro ao exportar para CSV. Por favor, tente novamente.');
    } finally {
      setExporting(false);
    }
  };

  // Convert data to Excel format (Req 2.4)
  const exportToExcel = async () => {
    setExporting(true);
    try {
      // Dynamically import xlsx library
      const XLSX = await import('xlsx');
      
      // Prepare data with headers (Req 2.5)
      const worksheetData = [
        ['Rank', 'Ticker', 'Score', 'Expected Return (%)', 'Sector'],
        ...data.map((rec, idx) => [
          idx + 1,
          rec.ticker || '',
          (rec.confidence_score || rec.score || 0).toFixed(1),
          ((rec.expected_return || rec.exp_return_20 || 0) * 100).toFixed(2),
          rec.sector || ''
        ])
      ];

      // Create worksheet and workbook
      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Recommendations');

      // Set column widths for better readability
      worksheet['!cols'] = [
        { wch: 6 },  // Rank
        { wch: 10 }, // Ticker
        { wch: 8 },  // Score
        { wch: 18 }, // Expected Return
        { wch: 20 }  // Sector
      ];

      // Trigger download (Req 2.8)
      XLSX.writeFile(workbook, getTimestampedFilename('xlsx'));
      
      setShowMenu(false);
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      alert('Erro ao exportar para Excel. Por favor, tente novamente.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      {/* Export Button (Req 2.1) */}
      <button
        onClick={() => setShowMenu(!showMenu)}
        disabled={exporting || data.length === 0}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.5rem 1rem',
          backgroundColor: '#3b82f6',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          fontSize: '0.875rem',
          fontWeight: '500',
          cursor: data.length === 0 || exporting ? 'not-allowed' : 'pointer',
          opacity: data.length === 0 || exporting ? 0.5 : 1,
          transition: 'all 0.2s'
        }}
        onMouseEnter={(e) => {
          if (data.length > 0 && !exporting) {
            e.currentTarget.style.backgroundColor = '#2563eb';
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = '#3b82f6';
        }}
      >
        <Download size={16} />
        {exporting ? 'Exportando...' : 'Exportar'}
      </button>

      {/* Format Selection Menu (Req 2.2) */}
      {showMenu && !exporting && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 0.5rem)',
          right: 0,
          backgroundColor: 'white',
          border: '1px solid #e2e8f0',
          borderRadius: '6px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          zIndex: 10,
          minWidth: '180px',
          overflow: 'hidden'
        }}>
          <button
            onClick={exportToCSV}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.75rem 1rem',
              backgroundColor: 'transparent',
              border: 'none',
              fontSize: '0.875rem',
              color: '#1e293b',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <FileText size={16} color="#64748b" />
            Exportar como CSV
          </button>
          
          <button
            onClick={exportToExcel}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.75rem 1rem',
              backgroundColor: 'transparent',
              border: 'none',
              borderTop: '1px solid #e2e8f0',
              fontSize: '0.875rem',
              color: '#1e293b',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <FileSpreadsheet size={16} color="#64748b" />
            Exportar como Excel
          </button>
        </div>
      )}

      {/* Click outside to close menu */}
      {showMenu && (
        <div
          onClick={() => setShowMenu(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 9
          }}
        />
      )}
    </div>
  );
};

export default ExportButton;
